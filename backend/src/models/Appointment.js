/**
 * Appointment Entity Model
 */
class Appointment {
  constructor({
    appointmentId,
    patientId,
    doctorId,
    appointmentType = 'Consultation', // 'Consultation' | 'Procedure'
    procedureId = null,
    procedureName = null,
    date,
    time,
    status = 'Waiting', // 'Waiting' | 'In Consultation' | 'Completed' | 'Cancelled'
    queueNumber = 'Q-01',
    waitingTimeMinutes = 0,
    createdBy = 'Front Desk Staff',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.appointmentId = appointmentId;
    this.patientId = patientId;
    this.doctorId = doctorId;
    this.appointmentType = appointmentType;
    this.procedureId = procedureId;
    this.procedureName = procedureName;
    this.date = date;
    this.time = time;
    this.status = status;
    this.queueNumber = queueNumber;
    this.waitingTimeMinutes = Number(waitingTimeMinutes);
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Appointment;
