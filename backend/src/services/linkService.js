const crypto = require('crypto');
const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const env = require('../config/environment');

class LinkService {
  /**
   * Generate or retrieve an active UUID bill access link for a finalized bill
   */
  async generateBillAccessLink(billId, currentUser = null, expiryDaysOverride = null) {
    const bill = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      },
      include: { patient: true }
    });

    if (!bill) {
      throw { statusCode: 404, message: 'Finalized bill not found' };
    }

    const patient = bill.patient;
    if (!patient) {
      throw { statusCode: 404, message: 'Patient associated with bill not found' };
    }

    // Check if an existing ACTIVE and UNEXPIRED link already exists for this bill
    const now = new Date();
    const existingActiveLink = await prisma.billAccessLink.findFirst({
      where: {
        billId: bill.billId,
        status: 'Active',
        expiresAt: { gt: now }
      }
    });

    if (existingActiveLink) {
      return {
        ...existingActiveLink,
        url: this.buildPublicLinkUrl(existingActiveLink.token)
      };
    }

    const clinic = await prisma.clinicProfile.findFirst();
    const clinicDays = clinic?.whatsappDefaultExpiryDays;
    const expiryDays = Number(expiryDaysOverride || clinicDays || env.billLinkExpiryDays || 365);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const linkId = idGenerator.nextLinkId();

    const newLink = await prisma.billAccessLink.create({
      data: {
        id: linkId,
        token,
        billId: bill.billId,
        patientId: bill.patientId,
        status: 'Active',
        expiresAt,
        accessCount: 0
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'LINK_GENERATED',
        resourceType: 'LINK',
        resourceId: linkId,
        patientId: bill.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Staff',
        userRole: currentUser?.role || 'STAFF',
        details: `Generated secure UUID bill link for Invoice ${bill.invoiceNumber} (Expires in ${expiryDays} days)`
      }
    }).catch(err => console.error('[LinkService] Failed to write audit log:', err.message));

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
   */
  async getBillByToken(token, ipAddress = '127.0.0.1') {
    if (!token || typeof token !== 'string') {
      throw { statusCode: 400, message: 'Bill access token is required' };
    }

    const cleanToken = token.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanToken)) {
      await prisma.systemAuditLog.create({
        data: {
          action: 'LINK_ACCESS_REJECTED',
          resourceType: 'LINK',
          status: 'FAILURE',
          ipAddress,
          details: 'Attempted bill access with malformed token'
        }
      }).catch(() => {});
      throw { statusCode: 404, message: 'Invalid or unrecognized bill link.' };
    }

    const link = await prisma.billAccessLink.findFirst({
      where: { token: { equals: cleanToken } }
    });

    if (!link) {
      await prisma.systemAuditLog.create({
        data: {
          action: 'LINK_ACCESS_NOT_FOUND',
          resourceType: 'LINK',
          status: 'FAILURE',
          ipAddress,
          details: 'Attempted access with non-existent token'
        }
      }).catch(() => {});
      throw {
        statusCode: 404,
        message: 'This bill link could not be found or has expired. Please contact VIORA Healthcare front desk.'
      };
    }

    if (link.status === 'Revoked') {
      await prisma.systemAuditLog.create({
        data: {
          action: 'LINK_ACCESS_BLOCKED',
          resourceType: 'LINK',
          resourceId: link.id,
          patientId: link.patientId,
          status: 'REVOKED',
          ipAddress,
          details: 'Attempted access to revoked bill link'
        }
      }).catch(() => {});
      throw {
        statusCode: 410,
        message: 'This bill link has been revoked for security reasons. Please contact VIORA Healthcare front desk to request an updated bill link.'
      };
    }

    const now = new Date();
    if (new Date(link.expiresAt) <= now || link.status === 'Expired') {
      await prisma.billAccessLink.update({
        where: { id: link.id },
        data: { status: 'Expired' }
      });

      await prisma.systemAuditLog.create({
        data: {
          action: 'LINK_ACCESS_EXPIRED',
          resourceType: 'LINK',
          resourceId: link.id,
          patientId: link.patientId,
          status: 'EXPIRED',
          ipAddress,
          details: 'Attempted access to expired bill link'
        }
      }).catch(() => {});

      throw {
        statusCode: 410,
        message: 'This bill link has expired. For your privacy and security, healthcare bill links are time-limited. Please contact VIORA Healthcare to receive a refreshed link.'
      };
    }

    const billingService = require('./billingService');
    let billData;
    try {
      billData = await billingService.getBillById(link.billId);
    } catch {
      throw { statusCode: 404, message: 'The requested bill record is unavailable.' };
    }

    const updatedLink = await prisma.billAccessLink.update({
      where: { id: link.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: now
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'LINK_ACCESSED',
        resourceType: 'LINK',
        resourceId: link.id,
        patientId: link.patientId,
        status: 'SUCCESS',
        ipAddress,
        details: `Patient accessed Invoice ${billData.invoiceNumber} via secure UUID link (Count: ${updatedLink.accessCount})`
      }
    }).catch(() => {});

    const clinicProfile = await prisma.clinicProfile.findFirst();

    return {
      clinic: {
        clinicName: clinicProfile?.clinicName || 'VIORA',
        tagline: clinicProfile?.tagline || 'Advanced Clinic & Healthcare Centre',
        logoUrl: clinicProfile?.logoUrl || null,
        address: clinicProfile?.address || '',
        city: clinicProfile?.city || 'Bengaluru',
        state: clinicProfile?.state || 'Karnataka',
        pinCode: clinicProfile?.pinCode || '',
        contactNumber: clinicProfile?.contactNumber || '+91 80 4920 8800',
        email: clinicProfile?.email || 'contact@vioraclinic.com',
        website: clinicProfile?.website || 'https://vioracare.in',
        registrationNumber: clinicProfile?.registrationNumber || 'KA-MED-2024-88421',
        gstNumber: clinicProfile?.gstNumber || '29AABCU9603R1ZM',
        currency: clinicProfile?.currency || '₹'
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
        expiresAt: updatedLink.expiresAt,
        accessCount: updatedLink.accessCount
      }
    };
  }

  /**
   * Revoke an active bill access link
   */
  async revokeBillAccessLink(linkIdOrToken, currentUser) {
    const link = await prisma.billAccessLink.findFirst({
      where: {
        OR: [
          { id: linkIdOrToken },
          { token: linkIdOrToken }
        ]
      }
    });

    if (!link) {
      throw { statusCode: 404, message: 'Bill access link not found' };
    }

    const updated = await prisma.billAccessLink.update({
      where: { id: link.id },
      data: {
        status: 'Revoked',
        revokedAt: new Date(),
        revokedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Authorized Staff'
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'LINK_REVOKED',
        resourceType: 'LINK',
        resourceId: link.id,
        patientId: link.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Staff',
        userRole: currentUser?.role || 'STAFF',
        details: `Revoked bill access link ${link.id} for Bill ${link.billId}`
      }
    }).catch(() => {});

    return updated;
  }

  /**
   * Get all links associated with a bill
   */
  async getLinksForBill(billId) {
    const links = await prisma.billAccessLink.findMany({
      where: { billId },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    return links.map(l => ({
      ...l,
      url: this.buildPublicLinkUrl(l.token),
      isExpired: new Date(l.expiresAt) <= now
    }));
  }
}

module.exports = new LinkService();
