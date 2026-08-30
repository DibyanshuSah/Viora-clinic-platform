/**
 * Prescription Entity Model
 */
class Prescription {
  constructor({
    prescriptionId,
    consultationId = null,
    patientId,
    doctorId,
    medicines = [],
    diagnosis = '',
    advice = '',
    followUpDate = null,
    procedures = [],
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.prescriptionId = prescriptionId;
    this.consultationId = consultationId;
    this.patientId = patientId;
    this.doctorId = doctorId;
    this.medicines = medicines; // [{ medicine, dosage, frequency, duration, instructions }]
    this.diagnosis = diagnosis;
    this.advice = advice;
    this.followUpDate = followUpDate;
    this.procedures = procedures;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Prescription;
