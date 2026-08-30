const prisma = require('./prisma');
const {
  clinicProfileSeed,
  usersSeed,
  doctorsSeed,
  staffSeed,
  proceduresSeed,
  patientsSeed,
  appointmentsSeed,
  consultationsSeed,
  prescriptionsSeed,
  billsSeed
} = require('../seed/seedData');

class DatabaseStore {
  constructor() {
    this.prisma = prisma;
    this.reset();
  }

  reset() {
    // In-memory working cache
    this.clinicProfile = JSON.parse(JSON.stringify(clinicProfileSeed));
    this.users = JSON.parse(JSON.stringify(usersSeed));
    this.doctors = JSON.parse(JSON.stringify(doctorsSeed));
    this.staff = JSON.parse(JSON.stringify(staffSeed));
    this.procedures = JSON.parse(JSON.stringify(proceduresSeed));
    this.patients = JSON.parse(JSON.stringify(patientsSeed));
    this.appointments = JSON.parse(JSON.stringify(appointmentsSeed));
    this.consultations = JSON.parse(JSON.stringify(consultationsSeed));
    this.prescriptions = JSON.parse(JSON.stringify(prescriptionsSeed));
    this.bills = JSON.parse(JSON.stringify(billsSeed));

    this.counters = {
      patient: 1001,
      doctor: 101,
      staff: 201,
      appointment: 1,
      consultation: 1001,
      prescription: 1001,
      procedure: 8,
      bill: 1,
      user: 2
    };
  }

  // ID GENERATORS
  nextPatientId() {
    const id = `PAT-${this.counters.patient}`;
    this.counters.patient += 1;
    return id;
  }

  nextDoctorId() {
    const id = `DOC-${this.counters.doctor}`;
    this.counters.doctor += 1;
    return id;
  }

  nextStaffId() {
    const id = `STF-${this.counters.staff}`;
    this.counters.staff += 1;
    return id;
  }

  nextAppointmentId() {
    const year = new Date().getFullYear();
    const id = `APT-${year}-${String(this.counters.appointment).padStart(3, '0')}`;
    this.counters.appointment += 1;
    return id;
  }

  nextConsultationId() {
    const id = `CNS-${this.counters.consultation}`;
    this.counters.consultation += 1;
    return id;
  }

  nextPrescriptionId() {
    const id = `RX-${this.counters.prescription}`;
    this.counters.prescription += 1;
    return id;
  }

  nextProcedureId() {
    const id = `PROC-${String(this.counters.procedure).padStart(3, '0')}`;
    this.counters.procedure += 1;
    return id;
  }

  nextBillId() {
    const year = new Date().getFullYear();
    const id = `BILL-${year}-${String(this.counters.bill).padStart(3, '0')}`;
    this.counters.bill += 1;
    return id;
  }

  nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const id = `INV-VIO-${year}-${String(this.counters.bill).padStart(4, '0')}`;
    return id;
  }

  nextUserId() {
    const id = `usr-${this.counters.user}`;
    this.counters.user += 1;
    return id;
  }
}

// Export singleton database store instance
const dbInstance = new DatabaseStore();
module.exports = dbInstance;
