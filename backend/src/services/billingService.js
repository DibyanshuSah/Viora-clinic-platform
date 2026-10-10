const db = require('../config/database');

class BillingService {
  getAllBills(filters = {}) {
    const { patientId, doctorId, paymentStatus, date } = filters;
    let list = [...db.bills];

    if (patientId) {
      list = list.filter(b => b.patientId === patientId);
    }
    if (doctorId) {
      list = list.filter(b => b.doctorId === doctorId);
    }
    if (paymentStatus) {
      list = list.filter(b => b.paymentStatus.toLowerCase() === paymentStatus.toLowerCase());
    }
    if (date) {
      list = list.filter(b => b.createdAt.startsWith(date));
    }

    return list.map(b => this.populateBill(b)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getBillById(billId) {
    const bill = db.bills.find(b => b.billId === billId || b.invoiceNumber === billId);
    if (!bill) {
      throw { statusCode: 404, message: 'Bill not found' };
    }
    return this.populateBill(bill);
  }

  calculateBillAmounts({
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

    if (consultationType === 'Consultation') {
      finalConsultationFee = consultationFee !== undefined
        ? Number(consultationFee)
        : Number(doctor?.consultationRates?.consultationFee || 0);
      
      docCutConsultation = doctor?.consultationRates?.doctorCut || 0;
      clinicShareConsultation = doctor?.consultationRates?.clinicShare || (finalConsultationFee - docCutConsultation);
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

    const processedProcedures = (procedures || []).map(p => {
      // Find procedure in db.procedures by procedureId or by trimmed name
      let procDef = db.procedures.find(pr =>
        (p.procedureId && pr.procedureId === p.procedureId) ||
        (p.name && pr.name && pr.name.trim().toLowerCase() === p.name.trim().toLowerCase())
      );

      // If procedure is not yet in the DB catalog, store it in the DB now
      if (!procDef && p.name && p.name.trim()) {
        const newProcId = db.nextProcedureId();
        procDef = {
          procedureId: newProcId,
          name: p.name.trim(),
          defaultPrice: Number(p.price !== undefined ? p.price : (p.rate !== undefined ? p.rate : 0)),
          defaultDoctorCut: Number(p.doctorCut !== undefined ? p.doctorCut : Math.round(Number(p.price || p.rate || 0) * 0.3)),
          description: p.description ? p.description.trim() : '',
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.procedures.push(procDef);
      }

      const procedureId = procDef ? procDef.procedureId : (p.procedureId || 'CUSTOM');
      const name = p.name ? p.name.trim() : (procDef ? procDef.name : 'Procedure');
      const price = Number(p.price !== undefined ? p.price : (p.rate !== undefined ? p.rate : (procDef ? procDef.defaultPrice : 0)));
      const qty = Math.max(1, Number(p.qty || 1));
      const lineAmount = price * qty;

      const docRateOverride = doctor?.procedureRates && doctor.procedureRates[procedureId];
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

      return {
        procedureId,
        name,
        price,
        qty,
        doctorCut: perUnitDocCut,
        clinicShare: price - perUnitDocCut,
        amount: lineAmount
      };
    });

    const subtotal = finalConsultationFee + procedureSubtotal;
    const discountAmt = Number(discount) || 0;
    const taxAmt = Number(tax) || 0;
    const total = Math.max(0, subtotal - discountAmt + taxAmt);
    const paidAmt = Number(paid) || 0;
    const balance = Math.max(0, total - paidAmt);

    let calculatedStatus = paymentStatus;
    if (!calculatedStatus) {
      if (paidAmt >= total && total > 0) {
        calculatedStatus = 'Paid';
      } else if (paidAmt > 0 && paidAmt < total) {
        calculatedStatus = 'Partially Paid';
      } else if (total === 0) {
        calculatedStatus = 'Paid';
      } else {
        calculatedStatus = 'Pending';
      }
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

  createBill(data, currentUser = null) {
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

    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Update existing patient billing/contact info if provided
    if (patientUpdates && typeof patientUpdates === 'object') {
      const patientService = require('./patientService');
      const { patientId: _pId, createdAt: _cAt, ...fieldsToUpdate } = patientUpdates;
      patientService.updatePatient(patient.patientId, fieldsToUpdate);
    }

    // CRITICAL REQUIREMENT: Do NOT create a new invoice for the same patient!
    // If patient already has an existing invoice, delegate to edit/update that existing invoice!
    const existingBill = db.bills.find(b => b.patientId === patientId);
    if (existingBill) {
      return this.updateBill(existingBill.billId, data, currentUser);
    }

    const doctor = db.doctors.find(d => d.doctorId === doctorId);
    if (!doctor) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    const calculated = this.calculateBillAmounts({
      consultationType,
      consultationFee,
      doctor,
      procedures,
      discount,
      tax,
      paid,
      paymentStatus
    });

    const { billId, invoiceNumber } = db.nextBillId();

    const newBill = {
      billId,
      invoiceNumber,
      patientId,
      doctorId,
      appointmentId: appointmentId || null,
      consultationType,
      consultationFee: calculated.consultationFee,
      doctorCutConsultation: calculated.doctorCutConsultation,
      clinicShareConsultation: calculated.clinicShareConsultation,
      procedures: calculated.procedures,
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
      createdBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Front Desk',
      createdAt: new Date().toISOString()
    };

    db.bills.push(newBill);

    // Audit log
    db.logBillingAction({
      action: 'GENERATED',
      billId: newBill.billId,
      invoiceNumber: newBill.invoiceNumber,
      patientId: newBill.patientId,
      patientName: patient.name,
      total: newBill.total,
      details: `Invoice ${newBill.invoiceNumber} generated for ${patient.name} (${newBill.patientId}) - Total ₹${newBill.total.toLocaleString()} (${calculated.paymentStatus})`,
      user: currentUser
    });

    return this.populateBill(newBill);
  }

  updateBillPayment(billId, paymentData, currentUser = null) {
    const index = db.bills.findIndex(b => b.billId === billId || b.invoiceNumber === billId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    const current = db.bills[index];
    const patient = db.patients.find(p => p.patientId === current.patientId);
    const newPaid = Number(paymentData.paid !== undefined ? paymentData.paid : current.paid);
    const newBalance = Math.max(0, current.total - newPaid);
    
    let status = current.paymentStatus;
    if (newPaid >= current.total) {
      status = 'Paid';
    } else if (newPaid > 0 && newPaid < current.total) {
      status = 'Partially Paid';
    } else {
      status = 'Pending';
    }

    db.bills[index] = {
      ...current,
      paid: newPaid,
      balance: newBalance,
      paymentMethod: paymentData.paymentMethod || current.paymentMethod,
      paymentStatus: paymentData.paymentStatus || status,
      updatedAt: new Date().toISOString()
    };

    // Audit log
    db.logBillingAction({
      action: 'EDITED',
      billId: current.billId,
      invoiceNumber: current.invoiceNumber,
      patientId: current.patientId,
      patientName: patient ? patient.name : 'Unknown Patient',
      total: current.total,
      details: `Payment updated for ${current.invoiceNumber}: Paid ₹${newPaid.toLocaleString()}, Balance ₹${newBalance.toLocaleString()}, Status: ${status}`,
      user: currentUser
    });

    return this.populateBill(db.bills[index]);
  }

  updateBill(billId, updateData, currentUser = null) {
    const index = db.bills.findIndex(b => b.billId === billId || b.invoiceNumber === billId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    const current = db.bills[index];
    const patient = db.patients.find(p => p.patientId === current.patientId);

    // Update patient details if provided
    if (updateData.patientUpdates && typeof updateData.patientUpdates === 'object') {
      const patientService = require('./patientService');
      const { patientId: _pId, createdAt: _cAt, ...fieldsToUpdate } = updateData.patientUpdates;
      patientService.updatePatient(current.patientId, fieldsToUpdate);
    }

    const doctorId = updateData.doctorId || current.doctorId;
    const doctor = db.doctors.find(d => d.doctorId === doctorId);

    const calculated = this.calculateBillAmounts({
      consultationType: updateData.consultationType !== undefined ? updateData.consultationType : current.consultationType,
      consultationFee: updateData.consultationFee !== undefined ? updateData.consultationFee : current.consultationFee,
      doctor,
      procedures: updateData.procedures !== undefined ? updateData.procedures : current.procedures,
      discount: updateData.discount !== undefined ? updateData.discount : current.discount,
      tax: updateData.tax !== undefined ? updateData.tax : current.tax,
      paid: updateData.paid !== undefined ? updateData.paid : current.paid,
      paymentStatus: updateData.paymentStatus || current.paymentStatus
    });

    db.bills[index] = {
      ...current,
      ...updateData,
      billId: current.billId,
      invoiceNumber: current.invoiceNumber,
      patientId: current.patientId,
      doctorId,
      consultationType: updateData.consultationType || current.consultationType,
      consultationFee: calculated.consultationFee,
      doctorCutConsultation: calculated.doctorCutConsultation,
      clinicShareConsultation: calculated.clinicShareConsultation,
      procedures: calculated.procedures,
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      tax: calculated.tax,
      total: calculated.total,
      paid: calculated.paid,
      balance: calculated.balance,
      paymentMethod: updateData.paymentMethod || current.paymentMethod,
      paymentStatus: calculated.paymentStatus,
      doctorCutTotal: calculated.doctorCutTotal,
      clinicShareTotal: calculated.clinicShareTotal,
      updatedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : (current.updatedBy || 'Staff'),
      updatedAt: new Date().toISOString()
    };

    db.logBillingAction({
      action: 'EDITED',
      billId: current.billId,
      invoiceNumber: current.invoiceNumber,
      patientId: current.patientId,
      patientName: patient ? patient.name : 'Unknown Patient',
      total: calculated.total,
      details: `Bill ${current.invoiceNumber} details updated for ${patient ? patient.name : current.patientId}: Total ₹${calculated.total.toLocaleString()}, Paid ₹${calculated.paid.toLocaleString()}, Status: ${calculated.paymentStatus}`,
      user: currentUser
    });

    return this.populateBill(db.bills[index]);
  }

  deleteBill(billId, currentUser = null) {
    const index = db.bills.findIndex(b => b.billId === billId || b.invoiceNumber === billId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    const bill = db.bills[index];
    const patient = db.patients.find(p => p.patientId === bill.patientId);

    // Remove bill from database
    db.bills.splice(index, 1);

    // Audit log
    db.logBillingAction({
      action: 'DELETED',
      billId: bill.billId,
      invoiceNumber: bill.invoiceNumber,
      patientId: bill.patientId,
      patientName: patient ? patient.name : 'Unknown Patient',
      total: bill.total,
      details: `Deleted invoice ${bill.invoiceNumber} (Total ₹${bill.total.toLocaleString()}) from system`,
      user: currentUser
    });

    return {
      billId: bill.billId,
      invoiceNumber: bill.invoiceNumber,
      message: `Invoice ${bill.invoiceNumber} deleted successfully`
    };
  }

  deletePatientTotalBills(patientId, currentUser = null) {
    const patientBills = db.bills.filter(b => b.patientId === patientId);
    if (patientBills.length === 0) {
      throw { statusCode: 404, message: `No bills found for patient ${patientId}` };
    }

    const patient = db.patients.find(p => p.patientId === patientId);
    const count = patientBills.length;
    const totalAmount = patientBills.reduce((acc, b) => acc + (b.total || 0), 0);

    // Delete all bills for this patient
    db.bills = db.bills.filter(b => b.patientId !== patientId);

    // Audit log
    db.logBillingAction({
      action: 'PATIENT_BILLS_DELETED',
      billId: null,
      invoiceNumber: null,
      patientId,
      patientName: patient ? patient.name : 'Unknown Patient',
      total: totalAmount,
      details: `Admin deleted all ${count} bill(s) totaling ₹${totalAmount.toLocaleString()} from the system for patient ${patient ? patient.name : patientId}`,
      user: currentUser
    });

    return {
      patientId,
      deletedCount: count,
      totalAmount,
      message: `Successfully deleted all ${count} bill(s) (₹${totalAmount.toLocaleString()}) for patient ${patient ? patient.name : patientId}`
    };
  }

  getBillingLogs() {
    return [...db.billingLogs];
  }

  populateBill(bill) {
    const patient = db.patients.find(p => p.patientId === bill.patientId);
    const doctor = db.doctors.find(d => d.doctorId === bill.doctorId);
    const appointment = db.appointments.find(a => a.appointmentId === bill.appointmentId);
    const consultation = db.consultations.find(c => c.appointmentId === bill.appointmentId || (c.patientId === bill.patientId && c.doctorId === bill.doctorId && c.createdAt?.startsWith(bill.createdAt?.split('T')[0])));
    const prescription = consultation?.prescriptionId ? db.prescriptions.find(pr => pr.prescriptionId === consultation.prescriptionId) : null;

    return {
      ...bill,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientAddress: patient ? `${patient.address}, ${patient.city}` : '',
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
      clinic: db.clinicProfile
    };
  }

  // Combined Connected Flow helper for Front Desk
  registerAndBill(data, currentUser) {
    const { patient, appointment, bill } = data;

    // 1. Identify existing patient by patientId OR by phone to prevent duplicates
    let patientRecord = null;
    if (patient.patientId) {
      patientRecord = db.patients.find(p => p.patientId === patient.patientId);
    }
    if (!patientRecord && patient.phone) {
      const trimmedPhone = patient.phone.trim();
      patientRecord = db.patients.find(p => p.phone && p.phone.trim() === trimmedPhone);
    }

    const patientService = require('./patientService');
    if (patientRecord) {
      // Update existing patient record (never duplicate!)
      const { patientId: _pId, createdAt: _cAt, ...updateData } = patient;
      patientRecord = patientService.updatePatient(patientRecord.patientId, updateData);
    } else {
      // Create new patient
      patientRecord = patientService.createPatient(patient);
    }

    // 2. Create Appointment under the same patient ID
    const appointmentService = require('./appointmentService');
    const appointmentRecord = appointmentService.createAppointment({
      ...appointment,
      patientId: patientRecord.patientId
    }, currentUser);

    // 3. Create Bill under the same patient ID
    const billRecord = this.createBill({
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
