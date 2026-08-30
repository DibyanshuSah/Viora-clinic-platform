/**
 * Doctor Pricing Entity Model
 */
class DoctorPricing {
  constructor({
    doctorId,
    consultationType = 'Consultation',
    consultationFee = 800,
    doctorCut = 500,
    clinicShare = 300,
    procedureOverrides = {}
  }) {
    this.doctorId = doctorId;
    this.consultationType = consultationType;
    this.consultationFee = Number(consultationFee);
    this.doctorCut = Number(doctorCut);
    this.clinicShare = Number(clinicShare);
    this.procedureOverrides = procedureOverrides;
  }
}

module.exports = DoctorPricing;
