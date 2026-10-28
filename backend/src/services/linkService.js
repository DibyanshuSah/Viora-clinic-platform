const crypto = require('crypto');
const db = require('../config/database');
const env = require('../config/environment');

class LinkService {
  /**
   * Generate or retrieve an active UUID bill access link for a finalized bill
   * @param {string} billId - Target bill ID
   * @param {Object} currentUser - User initiating generation (staff or admin)
   * @param {number} [expiryDaysOverride] - Optional custom expiry in days
   */
  generateBillAccessLink(billId, currentUser = null, expiryDaysOverride = null) {
    const bill = db.bills.find(b => b.billId === billId || b.invoiceNumber === billId);
    if (!bill) {
      throw { statusCode: 404, message: 'Finalized bill not found' };
    }

    const patient = db.patients.find(p => p.patientId === bill.patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient associated with bill not found' };
    }

    // Check if an existing ACTIVE and UNEXPIRED link already exists for this bill
    const now = new Date();
    const existingActiveLink = db.billAccessLinks.find(
      l => l.billId === bill.billId && l.status === 'Active' && new Date(l.expiresAt) > now
    );

    if (existingActiveLink) {
      return {
        ...existingActiveLink,
        url: this.buildPublicLinkUrl(existingActiveLink.token)
      };
    }

    // Determine expiry days: param override > clinicProfile setting > environment default
    const clinicDays = db.clinicProfile?.whatsappDefaultExpiryDays;
    const expiryDays = Number(expiryDaysOverride || clinicDays || env.billLinkExpiryDays || 365);

    // Cryptographically secure UUID (v4)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const linkId = db.nextLinkId();
    const newLink = {
      id: linkId,
      token,
      billId: bill.billId,
      patientId: bill.patientId,
      status: 'Active', // Active | Revoked | Expired
      expiresAt,
      revokedAt: null,
      revokedBy: null,
      accessCount: 0,
      lastAccessedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.billAccessLinks.unshift(newLink);

    // Audit log
    db.logAuditAction({
      action: 'LINK_GENERATED',
      resourceType: 'LINK',
      resourceId: linkId,
      patientId: bill.patientId,
      user: currentUser,
      details: `Generated secure UUID bill link for Invoice ${bill.invoiceNumber} (Expires in ${expiryDays} days)`
    });

    return {
      ...newLink,
      url: this.buildPublicLinkUrl(token)
    };
  }

  /**
   * Build complete public URL with UUID token
   */
  buildPublicLinkUrl(token) {
    const baseUrl = (env.appBaseUrl || 'https://vioracare.in').replace(/\/+$/, '');
    return `${baseUrl}/view-bill/${token}`;
  }

  /**
   * Retrieve and validate bill by UUID token for public patient access
   * @param {string} token - The UUID token from WhatsApp link
   * @param {string} ipAddress - Request IP for audit logging
   */
  getBillByToken(token, ipAddress = '127.0.0.1') {
    if (!token || typeof token !== 'string') {
      throw { statusCode: 400, message: 'Bill access token is required' };
    }

    const cleanToken = token.trim();
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanToken)) {
      db.logAuditAction({
        action: 'LINK_ACCESS_REJECTED',
        resourceType: 'LINK',
        status: 'FAILURE',
        ipAddress,
        details: 'Attempted bill access with malformed token'
      });
      throw { statusCode: 404, message: 'Invalid or unrecognized bill link.' };
    }

    const link = db.billAccessLinks.find(l => l.token.toLowerCase() === cleanToken.toLowerCase());
    if (!link) {
      db.logAuditAction({
        action: 'LINK_ACCESS_NOT_FOUND',
        resourceType: 'LINK',
        status: 'FAILURE',
        ipAddress,
        details: 'Attempted access with non-existent token'
      });
      throw {
        statusCode: 404,
        message: 'This bill link could not be found or has expired. Please contact VIORA Healthcare front desk.'
      };
    }

    // Check revocation
    if (link.status === 'Revoked') {
      db.logAuditAction({
        action: 'LINK_ACCESS_BLOCKED',
        resourceType: 'LINK',
        resourceId: link.id,
        patientId: link.patientId,
        status: 'REVOKED',
        ipAddress,
        details: 'Attempted access to revoked bill link'
      });
      throw {
        statusCode: 410,
        message: 'This bill link has been revoked for security reasons. Please contact VIORA Healthcare front desk to request an updated bill link.'
      };
    }

    // Check expiration
    const now = new Date();
    if (new Date(link.expiresAt) <= now || link.status === 'Expired') {
      link.status = 'Expired';
      link.updatedAt = now.toISOString();

      db.logAuditAction({
        action: 'LINK_ACCESS_EXPIRED',
        resourceType: 'LINK',
        resourceId: link.id,
        patientId: link.patientId,
        status: 'EXPIRED',
        ipAddress,
        details: 'Attempted access to expired bill link'
      });

      throw {
        statusCode: 410,
        message: 'This bill link has expired. For your privacy and security, healthcare bill links are time-limited. Please contact VIORA Healthcare to receive a refreshed link.'
      };
    }

    // Find the associated bill
    const billingService = require('./billingService');
    let billData;
    try {
      billData = billingService.getBillById(link.billId);
    } catch {
      throw { statusCode: 404, message: 'The requested bill record is unavailable.' };
    }

    // Record successful access metrics
    link.accessCount = (link.accessCount || 0) + 1;
    link.lastAccessedAt = now.toISOString();
    link.updatedAt = now.toISOString();

    db.logAuditAction({
      action: 'LINK_ACCESSED',
      resourceType: 'LINK',
      resourceId: link.id,
      patientId: link.patientId,
      status: 'SUCCESS',
      ipAddress,
      details: `Patient accessed Invoice ${billData.invoiceNumber} via secure UUID link (Count: ${link.accessCount})`
    });

    // Return sanitized view payload without internal sensitive IDs or other patient records
    return {
      clinic: {
        clinicName: db.clinicProfile?.clinicName || 'VIORA',
        tagline: db.clinicProfile?.tagline || 'Advanced Clinic & Healthcare Centre',
        logoUrl: db.clinicProfile?.logoUrl || null,
        address: db.clinicProfile?.address || '',
        city: db.clinicProfile?.city || 'Bengaluru',
        state: db.clinicProfile?.state || 'Karnataka',
        pinCode: db.clinicProfile?.pinCode || '',
        contactNumber: db.clinicProfile?.contactNumber || '+91 80 4920 8800',
        email: db.clinicProfile?.email || 'contact@vioraclinic.com',
        website: db.clinicProfile?.website || 'https://vioracare.in',
        registrationNumber: db.clinicProfile?.registrationNumber || 'KA-MED-2024-88421',
        gstNumber: db.clinicProfile?.gstNumber || '29AABCU9603R1ZM',
        currency: db.clinicProfile?.currency || '₹'
      },
      invoice: {
        invoiceNumber: billData.invoiceNumber,
        createdAt: billData.createdAt,
        patientName: billData.patientName,
        patientAge: billData.patientAge,
        patientGender: billData.patientGender,
        patientPhone: billData.patientPhone ? `${billData.patientPhone.slice(0, 4)}****${billData.patientPhone.slice(-3)}` : '',
        doctorName: billData.doctorName,
        doctorSpecialization: billData.doctorSpecialization,
        doctorQualification: billData.doctorQualification,
        doctorRegNo: billData.doctorRegNo,
        consultationType: billData.consultationType,
        consultationFee: billData.consultationFee,
        procedures: billData.procedures || [],
        subtotal: billData.subtotal,
        discount: billData.discount,
        tax: billData.tax,
        total: billData.total,
        paid: billData.paid,
        balance: billData.balance,
        paymentMethod: billData.paymentMethod,
        paymentStatus: billData.paymentStatus
      },
      linkMetadata: {
        expiresAt: link.expiresAt,
        accessCount: link.accessCount
      }
    };
  }

  /**
   * Revoke an active bill access link
   * @param {string} linkIdOrToken - Link ID or token
   * @param {Object} currentUser - User revoking (Staff or Admin)
   */
  revokeBillAccessLink(linkIdOrToken, currentUser) {
    const link = db.billAccessLinks.find(
      l => l.id === linkIdOrToken || l.token.toLowerCase() === String(linkIdOrToken).toLowerCase()
    );

    if (!link) {
      throw { statusCode: 404, message: 'Bill access link not found' };
    }

    link.status = 'Revoked';
    link.revokedAt = new Date().toISOString();
    link.revokedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Authorized Staff';
    link.updatedAt = new Date().toISOString();

    db.logAuditAction({
      action: 'LINK_REVOKED',
      resourceType: 'LINK',
      resourceId: link.id,
      patientId: link.patientId,
      user: currentUser,
      details: `Revoked bill access link ${link.id} for Bill ${link.billId}`
    });

    return link;
  }

  /**
   * Get all links associated with a bill
   */
  getLinksForBill(billId) {
    return db.billAccessLinks
      .filter(l => l.billId === billId)
      .map(l => ({
        ...l,
        url: this.buildPublicLinkUrl(l.token),
        isExpired: new Date(l.expiresAt) <= new Date()
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = new LinkService();
