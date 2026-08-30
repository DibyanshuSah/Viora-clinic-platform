const db = require('../config/database');

class PrescriptionService {
  getPrescriptions(filters = {}) {
    const { patientId, doctorId } = filters;
    let list = [...db.prescriptions];

    if (patientId) {
      list = list.filter(p => p.patientId === patientId);
    }
    if (doctorId) {
      list = list.filter(p => p.doctorId === doctorId);
    }

    return list.map(pr => {
      const patient = db.patients.find(p => p.patientId === pr.patientId);
      const doctor = db.doctors.find(d => d.doctorId === pr.doctorId);
      return {
        ...pr,
        patientName: patient ? patient.name : 'Unknown Patient',
        patientAge: patient ? patient.age : null,
        patientGender: patient ? patient.gender : null,
        doctorName: doctor ? doctor.name : 'Unknown Doctor',
        doctorSpecialization: doctor ? doctor.specialization : '',
        doctorRegNo: doctor ? doctor.registrationNumber : '',
        clinic: db.clinicProfile
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getPrescriptionById(prescriptionId) {
    const pr = db.prescriptions.find(p => p.prescriptionId === prescriptionId);
    if (!pr) {
      throw { statusCode: 404, message: 'Prescription not found' };
    }

    const patient = db.patients.find(p => p.patientId === pr.patientId);
    const doctor = db.doctors.find(d => d.doctorId === pr.doctorId);

    return {
      ...pr,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientAddress: patient ? `${patient.address}, ${patient.city}` : '',
      allergies: patient ? patient.allergies : 'None',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorQualification: doctor ? doctor.qualification : '',
      doctorRegNo: doctor ? doctor.registrationNumber : '',
      clinic: db.clinicProfile
    };
  }

  createPrescription(data) {
    const {
      patientId,
      doctorId,
      consultationId,
      medicines = [],
      diagnosis = '',
      advice = '',
      followUpDate = '',
      procedures = []
    } = data;

    if (!patientId || !doctorId) {
      throw { statusCode: 400, message: 'Patient ID and Doctor ID are required' };
    }

    const prescriptionId = db.nextPrescriptionId();
    const newRx = {
      prescriptionId,
      consultationId: consultationId || null,
      patientId,
      doctorId,
      medicines,
      diagnosis,
      advice,
      followUpDate,
      procedures,
      createdAt: new Date().toISOString()
    };

    db.prescriptions.push(newRx);
    return this.getPrescriptionById(prescriptionId);
  }
}

module.exports = new PrescriptionService();
