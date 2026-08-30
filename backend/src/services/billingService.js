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

  createBill(data, currentUser) {
    const {
      patientId,
      doctorId,
      appointmentId,
      consultationType = 'Consultation',
      consultationFee,
      procedures = [], // array of { procedureId, name, price, qty, doctorCut, clinicShare }
      discount = 0,
      tax = 0,
      paid = 0,
      paymentMethod = 'Cash',
      paymentStatus
    } = data;

    if (!patientId || !doctorId) {
      throw { statusCode: 400, message: 'Patient ID and Doctor ID are required' };
    }

    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const doctor = db.doctors.find(d => d.doctorId === doctorId);
    if (!doctor) {
      throw { statusCode: 404, message: 'Doctor not found' };
    }

    // Determine Consultation Fee & Cuts
    let finalConsultationFee = 0;
    let docCutConsultation = 0;
    let clinicShareConsultation = 0;

    if (consultationType === 'Consultation') {
      finalConsultationFee = consultationFee !== undefined
        ? Number(consultationFee)
        : Number(doctor.consultationRates.consultationFee || 0);
      
      docCutConsultation = doctor.consultationRates.doctorCut || 0;
      clinicShareConsultation = doctor.consultationRates.clinicShare || (finalConsultationFee - docCutConsultation);
    }

    // Process Procedures
    let procedureSubtotal = 0;
    let doctorProcedureCutsTotal = 0;
    let clinicProcedureShareTotal = 0;

    const processedProcedures = (procedures || []).map(p => {
      const procDef = db.procedures.find(pr => pr.procedureId === p.procedureId);
      const price = Number(p.price !== undefined ? p.price : (procDef ? procDef.defaultPrice : 0));
      const qty = Number(p.qty || 1);
      const lineAmount = price * qty;

      // Doctor-specific cut if configured, otherwise catalog default cut
      const docRateOverride = doctor.procedureRates && doctor.procedureRates[p.procedureId];
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
        procedureId: p.procedureId || 'CUSTOM',
        name: p.name || (procDef ? procDef.name : 'Procedure'),
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

    const { billId, invoiceNumber } = db.nextBillId();

    const newBill = {
      billId,
      invoiceNumber,
      patientId,
      doctorId,
      appointmentId: appointmentId || null,
      consultationType,
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
      paymentMethod,
      paymentStatus: calculatedStatus,
      doctorCutTotal: docCutConsultation + doctorProcedureCutsTotal,
      clinicShareTotal: clinicShareConsultation + clinicProcedureShareTotal,
      createdBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Front Desk',
      createdAt: new Date().toISOString()
    };

    db.bills.push(newBill);
    return this.populateBill(newBill);
  }

  updateBillPayment(billId, paymentData) {
    const index = db.bills.findIndex(b => b.billId === billId || b.invoiceNumber === billId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Bill not found' };
    }

    const current = db.bills[index];
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

    return this.populateBill(db.bills[index]);
  }

  populateBill(bill) {
    const patient = db.patients.find(p => p.patientId === bill.patientId);
    const doctor = db.doctors.find(d => d.doctorId === bill.doctorId);
    const appointment = db.appointments.find(a => a.appointmentId === bill.appointmentId);

    return {
      ...bill,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientAddress: patient ? `${patient.address}, ${patient.city}` : '',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorRegNo: doctor ? doctor.registrationNumber : '',
      appointmentDate: appointment ? appointment.date : null,
      appointmentTime: appointment ? appointment.time : null,
      clinic: db.clinicProfile
    };
  }

  // Combined Connected Flow helper for Front Desk
  registerAndBill(data, currentUser) {
    const { patient, appointment, bill } = data;

    // 1. Create Patient if new
    let patientRecord;
    if (patient.patientId) {
      patientRecord = db.patients.find(p => p.patientId === patient.patientId);
    }
    if (!patientRecord) {
      const patientService = require('./patientService');
      patientRecord = patientService.createPatient(patient);
    }

    // 2. Create Appointment
    const appointmentService = require('./appointmentService');
    const appointmentRecord = appointmentService.createAppointment({
      ...appointment,
      patientId: patientRecord.patientId
    }, currentUser);

    // 3. Create Bill
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
