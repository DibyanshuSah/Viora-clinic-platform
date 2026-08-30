/**
 * Invoice Entity Model
 */
class Invoice {
  constructor({
    invoiceNumber,
    billId,
    patient,
    doctor,
    items = [],
    subtotal,
    discount = 0,
    tax = 0,
    total,
    paid = 0,
    balance = 0,
    paymentMethod = 'Cash',
    paymentStatus = 'Paid',
    clinicDetails,
    issuedAt = new Date().toISOString()
  }) {
    this.invoiceNumber = invoiceNumber;
    this.billId = billId;
    this.patient = patient;
    this.doctor = doctor;
    this.items = items;
    this.subtotal = Number(subtotal);
    this.discount = Number(discount);
    this.tax = Number(tax);
    this.total = Number(total);
    this.paid = Number(paid);
    this.balance = Number(balance);
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;
    this.clinicDetails = clinicDetails;
    this.issuedAt = issuedAt;
  }
}

module.exports = Invoice;
