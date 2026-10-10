const db = require('../config/database');

class ConsultationService {
  getConsultations(filters = {}, userRole = 'STAFF') {
    const { patientId, doctorId, appointmentId } = filters;
    let list = [...db.consultations];

    if (patientId) {
      list = list.filter(c => c.patientId === patientId);
    }
    if (doctorId) {
      list = list.filter(c => c.doctorId === doctorId);
    }
    if (appointmentId) {
      list = list.filter(c => c.appointmentId === appointmentId);
    }

    const mapped = list.map(c => {
      const patient = db.patients.find(p => p.patientId === c.patientId);
      const doctor = db.doctors.find(d => d.doctorId === c.doctorId);
      const prescription = db.prescriptions.find(pr => pr.prescriptionId === c.prescriptionId);

      const record = {
        ...c,
        patientName: patient ? patient.name : 'Unknown Patient',
        patientAge: patient ? patient.age : null,
        patientGender: patient ? patient.gender : null,
        patientPhone: patient ? patient.phone : null,
        patientDOB: patient ? patient.dateOfBirth : null,
        patientAddress: patient ? patient.address : '',
        allergies: patient ? patient.allergies : 'None',
        medicalHistory: patient ? patient.medicalHistory : 'None',
        doctorName: doctor ? doctor.name : 'Unknown Doctor',
        doctorSpecialization: doctor ? doctor.specialization : '',
        doctorQualification: doctor ? doctor.qualification : '',
        doctorRegNo: doctor ? doctor.registrationNumber : '',
        prescription: prescription || null
      };

      // SECURITY: Strip privateNotes if user is not DOCTOR or ADMIN
      if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
        delete record.privateNotes;
      }

      return record;
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    // When querying patient history, deduplicate consultations by same day keeping the latest updated one
    if (patientId) {
      const dayMap = new Map();
      for (const item of mapped) {
        const dayKey = (item.createdAt || '').split('T')[0];
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, item);
        } else {
          const existing = dayMap.get(dayKey);
          const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
          const itemTime = new Date(item.updatedAt || item.createdAt).getTime();
          if (itemTime > existingTime) {
            dayMap.set(dayKey, item);
          }
        }
      }
      return Array.from(dayMap.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }

    return mapped;
  }

  getConsultationById(consultationId, userRole = 'STAFF') {
    const c = db.consultations.find(item => item.consultationId === consultationId);
    if (!c) {
      throw { statusCode: 404, message: 'Consultation record not found' };
    }

    const patient = db.patients.find(p => p.patientId === c.patientId);
    const doctor = db.doctors.find(d => d.doctorId === c.doctorId);
    const prescription = db.prescriptions.find(pr => pr.prescriptionId === c.prescriptionId);

    const record = {
      ...c,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientDOB: patient ? patient.dateOfBirth : null,
      patientAddress: patient ? patient.address : '',
      allergies: patient ? patient.allergies : 'None',
      medicalHistory: patient ? patient.medicalHistory : 'None',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorQualification: doctor ? doctor.qualification : '',
      doctorRegNo: doctor ? doctor.registrationNumber : '',
      prescription: prescription || null
    };

    if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
      delete record.privateNotes;
    }

    return record;
  }

  createOrUpdateConsultation(data, currentUser) {
    const {
      consultationId,
      appointmentId,
      patientId,
      doctorId,
      chiefComplaint = '',
      symptoms = '',
      diagnosis = '',
      vitals = {},
      examination = '',
      treatment = '',
      procedureDetails = '',
      privateNotes = '',
      medicines = [],
      advice = '',
      followUpDate = '',
      procedures = [],
      status = 'Completed'
    } = data;

    if (!patientId || !doctorId) {
      throw { statusCode: 400, message: 'Patient ID and Doctor ID are required' };
    }

    const todayStr = new Date().toISOString().split('T')[0];

    let existingConsultationIndex = -1;
    if (consultationId) {
      existingConsultationIndex = db.consultations.findIndex(c => c.consultationId === consultationId);
    } else if (appointmentId) {
      existingConsultationIndex = db.consultations.findIndex(c => c.appointmentId === appointmentId);
    }

    // If no exact ID match, check if there is an existing consultation for this patient on the same day to update it
    if (existingConsultationIndex === -1) {
      existingConsultationIndex = db.consultations.findIndex(c =>
        c.patientId === patientId &&
        c.createdAt &&
        c.createdAt.startsWith(todayStr)
      );
    }

    let cId = consultationId;
    let rxId = null;

    // Handle Prescription creation/updating if medicines or advice are present
    if ((medicines && medicines.length > 0) || advice || diagnosis) {
      if (existingConsultationIndex !== -1 && db.consultations[existingConsultationIndex].prescriptionId) {
        rxId = db.consultations[existingConsultationIndex].prescriptionId;
        const rxIndex = db.prescriptions.findIndex(pr => pr.prescriptionId === rxId);
        if (rxIndex !== -1) {
          db.prescriptions[rxIndex] = {
            ...db.prescriptions[rxIndex],
            medicines,
            diagnosis,
            advice,
            followUpDate,
            procedures,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        rxId = db.nextPrescriptionId();
        const newRx = {
          prescriptionId: rxId,
          consultationId: cId,
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
      }
    }

    let consultationRecord;

    if (existingConsultationIndex !== -1) {
      cId = db.consultations[existingConsultationIndex].consultationId;
      db.consultations[existingConsultationIndex] = {
        ...db.consultations[existingConsultationIndex],
        chiefComplaint,
        symptoms,
        diagnosis,
        vitals: {
          bp: vitals.bp || '',
          pulse: vitals.pulse || '',
          temp: vitals.temp || '',
          weight: vitals.weight || '',
          spo2: vitals.spo2 || ''
        },
        examination,
        treatment,
        procedureDetails,
        privateNotes: currentUser.role === 'DOCTOR' ? privateNotes : db.consultations[existingConsultationIndex].privateNotes,
        prescriptionId: rxId || db.consultations[existingConsultationIndex].prescriptionId,
        status,
        updatedAt: new Date().toISOString()
      };
      consultationRecord = db.consultations[existingConsultationIndex];
    } else {
      cId = db.nextConsultationId();
      consultationRecord = {
        consultationId: cId,
        appointmentId: appointmentId || null,
        patientId,
        doctorId,
        chiefComplaint,
        symptoms,
        diagnosis,
        vitals: {
          bp: vitals.bp || '',
          pulse: vitals.pulse || '',
          temp: vitals.temp || '',
          weight: vitals.weight || '',
          spo2: vitals.spo2 || ''
        },
        examination,
        treatment,
        procedureDetails,
        privateNotes,
        prescriptionId: rxId,
        status,
        createdAt: new Date().toISOString()
      };
      db.consultations.push(consultationRecord);

      // If there was a new prescription created before generating cId, link it
      if (rxId) {
        const rx = db.prescriptions.find(pr => pr.prescriptionId === rxId);
        if (rx) rx.consultationId = cId;
      }
    }

    // Update appointment status to Completed
    let targetAptId = appointmentId;
    if (!targetAptId) {
      const todayApt = db.appointments.find(a => a.patientId === patientId && (a.date === todayStr || (a.createdAt && a.createdAt.startsWith(todayStr))));
      if (todayApt) targetAptId = todayApt.appointmentId;
    }
    if (targetAptId) {
      const aptIndex = db.appointments.findIndex(a => a.appointmentId === targetAptId);
      if (aptIndex !== -1) {
        db.appointments[aptIndex].status = status || 'Completed';
        db.appointments[aptIndex].updatedAt = new Date().toISOString();
      }
    }

    const prescription = rxId ? db.prescriptions.find(p => p.prescriptionId === rxId) : null;
    return {
      ...consultationRecord,
      prescription
    };
  }

  getPatientHistory(patientId, userRole = 'STAFF') {
    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const consultations = this.getConsultations({ patientId }, userRole);
    const prescriptions = db.prescriptions.filter(pr => pr.patientId === patientId).map(pr => {
      const doc = db.doctors.find(d => d.doctorId === pr.doctorId);
      return {
        ...pr,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : ''
      };
    });

    const appointments = db.appointments.filter(a => a.patientId === patientId).map(a => {
      const doc = db.doctors.find(d => d.doctorId === a.doctorId);
      return {
        ...a,
        doctorName: doc ? doc.name : 'Unknown Doctor'
      };
    });

    return {
      patient,
      consultations,
      prescriptions,
      appointments
    };
  }
}

module.exports = new ConsultationService();
