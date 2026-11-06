const prisma = require('../config/prisma');

class IdGenerator {
  constructor(customPrisma) {
    this.customPrisma = customPrisma;
    this.initializedSequences = new Set();
  }

  get prismaClient() {
    return this.customPrisma || prisma;
  }

  /**
   * Executes an asynchronous operation with exponential backoff and jitter for SQLite concurrency.
   */
  async withRetry(operation, maxRetries = 25, baseDelay = 10) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        const msg = err && err.message ? err.message : '';
        const isLock = msg.includes('SQLITE_BUSY') ||
                       msg.includes('database is locked') ||
                       msg.includes('timed out') ||
                       msg.includes('P2034') ||
                       msg.includes('P2028');
        if (isLock && attempt < maxRetries - 1) {
          const jitter = Math.floor(Math.random() * 25);
          await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1) + jitter));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Ensures the sequence counter row exists in `id_sequences`.
   * Only scans existing table records if sequence is uninitialized.
   */
  async ensureInitialized(name, fallbackInitFn) {
    if (this.initializedSequences.has(name)) return;

    try {
      const existing = await this.prismaClient.idSequence.findUnique({ where: { name } });
      if (existing) {
        this.initializedSequences.add(name);
        return;
      }
    } catch {}

    const startVal = await fallbackInitFn();
    await this.prismaClient.$executeRawUnsafe(
      `INSERT OR IGNORE INTO id_sequences (name, currentVal, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP);`,
      name,
      startVal
    );
    this.initializedSequences.add(name);
  }

  /**
   * Atomically increments and returns the next value for the given sequence.
   */
  async reserveNextValue(name, fallbackInitFn) {
    return await this.withRetry(async () => {
      await this.ensureInitialized(name, fallbackInitFn);

      const rows = await this.prismaClient.$queryRawUnsafe(
        `UPDATE id_sequences SET currentVal = currentVal + 1, updatedAt = CURRENT_TIMESTAMP WHERE name = ? RETURNING currentVal;`,
        name
      );

      if (!rows || rows.length === 0) {
        // Fallback: If no row returned (e.g. edge case where row wasn't present), re-ensure and query
        this.initializedSequences.delete(name);
        await this.ensureInitialized(name, fallbackInitFn);
        const retryRows = await this.prismaClient.$queryRawUnsafe(
          `UPDATE id_sequences SET currentVal = currentVal + 1, updatedAt = CURRENT_TIMESTAMP WHERE name = ? RETURNING currentVal;`,
          name
        );
        if (!retryRows || retryRows.length === 0) {
          throw new Error(`Failed to atomically reserve counter for sequence: ${name}`);
        }
        return Number(retryRows[0].currentVal);
      }

      return Number(rows[0].currentVal);
    });
  }

  /**
   * Preview next sequential patient ID without consuming it
   */
  async peekNextPatientId() {
    await this.ensureInitialized('PAT', async () => {
      const patients = await this.prismaClient.patient.findMany({ select: { patientId: true } });
      let maxNum = 1000;
      for (const p of patients) {
        const match = p.patientId && p.patientId.match(/^PAT-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });

    const seq = await this.prismaClient.idSequence.findUnique({ where: { name: 'PAT' } });
    const currentVal = seq ? seq.currentVal : 1000;
    return `PAT-${currentVal + 1}`;
  }

  /**
   * Generate next sequential patient ID atomically
   */
  async nextPatientId() {
    const val = await this.reserveNextValue('PAT', async () => {
      const patients = await this.prismaClient.patient.findMany({ select: { patientId: true } });
      let maxNum = 1000;
      for (const p of patients) {
        const match = p.patientId && p.patientId.match(/^PAT-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `PAT-${val}`;
  }

  /**
   * Generate next sequential doctor ID atomically
   */
  async nextDoctorId() {
    const val = await this.reserveNextValue('DOC', async () => {
      const doctors = await this.prismaClient.doctor.findMany({ select: { doctorId: true } });
      let maxNum = 100;
      for (const d of doctors) {
        const match = d.doctorId && d.doctorId.match(/^DOC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `DOC-${val}`;
  }

  /**
   * Generate next sequential staff ID atomically
   */
  async nextStaffId() {
    const val = await this.reserveNextValue('STF', async () => {
      const staff = await this.prismaClient.staff.findMany({ select: { staffId: true } });
      let maxNum = 200;
      for (const s of staff) {
        const match = s.staffId && s.staffId.match(/^STF-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `STF-${val}`;
  }

  /**
   * Generate next sequential procedure ID atomically
   */
  async nextProcedureId() {
    const val = await this.reserveNextValue('PROC', async () => {
      const procs = await this.prismaClient.procedure.findMany({ select: { procedureId: true } });
      let maxNum = 0;
      for (const p of procs) {
        const match = p.procedureId && p.procedureId.match(/^PROC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `PROC-${String(val).padStart(3, '0')}`;
  }

  /**
   * Generate next sequential appointment ID atomically
   */
  async nextAppointmentId() {
    const year = new Date().getFullYear();
    const val = await this.reserveNextValue('APT', async () => {
      const apts = await this.prismaClient.appointment.findMany({
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
      return maxNum;
    });
    return `APT-${year}-${String(val).padStart(3, '0')}`;
  }

  /**
   * Generate next sequential consultation ID atomically
   */
  async nextConsultationId() {
    const val = await this.reserveNextValue('CNS', async () => {
      const consultations = await this.prismaClient.consultation.findMany({ select: { consultationId: true } });
      let maxNum = 1000;
      for (const c of consultations) {
        const match = c.consultationId && c.consultationId.match(/^CNS-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `CNS-${val}`;
  }

  /**
   * Generate next sequential prescription ID atomically
   */
  async nextPrescriptionId() {
    const val = await this.reserveNextValue('RX', async () => {
      const prescriptions = await this.prismaClient.prescription.findMany({ select: { prescriptionId: true } });
      let maxNum = 1000;
      for (const p of prescriptions) {
        const match = p.prescriptionId && p.prescriptionId.match(/^RX-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `RX-${val}`;
  }

  /**
   * Generate next sequential bill ID and invoice number atomically
   */
  async nextBillId() {
    const year = new Date().getFullYear();
    const [billVal, invVal] = await Promise.all([
      this.reserveNextValue('BILL', async () => {
        const bills = await this.prismaClient.bill.findMany({
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
        return maxNum;
      }),
      this.reserveNextValue('INV', async () => {
        const bills = await this.prismaClient.bill.findMany({
          where: { invoiceNumber: { startsWith: `INV-VIO-${year}-` } },
          select: { invoiceNumber: true }
        });
        let maxNum = 0;
        const regex = new RegExp(`^INV-VIO-${year}-(\\d+)$`, 'i');
        for (const b of bills) {
          const match = b.invoiceNumber && b.invoiceNumber.match(regex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
        return maxNum;
      })
    ]);

    const billId = `BILL-${year}-${String(billVal).padStart(3, '0')}`;
    const invoiceNumber = `INV-VIO-${year}-${String(invVal).padStart(4, '0')}`;
    return { billId, invoiceNumber, toString() { return billId; } };
  }

  /**
   * Generate next sequential invoice number atomically
   */
  async nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const invVal = await this.reserveNextValue('INV', async () => {
      const bills = await this.prismaClient.bill.findMany({
        where: { invoiceNumber: { startsWith: `INV-VIO-${year}-` } },
        select: { invoiceNumber: true }
      });
      let maxNum = 0;
      const regex = new RegExp(`^INV-VIO-${year}-(\\d+)$`, 'i');
      for (const b of bills) {
        const match = b.invoiceNumber && b.invoiceNumber.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return maxNum;
    });
    return `INV-VIO-${year}-${String(invVal).padStart(4, '0')}`;
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

const defaultGenerator = new IdGenerator();
defaultGenerator.IdGenerator = IdGenerator;
module.exports = defaultGenerator;
