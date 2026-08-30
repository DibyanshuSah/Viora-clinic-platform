/**
 * Consultation Entity Model
 */
class Consultation {
  constructor({
    consultationId,
    appointmentId = null,
    patientId,
    doctorId,
    chiefComplaint = '',
    symptoms = '',
    diagnosis = '',
    vitals = {},
    examination = '',
    treatment = '',
    procedureDetails = '',
    privateNotes = '', // Doctor-Only Private Notes
    prescriptionId = null,
    status = 'Completed',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.consultationId = consultationId;
    this.appointmentId = appointmentId;
    this.patientId = patientId;
    this.doctorId = doctorId;
    this.chiefComplaint = chiefComplaint;
    this.symptoms = symptoms;
    this.diagnosis = diagnosis;
    this.vitals = vitals;
    this.examination = examination;
    this.treatment = treatment;
    this.procedureDetails = procedureDetails;
    this.privateNotes = privateNotes;
    this.prescriptionId = prescriptionId;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Consultation;
