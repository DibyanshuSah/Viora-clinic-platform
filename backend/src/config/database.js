const prisma = require('./prisma');
const idGenerator = require('../utils/idGenerator');

class DatabaseStore {
  constructor() {
    this.prisma = prisma;
  }

  // ID GENERATORS & PREVIEWS (Database-backed)
  async peekNextPatientId() {
    return idGenerator.peekNextPatientId();
  }

  async nextPatientId() {
    return idGenerator.nextPatientId();
  }

  async nextDoctorId() {
    return idGenerator.nextDoctorId();
  }

  async nextStaffId() {
    return idGenerator.nextStaffId();
  }

  async nextProcedureId() {
    return idGenerator.nextProcedureId();
  }

  async nextAppointmentId() {
    return idGenerator.nextAppointmentId();
  }

  async nextConsultationId() {
    return idGenerator.nextConsultationId();
  }

  async nextPrescriptionId() {
    return idGenerator.nextPrescriptionId();
  }

  async nextBillId() {
    return idGenerator.nextBillId();
  }

  async nextInvoiceNumber() {
    return idGenerator.nextInvoiceNumber();
  }

  nextUserId(prefix = 'usr') {
    return idGenerator.nextUserId(prefix);
  }

  nextLinkId() {
    return idGenerator.nextLinkId();
  }

  nextWhatsAppMessageId() {
    return idGenerator.nextWhatsAppMessageId();
  }

  /**
   * Log System Audit Action directly to SQLite
   */
  async logAuditAction({
    action,
    resourceType,
    resourceId = null,
    patientId = null,
    user = null,
    ipAddress = '127.0.0.1',
    status = 'SUCCESS',
    details = ''
  }) {
    // Redact raw UUID tokens, secrets or passwords
    let sanitizedDetails = String(details || '');
    sanitizedDetails = sanitizedDetails
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, (match) => `${match.substring(0, 8)}...[REDACTED_UUID]`)
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

    try {
      return await this.prisma.systemAuditLog.create({
        data: {
          action: String(action),
          resourceType: String(resourceType),
          resourceId: resourceId ? String(resourceId) : null,
          patientId: patientId ? String(patientId) : null,
          userId: user?.id || null,
          userName: user ? (user.name || user.username || 'System') : 'System',
          userRole: user ? String(user.role) : 'SYSTEM',
          ipAddress: ipAddress || '127.0.0.1',
          status: String(status || 'SUCCESS'),
          details: sanitizedDetails
        }
      });
    } catch (err) {
      console.warn('[DatabaseStore] Audit log insert failed:', err.message);
      return null;
    }
  }

  /**
   * Log Billing Action directly to SQLite system audit logs
   */
  async logBillingAction({ action, billId, invoiceNumber, patientId, patientName, total, details, user }) {
    const actionName = action === 'GENERATED' ? 'BILL_CREATED' : (action === 'DELETED' || action === 'PATIENT_BILLS_DELETED' ? 'BILL_CANCELLED' : 'BILL_EDITED');
    const note = details || `Invoice ${invoiceNumber || billId} for patient ${patientName || patientId}: ${action}`;

    return await this.logAuditAction({
      action: actionName,
      resourceType: 'BILL',
      resourceId: billId || invoiceNumber,
      patientId,
      user,
      details: `${note}${total !== undefined && total !== null ? ` | Total: ₹${total}` : ''}`
    });
  }
}

const dbInstance = new DatabaseStore();
module.exports = dbInstance;
