const prisma = require('../config/prisma');

class IdGenerator {
  /**
   * Preview next sequential patient ID without consuming it
   */
  async peekNextPatientId() {
    const patients = await prisma.patient.findMany({ select: { patientId: true } });
    let maxNum = 1000;
    for (const p of patients) {
      const match = p.patientId && p.patientId.match(/^PAT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `PAT-${maxNum + 1}`;
  }

  /**
   * Generate next sequential patient ID from SQLite
   */
  async nextPatientId() {
    return this.peekNextPatientId();
  }

  /**
   * Generate next sequential doctor ID from SQLite
   */
  async nextDoctorId() {
    const doctors = await prisma.doctor.findMany({ select: { doctorId: true } });
    let maxNum = 100;
    for (const d of doctors) {
      const match = d.doctorId && d.doctorId.match(/^DOC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `DOC-${maxNum + 1}`;
  }

  /**
   * Generate next sequential staff ID from SQLite
   */
  async nextStaffId() {
    const staff = await prisma.staff.findMany({ select: { staffId: true } });
    let maxNum = 200;
    for (const s of staff) {
      const match = s.staffId && s.staffId.match(/^STF-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `STF-${maxNum + 1}`;
  }

  /**
   * Generate next sequential procedure ID from SQLite
   */
  async nextProcedureId() {
    const procs = await prisma.procedure.findMany({ select: { procedureId: true } });
    let maxNum = 0;
    for (const p of procs) {
      const match = p.procedureId && p.procedureId.match(/^PROC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `PROC-${String(maxNum + 1).padStart(3, '0')}`;
  }

  /**
   * Generate next sequential appointment ID for the current year
   */
  async nextAppointmentId() {
    const year = new Date().getFullYear();
    const apts = await prisma.appointment.findMany({
      where: { appointmentId: { startsWith: `APT-${year}-` } },
      select: { appointmentId: true }
    });
    let maxNum = 0;
    const regex = new RegExp(`^APT-${year}-(\\d+)$`, 'i');
    for (const a of apts) {
      const match = a.appointmentId && a.appointmentId.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `APT-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  /**
   * Generate next sequential consultation ID from SQLite
   */
  async nextConsultationId() {
    const consultations = await prisma.consultation.findMany({ select: { consultationId: true } });
    let maxNum = 1000;
    for (const c of consultations) {
      const match = c.consultationId && c.consultationId.match(/^CNS-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `CNS-${maxNum + 1}`;
  }

  /**
   * Generate next sequential prescription ID from SQLite
   */
  async nextPrescriptionId() {
    const prescriptions = await prisma.prescription.findMany({ select: { prescriptionId: true } });
    let maxNum = 1000;
    for (const p of prescriptions) {
      const match = p.prescriptionId && p.prescriptionId.match(/^RX-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return `RX-${maxNum + 1}`;
  }

  /**
   * Generate next sequential bill ID and invoice number
   */
  async nextBillId() {
    const year = new Date().getFullYear();
    const bills = await prisma.bill.findMany({
      where: { billId: { startsWith: `BILL-${year}-` } },
      select: { billId: true }
    });
    let maxNum = 0;
    const regex = new RegExp(`^BILL-${year}-(\\d+)$`, 'i');
    for (const b of bills) {
      const match = b.billId && b.billId.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    const billId = `BILL-${year}-${String(nextNum).padStart(3, '0')}`;
    const invoiceNumber = `INV-VIO-${year}-${String(nextNum).padStart(4, '0')}`;
    return { billId, invoiceNumber, toString() { return billId; } };
  }

  /**
   * Generate next sequential invoice number
   */
  async nextInvoiceNumber() {
    const { invoiceNumber } = await this.nextBillId();
    return invoiceNumber;
  }

  /**
   * Unique link ID
   */
  nextLinkId() {
    return `LNK-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  /**
   * Unique WhatsApp Message ID
   */
  nextWhatsAppMessageId() {
    return `WAM-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  /**
   * Unique User ID
   */
  nextUserId(prefix = 'usr') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

module.exports = new IdGenerator();
