/**
 * Bill Entity Model
 */
class Bill {
  constructor({
    billId,
    invoiceNumber,
    patientId,
    doctorId,
    appointmentId = null,
    consultationType = 'Consultation',
    consultationFee = 0,
    doctorCutConsultation = 0,
    clinicShareConsultation = 0,
    procedures = [],
    subtotal,
    discount = 0,
    tax = 0,
    total,
    paid = 0,
    balance = 0,
    paymentMethod = 'Cash',
    paymentStatus = 'Paid',
    doctorCutTotal = 0,
    clinicShareTotal = 0,
    createdBy = 'Front Desk Staff',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.billId = billId;
    this.invoiceNumber = invoiceNumber;
    this.patientId = patientId;
    this.doctorId = doctorId;
    this.appointmentId = appointmentId;
    this.consultationType = consultationType;
    this.consultationFee = Number(consultationFee);
    this.doctorCutConsultation = Number(doctorCutConsultation);
    this.clinicShareConsultation = Number(clinicShareConsultation);
    this.procedures = procedures;
    this.subtotal = Number(subtotal);
    this.discount = Number(discount);
    this.tax = Number(tax);
    this.total = Number(total);
    this.paid = Number(paid);
    this.balance = Number(balance);
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;
    this.doctorCutTotal = Number(doctorCutTotal);
    this.clinicShareTotal = Number(clinicShareTotal);
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Bill;
