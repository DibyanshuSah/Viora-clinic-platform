const prisma = require('./prisma');
const {
  clinicProfileSeed,
  usersSeed,
  doctorsSeed,
  staffSeed,
  proceduresSeed,
  patientsSeed,
  appointmentsSeed,
  consultationsSeed,
  prescriptionsSeed,
  billsSeed
} = require('../seed/seedData');

class DatabaseStore {
  constructor() {
    this.prisma = prisma;
    this.reset();
  }

  reset() {
    // In-memory working cache
    this.clinicProfile = JSON.parse(JSON.stringify(clinicProfileSeed));
    this.users = JSON.parse(JSON.stringify(usersSeed));
    this.doctors = JSON.parse(JSON.stringify(doctorsSeed));
    this.staff = JSON.parse(JSON.stringify(staffSeed));
    this.procedures = JSON.parse(JSON.stringify(proceduresSeed));
    this.patients = JSON.parse(JSON.stringify(patientsSeed));
    this.appointments = JSON.parse(JSON.stringify(appointmentsSeed));
    this.consultations = JSON.parse(JSON.stringify(consultationsSeed));
    this.prescriptions = JSON.parse(JSON.stringify(prescriptionsSeed));
    this.bills = JSON.parse(JSON.stringify(billsSeed));
    this.billingLogs = [];
    this.billAccessLinks = [];
    this.whatsappMessages = [];
    this.auditLogs = [];

    this.counters = {
      patient: 1002,
      doctor: 102,
      staff: 201,
      appointment: 2,
      consultation: 1001,
      prescription: 1001,
      procedure: 8,
      bill: 1,
      user: 3,
      link: 1,
      whatsapp: 1
    };
  }

  // ID GENERATORS & PREVIEWS
  peekNextPatientId() {
    return `PAT-${this.counters.patient}`;
  }

  logAuditAction({
    action, // BILL_CREATED, LINK_GENERATED, LINK_ACCESSED, LINK_REVOKED, WHATSAPP_SENT, WHATSAPP_RETRIED, WHATSAPP_FAILED, PERMISSION_CHANGED, SETTINGS_UPDATED
    resourceType, // BILL, LINK, WHATSAPP, USER, SETTING, APPOINTMENT
    resourceId = null,
    patientId = null,
    user = null,
    ipAddress = '127.0.0.1',
    status = 'SUCCESS', // SUCCESS | FAILURE | REVOKED | EXPIRED | PENDING
    details = ''
  }) {
    // Redact raw token secrets, passwords, or full URLs containing UUID tokens from audit log details
    let sanitizedDetails = String(details || '');
    sanitizedDetails = sanitizedDetails
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, (match) => `${match.substring(0, 8)}...[REDACTED_UUID]`)
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

    const auditEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      action,
      resourceType,
      resourceId: resourceId || null,
      patientId: patientId || null,
      userId: user?.id || null,
      userName: user ? user.name : 'System',
      userRole: user ? user.role : 'SYSTEM',
      ipAddress: ipAddress || '127.0.0.1',
      status,
      details: sanitizedDetails,
      createdAt: new Date().toISOString()
    };

    this.auditLogs.unshift(auditEntry);
    if (this.auditLogs.length > 2000) {
      this.auditLogs.pop();
    }
    return auditEntry;
  }

  logBillingAction({ action, billId, invoiceNumber, patientId, patientName, total, details, user }) {
    const log = {
      logId: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action, // 'GENERATED' | 'EDITED' | 'PAYMENT_UPDATED' | 'DELETED' | 'PATIENT_BILLS_DELETED'
      billId: billId || null,
      invoiceNumber: invoiceNumber || null,
      patientId: patientId || null,
      patientName: patientName || 'Unknown Patient',
      total: total !== undefined && total !== null ? Number(total) : null,
      details: details || '',
      performedBy: user ? `${user.name} (${user.role})` : 'System',
      timestamp: new Date().toISOString()
    };
    this.billingLogs.unshift(log);

    // Also mirror into auditLogs for compliance
    this.logAuditAction({
      action: action === 'GENERATED' ? 'BILL_CREATED' : 'BILL_EDITED',
      resourceType: 'BILL',
      resourceId: billId || invoiceNumber,
      patientId,
      user,
      details: `Invoice ${invoiceNumber || billId} for patient ${patientName}: ${action}`
    });

    return log;
  }

  nextPatientId() {
    const id = `PAT-${this.counters.patient}`;
    this.counters.patient += 1;
    return id;
  }

  nextDoctorId() {
    const id = `DOC-${this.counters.doctor}`;
    this.counters.doctor += 1;
    return id;
  }

  nextStaffId() {
    const id = `STF-${this.counters.staff}`;
    this.counters.staff += 1;
    return id;
  }

  nextAppointmentId() {
    const year = new Date().getFullYear();
    const id = `APT-${year}-${String(this.counters.appointment).padStart(3, '0')}`;
    this.counters.appointment += 1;
    return id;
  }

  nextConsultationId() {
    const id = `CNS-${this.counters.consultation}`;
    this.counters.consultation += 1;
    return id;
  }

  nextPrescriptionId() {
    const id = `RX-${this.counters.prescription}`;
    this.counters.prescription += 1;
    return id;
  }

  nextProcedureId() {
    const id = `PROC-${String(this.counters.procedure).padStart(3, '0')}`;
    this.counters.procedure += 1;
    return id;
  }

  nextBillId() {
    const year = new Date().getFullYear();
    const billId = `BILL-${year}-${String(this.counters.bill).padStart(3, '0')}`;
    const invoiceNumber = `INV-VIO-${year}-${String(this.counters.bill).padStart(4, '0')}`;
    this.counters.bill += 1;
    return { billId, invoiceNumber, toString() { return billId; } };
  }

  nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const id = `INV-VIO-${year}-${String(this.counters.bill).padStart(4, '0')}`;
    return id;
  }

  nextUserId() {
    const id = `usr-${this.counters.user}`;
    this.counters.user += 1;
    return id;
  }

  nextLinkId() {
    const id = `LNK-${Date.now()}-${String(this.counters.link).padStart(3, '0')}`;
    this.counters.link += 1;
    return id;
  }

  nextWhatsAppMessageId() {
    const id = `WAM-${Date.now()}-${String(this.counters.whatsapp).padStart(3, '0')}`;
    this.counters.whatsapp += 1;
    return id;
  }
}

// Export singleton database store instance
const dbInstance = new DatabaseStore();
module.exports = dbInstance;
