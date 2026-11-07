const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const { safeParse, safeStringify } = require('../utils/jsonUtils');
const env = require('../config/environment');

class BillingService {
  /**
   * Retrieve all bills with optional filtering
   */
  async getAllBills(filters = {}) {
    const { patientId, doctorId, paymentStatus, invoiceStatus, date } = filters;
    const where = {};

    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (paymentStatus) {
      where.paymentStatus = { equals: paymentStatus };
    }
    if (invoiceStatus) {
      where.invoiceStatus = { equals: invoiceStatus };
    }
    if (date) {
      where.createdAt = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`)
      };
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        doctor: true,
        appointment: true
      }
    });

    const populated = await Promise.all(bills.map(b => this.populateBill(b)));
    return populated;
  }

  /**
   * Retrieve a bill by billId or invoiceNumber
   */
  async getBillById(billId) {
    if (!billId) {
      throw { statusCode: 400, message: 'Bill ID or Invoice Number is required' };
    }

    const bill = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      },
      include: {
        patient: true,
        doctor: true,
        appointment: true
      }
    });

    if (!bill) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    return this.populateBill(bill);
  }

  /**
   * Calculate financial breakdown for bill items
   */
  async calculateBillAmounts({
    consultationType = 'Consultation',
    consultationFee,
    doctor,
    procedures = [],
    discount = 0,
    tax = 0,
    paid = 0,
    paymentStatus
  }) {
    let finalConsultationFee = 0;
    let docCutConsultation = 0;
    let clinicShareConsultation = 0;

    const doctorRates = typeof doctor?.consultationRates === 'string'
      ? safeParse(doctor.consultationRates, {})
      : (doctor?.consultationRates || {});

    if (consultationType === 'Consultation') {
      finalConsultationFee = consultationFee !== undefined
        ? Number(consultationFee)
        : Number(doctorRates.consultationFee || 0);

      docCutConsultation = doctorRates.doctorCut !== undefined ? Number(doctorRates.doctorCut) : 0;
      clinicShareConsultation = doctorRates.clinicShare !== undefined
        ? Number(doctorRates.clinicShare)
        : (finalConsultationFee - docCutConsultation);
    } else if (consultationType === 'Follow-up Visit (Zero Bill)' || consultationType === 'Follow-up Visit') {
      finalConsultationFee = 0;
      docCutConsultation = 0;
      clinicShareConsultation = 0;
    } else if (consultationType === 'Procedure') {
      finalConsultationFee = 0;
      docCutConsultation = 0;
      clinicShareConsultation = 0;
    }

    let procedureSubtotal = 0;
    let doctorProcedureCutsTotal = 0;
    let clinicProcedureShareTotal = 0;

    const doctorProcedureRates = typeof doctor?.procedureRates === 'string'
      ? safeParse(doctor.procedureRates, {})
      : (doctor?.procedureRates || {});

    const processedProcedures = [];

    for (const p of (procedures || [])) {
      // Find procedure in catalog by procedureId or name
      let procDef = null;
      if (p.procedureId) {
        procDef = await prisma.procedure.findUnique({ where: { procedureId: p.procedureId } });
      }
      if (!procDef && p.name && p.name.trim()) {
        procDef = await prisma.procedure.findFirst({
          where: { name: { equals: p.name.trim() } }
        });
      }

      // If procedure is not in catalog, create it
      if (!procDef && p.name && p.name.trim()) {
        const newProcId = await idGenerator.nextProcedureId();
        const priceVal = Number(p.price !== undefined ? p.price : (p.rate !== undefined ? p.rate : 0));
        const cutVal = Number(p.doctorCut !== undefined ? p.doctorCut : Math.round(priceVal * 0.3));
        procDef = await prisma.procedure.create({
          data: {
            procedureId: newProcId,
            name: p.name.trim(),
            defaultPrice: priceVal,
            defaultDoctorCut: cutVal,
            description: p.description ? p.description.trim() : '',
            status: 'Active'
          }
        });
      }

      const procedureId = procDef ? procDef.procedureId : (p.procedureId || 'CUSTOM');
      const name = p.name ? p.name.trim() : (procDef ? procDef.name : 'Procedure');
      const price = Number(p.price !== undefined ? p.price : (p.rate !== undefined ? p.rate : (procDef ? procDef.defaultPrice : 0)));
      const qty = Math.max(1, Number(p.qty || 1));
      const lineAmount = price * qty;

      const docRateOverride = doctorProcedureRates[procedureId];
      let perUnitDocCut = 0;
      if (p.doctorCut !== undefined) {
        perUnitDocCut = Number(p.doctorCut);
      } else if (docRateOverride && docRateOverride.doctorCut !== undefined) {
        perUnitDocCut = Number(docRateOverride.doctorCut);
      } else if (procDef && procDef.defaultDoctorCut !== undefined) {
        perUnitDocCut = Number(procDef.defaultDoctorCut);
      }

      const totalDocCut = perUnitDocCut * qty;
      const totalClinicShare = lineAmount - totalDocCut;

      procedureSubtotal += lineAmount;
      doctorProcedureCutsTotal += totalDocCut;
      clinicProcedureShareTotal += totalClinicShare;

      processedProcedures.push({
        procedureId,
        name,
        price,
        qty,
        doctorCut: perUnitDocCut,
        clinicShare: price - perUnitDocCut,
        amount: lineAmount
      });
    }

    const subtotal = finalConsultationFee + procedureSubtotal;
    const discountAmt = Number(discount) || 0;
    const taxAmt = Number(tax) || 0;
    const total = Math.max(0, subtotal - discountAmt + taxAmt);
    let paidAmt = Number(paid) || 0;

    if (discountAmt > 0) {
      paidAmt = Math.max(paidAmt, total);
    }

    const balance = Math.max(0, total - paidAmt);

    let calculatedStatus = paymentStatus;
    if (discountAmt > 0) {
      calculatedStatus = 'Paid';
    } else if (!calculatedStatus || calculatedStatus === 'Partially Paid') {
      if (paidAmt >= total && total > 0) {
        calculatedStatus = 'Paid';
      } else if (paidAmt > 0 && paidAmt < total) {
        calculatedStatus = 'Partially Paid';
      } else if (total === 0) {
        calculatedStatus = 'Paid';
      } else {
        calculatedStatus = 'Pending';
      }
    } else if (paidAmt >= total) {
      calculatedStatus = 'Paid';
    }

    return {
      consultationFee: finalConsultationFee,
      doctorCutConsultation: docCutConsultation,
      clinicShareConsultation: clinicShareConsultation,
      procedures: processedProcedures,
      subtotal,
      discount: discountAmt,
      tax: taxAmt,
      total,
      paid: paidAmt,
      balance,
      paymentStatus: calculatedStatus,
      doctorCutTotal: docCutConsultation + doctorProcedureCutsTotal,
      clinicShareTotal: clinicShareConsultation + clinicProcedureShareTotal
    };
  }

  /**
   * Create a new Bill and Invoice
   */
  async createBill(data, currentUser = null) {
    const {
      patientId,
      doctorId,
      appointmentId,
      consultationType = 'Consultation',
      consultationFee,
      procedures = [],
      discount = 0,
      tax = 0,
      paid = 0,
      paymentMethod = 'UPI',
      paymentStatus,
      patientUpdates
    } = data;

    if (!patientId || !doctorId) {
      throw { statusCode: 400, message: 'Patient ID and Doctor ID are required' };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Update patient contact info if provided
    if (patientUpdates && typeof patientUpdates === 'object') {
      const patientService = require('./patientService');
      const { patientId: _pId, createdAt: _cAt, ...fieldsToUpdate } = patientUpdates;
      await patientService.updatePatient(patient.patientId, fieldsToUpdate);
    }

    // CRITICAL REQUIREMENT: Do NOT create duplicate invoice if patient already has an active invoice
    const existingBill = await prisma.bill.findFirst({
      where: {
        patientId,
        invoiceStatus: { not: 'Cancelled' }
      }
    });
    if (existingBill) {
      return this.updateBill(existingBill.billId, data, currentUser);
    }

    const doctor = await prisma.doctor.findUnique({ where: { doctorId } });
    if (!doctor) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    const calculated = await this.calculateBillAmounts({
      consultationType,
      consultationFee,
      doctor,
      procedures,
      discount,
      tax,
      paid,
      paymentStatus
    });

    const { billId, invoiceNumber } = await idGenerator.nextBillId();

    const newBill = await prisma.bill.create({
      data: {
        billId,
        invoiceNumber,
        patientId,
        doctorId,
        appointmentId: appointmentId || null,
        consultationType,
        consultationFee: calculated.consultationFee,
        doctorCutConsultation: calculated.doctorCutConsultation,
        clinicShareConsultation: calculated.clinicShareConsultation,
        procedures: safeStringify(calculated.procedures),
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        tax: calculated.tax,
        total: calculated.total,
        paid: calculated.paid,
        balance: calculated.balance,
        paymentMethod,
        paymentStatus: calculated.paymentStatus,
        doctorCutTotal: calculated.doctorCutTotal,
        clinicShareTotal: calculated.clinicShareTotal,
        createdBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Front Desk'
      }
    });

    // Write audit log to SQLite
    await prisma.systemAuditLog.create({
      data: {
        action: 'BILL_GENERATED',
        resourceType: 'BILL',
        resourceId: newBill.billId,
        patientId: newBill.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Front Desk',
        userRole: currentUser?.role || 'STAFF',
        details: `Invoice ${newBill.invoiceNumber} generated for ${patient.name} (${newBill.patientId}) - Total ₹${newBill.total.toLocaleString()} (${calculated.paymentStatus})`
      }
    }).catch(err => console.error('[BillingService] Failed to write audit log:', err.message));

    return this.populateBill(newBill);
  }

  /**
   * Update payment amount and payment status on an existing bill
   */
  async updateBillPayment(billId, paymentData, currentUser = null) {
    const current = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      },
      include: { patient: true }
    });

    if (!current) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    let newPaid = Number(paymentData.paid !== undefined ? paymentData.paid : current.paid);
    const newBalance = Math.max(0, current.total - newPaid);

    let status = current.paymentStatus;
    if (Number(current.discount) > 0 || newPaid >= current.total) {
      status = 'Paid';
      if (Number(current.discount) > 0) {
        newPaid = Math.max(newPaid, current.total);
      }
    } else if (newPaid > 0 && newPaid < current.total) {
      status = 'Partially Paid';
    } else {
      status = 'Pending';
    }

    const updated = await prisma.bill.update({
      where: { billId: current.billId },
      data: {
        paid: newPaid,
        balance: newBalance,
        paymentMethod: paymentData.paymentMethod || current.paymentMethod,
        paymentStatus: paymentData.paymentStatus || status
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'BILL_EDITED',
        resourceType: 'BILL',
        resourceId: current.billId,
        patientId: current.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Staff',
        userRole: currentUser?.role || 'STAFF',
        details: `Payment updated for ${current.invoiceNumber}: Paid ₹${newPaid.toLocaleString()}, Balance ₹${newBalance.toLocaleString()}, Status: ${status}`
      }
    }).catch(err => console.error('[BillingService] Failed to write audit log:', err.message));

    return this.populateBill(updated);
  }

  /**
   * Update full bill details
   */
  async updateBill(billId, updateData, currentUser = null) {
    const current = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      },
      include: { patient: true }
    });

    if (!current) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    if (updateData.patientUpdates && typeof updateData.patientUpdates === 'object') {
      const patientService = require('./patientService');
      const { patientId: _pId, createdAt: _cAt, ...fieldsToUpdate } = updateData.patientUpdates;
      await patientService.updatePatient(current.patientId, fieldsToUpdate);
    }

    const doctorId = updateData.doctorId || current.doctorId;
    const doctor = await prisma.doctor.findUnique({ where: { doctorId } });

    const discountVal = updateData.discount !== undefined
      ? Number(updateData.discount)
      : (Number(current.discount) || 0);
    const isDiscountAdded = discountVal > 0;

    const currentProcedures = typeof current.procedures === 'string'
      ? safeParse(current.procedures, [])
      : (current.procedures || []);

    const calculated = await this.calculateBillAmounts({
      consultationType: updateData.consultationType !== undefined ? updateData.consultationType : current.consultationType,
      consultationFee: updateData.consultationFee !== undefined ? updateData.consultationFee : current.consultationFee,
      doctor,
      procedures: updateData.procedures !== undefined ? updateData.procedures : currentProcedures,
      discount: discountVal,
      tax: updateData.tax !== undefined ? updateData.tax : current.tax,
      paid: updateData.paid !== undefined ? updateData.paid : current.paid,
      paymentStatus: isDiscountAdded ? 'Paid' : (updateData.paymentStatus || current.paymentStatus)
    });

    const updated = await prisma.bill.update({
      where: { billId: current.billId },
      data: {
        doctorId,
        consultationType: updateData.consultationType || current.consultationType,
        consultationFee: calculated.consultationFee,
        doctorCutConsultation: calculated.doctorCutConsultation,
        clinicShareConsultation: calculated.clinicShareConsultation,
        procedures: safeStringify(calculated.procedures),
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        tax: calculated.tax,
        total: calculated.total,
        paid: calculated.paid,
        balance: calculated.balance,
        paymentMethod: updateData.paymentMethod || current.paymentMethod,
        paymentStatus: calculated.paymentStatus,
        invoiceStatus: updateData.invoiceStatus || updateData.status || current.invoiceStatus || 'Active',
        doctorCutTotal: calculated.doctorCutTotal,
        clinicShareTotal: calculated.clinicShareTotal
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'BILL_EDITED',
        resourceType: 'BILL',
        resourceId: current.billId,
        patientId: current.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Staff',
        userRole: currentUser?.role || 'STAFF',
        details: `Bill ${current.invoiceNumber} updated: Total ₹${calculated.total.toLocaleString()}, Paid ₹${calculated.paid.toLocaleString()}, Status: ${calculated.paymentStatus}`
      }
    }).catch(err => console.error('[BillingService] Failed to write audit log:', err.message));

    return this.populateBill(updated);
  }

  /**
   * Soft Delete / Cancel Invoice (preserves historical records and foreign key integrity)
   */
  async deleteBill(billId, currentUser = null) {
    const current = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      },
      include: { patient: true }
    });

    if (!current) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    // Soft delete: update invoice lifecycle status to 'Cancelled' (preserves paymentStatus and financial values)
    await prisma.bill.update({
      where: { billId: current.billId },
      data: {
        invoiceStatus: 'Cancelled'
      }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'BILL_CANCELLED',
        resourceType: 'BILL',
        resourceId: current.billId,
        patientId: current.patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Admin',
        userRole: currentUser?.role || 'ADMIN',
        details: `Cancelled invoice ${current.invoiceNumber} (Total ₹${current.total.toLocaleString()})`
      }
    }).catch(err => console.error('[BillingService] Failed to write audit log:', err.message));

    return {
      billId: current.billId,
      invoiceNumber: current.invoiceNumber,
      message: `Invoice ${current.invoiceNumber} cancelled successfully`
    };
  }

  /**
   * Permanently delete a voided/cancelled invoice from the database
   * STRICT: Only ADMIN role allowed
   * STRICT: Only invoices with invoiceStatus === 'Cancelled' can be deleted
   * Prevents accidental deletion of active, paid, or pending invoices
   */
  async permanentlyDeleteBill(billId, currentUser = null, reason = '') {
    // 1. Role validation (defense-in-depth)
    if (!currentUser || currentUser.role !== 'ADMIN') {
      throw {
        statusCode: 403,
        message: 'Access denied. Only administrators can permanently delete voided invoices.'
      };
    }

    // 2. Fetch bill to verify status
    const current = await prisma.bill.findFirst({
      where: {
        OR: [
          { billId },
          { invoiceNumber: billId }
        ]
      }
    });

    if (!current) {
      throw { statusCode: 404, message: 'Invoice not found' };
    }

    // 3. Strict invoiceStatus check: ONLY CANCELLED INVOICES
    if (current.invoiceStatus !== 'Cancelled') {
      throw {
        statusCode: 400,
        message: `Cannot permanently delete invoice "${current.invoiceNumber}". Only cancelled/voided invoices can be permanently deleted. Active, paid, or pending invoices must first be cancelled through the cancellation workflow.`
      };
    }

    const paidAmount = Number(current.paid) || 0;
    const totalAmount = Number(current.total) || 0;
    const invoiceNumber = current.invoiceNumber;
    const patientId = current.patientId;
    const paymentMethod = current.paymentMethod || 'N/A';

    // 4. Atomic deletion within transaction
    return await prisma.$transaction(async (tx) => {
      // 4a. Detach WhatsApp messages referencing this bill (prevents FK constraint violation while preserving message log)
      await tx.whatsAppMessage.updateMany({
        where: { billId: current.billId },
        data: { billId: null }
      });

      // 4b. Purge bill access links (secure UUID tokens)
      await tx.billAccessLink.deleteMany({
        where: { billId: current.billId }
      });

      // 4c. Delete the bill permanently from the database
      await tx.bill.delete({
        where: { billId: current.billId }
      });

      // 4d. Create immutable system audit log without unnecessary medical info
      const auditDetails = `Permanently deleted voided invoice ${invoiceNumber} (Patient: ${patientId}, Original Amount: ₹${totalAmount.toLocaleString()}, Associated Payment Removed: ₹${paidAmount.toLocaleString()}, Method: ${paymentMethod}${reason ? `, Reason: ${reason}` : ''}). Ledger adjusted.`;

      await tx.systemAuditLog.create({
        data: {
          action: 'BILL_PERMANENTLY_DELETED',
          resourceType: 'BILL',
          resourceId: invoiceNumber,
          patientId,
          userId: currentUser.id || currentUser.userId || 'admin',
          userName: currentUser.name || currentUser.username || 'Admin',
          userRole: 'ADMIN',
          details: auditDetails
        }
      });

      return {
        billId: current.billId,
        invoiceNumber,
        deletedPaidAmount: paidAmount,
        deletedTotalAmount: totalAmount,
        message: `Invoice ${invoiceNumber} permanently deleted from database and ledger adjusted`
      };
    });
  }

  /**
   * Soft Cancel all bills for a patient
   */
  async deletePatientTotalBills(patientId, currentUser = null) {
    const patientBills = await prisma.bill.findMany({
      where: { patientId }
    });

    if (patientBills.length === 0) {
      throw { statusCode: 404, message: `No bills found for patient ${patientId}` };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId } });
    const count = patientBills.length;
    const totalAmount = patientBills.reduce((acc, b) => acc + (b.total || 0), 0);

    await prisma.bill.updateMany({
      where: { patientId },
      data: { invoiceStatus: 'Cancelled' }
    });

    await prisma.systemAuditLog.create({
      data: {
        action: 'BILL_PATIENT_BILLS_CANCELLED',
        resourceType: 'BILL',
        patientId,
        userId: currentUser?.userId || currentUser?.id || null,
        userName: currentUser?.name || currentUser?.username || 'Admin',
        userRole: currentUser?.role || 'ADMIN',
        details: `Admin cancelled all ${count} bill(s) totaling ₹${totalAmount.toLocaleString()} for patient ${patient ? patient.name : patientId}`
      }
    }).catch(err => console.error('[BillingService] Failed to write audit log:', err.message));

    return {
      patientId,
      cancelledCount: count,
      deletedCount: count, // Maintained for backward compatibility
      totalAmount,
      message: `Successfully cancelled all ${count} bill(s) (₹${totalAmount.toLocaleString()}) for patient ${patient ? patient.name : patientId}`
    };
  }

  /**
   * Get billing audit logs directly from SQLite
   */
  async getBillingLogs() {
    const logs = await prisma.systemAuditLog.findMany({
      where: { resourceType: 'BILL' },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return logs.map(l => ({
      logId: l.id,
      action: l.action.replace(/^BILL_/, ''),
      billId: l.resourceId,
      invoiceNumber: l.resourceId,
      patientId: l.patientId,
      details: l.details,
      performedBy: `${l.userName} (${l.userRole})`,
      timestamp: l.createdAt
    }));
  }

  /**
   * Populate bill record with patient, doctor, appointment, consultation, prescription, clinic, and link data
   */
  async populateBill(bill) {
    if (!bill) return null;

    const patient = bill.patient || await prisma.patient.findUnique({ where: { patientId: bill.patientId } });
    const doctor = bill.doctor || await prisma.doctor.findUnique({ where: { doctorId: bill.doctorId } });
    const appointment = bill.appointment || (bill.appointmentId ? await prisma.appointment.findUnique({ where: { appointmentId: bill.appointmentId } }) : null);

    let consultation = null;
    if (bill.appointmentId) {
      consultation = await prisma.consultation.findFirst({
        where: { appointmentId: bill.appointmentId },
        include: { prescription: true }
      });
    }
    if (!consultation && bill.patientId && bill.doctorId) {
      const dateStr = (bill.createdAt ? new Date(bill.createdAt) : new Date()).toISOString().split('T')[0];
      consultation = await prisma.consultation.findFirst({
        where: {
          patientId: bill.patientId,
          doctorId: bill.doctorId,
          createdAt: {
            gte: new Date(`${dateStr}T00:00:00.000Z`),
            lte: new Date(`${dateStr}T23:59:59.999Z`)
          }
        },
        include: { prescription: true }
      });
    }

    const prescription = consultation?.prescription || null;

    const linkService = require('./linkService');
    const links = await linkService.getLinksForBill(bill.billId);
    const now = new Date();
    const activeLink = links.find(l => l.status === 'Active' && new Date(l.expiresAt) > now) || null;

    const whatsappMessages = await prisma.whatsAppMessage.findMany({
      where: { billId: bill.billId },
      orderBy: { createdAt: 'desc' }
    });
    const latestWhatsApp = whatsappMessages[0] || null;

    const clinicProfile = await prisma.clinicProfile.findFirst();

    const procedures = typeof bill.procedures === 'string'
      ? safeParse(bill.procedures, [])
      : (bill.procedures || []);

    return {
      ...bill,
      invoiceStatus: bill.invoiceStatus || 'Active',
      status: bill.invoiceStatus || 'Active',
      procedures,
      createdAt: bill.createdAt instanceof Date ? bill.createdAt.toISOString() : bill.createdAt,
      updatedAt: bill.updatedAt instanceof Date ? bill.updatedAt.toISOString() : bill.updatedAt,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientWhatsappNumber: patient ? (patient.whatsappNumber || patient.phone) : null,
      patientWhatsappConsent: patient ? Boolean(patient.whatsappConsent) : true,
      patientAddress: patient ? `${patient.address || ''}, ${patient.city || ''}` : '',
      patientDOB: patient ? patient.dateOfBirth : null,
      allergies: patient ? patient.allergies : 'None',
      medicalHistory: patient ? patient.medicalHistory : 'None',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorQualification: doctor ? doctor.qualification : '',
      doctorRegNo: doctor ? doctor.registrationNumber : '',
      appointmentDate: appointment ? appointment.date : null,
      appointmentTime: appointment ? appointment.time : null,
      consultation: consultation || null,
      prescription: prescription || null,
      clinic: clinicProfile,
      activeLink,
      links,
      whatsappMessage: latestWhatsApp
    };
  }

  /**
   * Combined Connected Flow helper for Front Desk
   */
  async registerAndBill(data, currentUser) {
    const { patient, appointment, bill } = data;

    let patientRecord = null;
    if (patient.patientId) {
      patientRecord = await prisma.patient.findUnique({ where: { patientId: patient.patientId } });
    }
    if (!patientRecord && patient.phone) {
      const trimmedPhone = patient.phone.trim();
      patientRecord = await prisma.patient.findFirst({ where: { phone: trimmedPhone } });
    }

    const patientService = require('./patientService');
    if (patientRecord) {
      const { patientId: _pId, createdAt: _cAt, ...updateData } = patient;
      patientRecord = await patientService.updatePatient(patientRecord.patientId, updateData);
    } else {
      patientRecord = await patientService.createPatient(patient);
    }

    const appointmentService = require('./appointmentService');
    const appointmentRecord = await appointmentService.createAppointment({
      ...appointment,
      patientId: patientRecord.patientId
    }, currentUser);

    const billRecord = await this.createBill({
      ...bill,
      patientId: patientRecord.patientId,
      doctorId: appointmentRecord.doctorId,
      appointmentId: appointmentRecord.appointmentId,
      consultationType: appointmentRecord.appointmentType
    }, currentUser);

    return {
      patient: patientRecord,
      appointment: appointmentRecord,
      bill: billRecord,
      invoiceNumber: billRecord.invoiceNumber
    };
  }
}

module.exports = new BillingService();
