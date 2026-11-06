const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const { safeParse, safeStringify } = require('../utils/jsonUtils');

class ConsultationService {
  async getConsultations(filters = {}, userRole = 'STAFF') {
    const { patientId, doctorId, appointmentId } = filters;
    const whereClause = {};

    if (patientId) whereClause.patientId = patientId;
    if (doctorId) whereClause.doctorId = doctorId;
    if (appointmentId) whereClause.appointmentId = appointmentId;

    const [consultations, patients, doctors, prescriptions] = await Promise.all([
      prisma.consultation.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.patient.findMany(),
      prisma.doctor.findMany(),
      prisma.prescription.findMany()
    ]);

    const patientMap = new Map(patients.map(p => [p.patientId, p]));
    const doctorMap = new Map(doctors.map(d => [d.doctorId, d]));
    const prescriptionMap = new Map(prescriptions.map(pr => [pr.prescriptionId, pr]));

    const mapped = consultations.map(c => {
      const patient = patientMap.get(c.patientId);
      const doctor = doctorMap.get(c.doctorId);
      const prescription = prescriptionMap.get(c.prescriptionId);

      const record = {
        ...c,
        vitals: safeParse(c.vitals, {}),
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
        prescription: prescription ? {
          ...prescription,
          medicines: safeParse(prescription.medicines, []),
          procedures: safeParse(prescription.procedures, [])
        } : null
      };

      if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
        delete record.privateNotes;
      }

      return record;
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (patientId) {
      const dayMap = new Map();
      for (const item of mapped) {
        const dayKey = (item.createdAt ? new Date(item.createdAt).toISOString() : '').split('T')[0];
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
      return Array.from(dayMap.values()).sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );
    }

    return mapped;
  }

  async getConsultationById(consultationId, userRole = 'STAFF') {
    const c = await prisma.consultation.findUnique({
      where: { consultationId }
    });
    if (!c) {
      throw { statusCode: 404, message: 'Consultation record not found' };
    }

    const [patient, doctor, prescription] = await Promise.all([
      prisma.patient.findUnique({ where: { patientId: c.patientId } }),
      prisma.doctor.findUnique({ where: { doctorId: c.doctorId } }),
      c.prescriptionId ? prisma.prescription.findUnique({ where: { prescriptionId: c.prescriptionId } }) : null
    ]);

    const record = {
      ...c,
      vitals: safeParse(c.vitals, {}),
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
      prescription: prescription ? {
        ...prescription,
        medicines: safeParse(prescription.medicines, []),
        procedures: safeParse(prescription.procedures, [])
      } : null
    };

    if (userRole !== 'DOCTOR' && userRole !== 'ADMIN') {
      delete record.privateNotes;
    }

    return record;
  }

  async createOrUpdateConsultation(data, currentUser) {
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

    // Check for existing consultation
    let existing = null;
    if (consultationId) {
      existing = await prisma.consultation.findUnique({ where: { consultationId } });
    } else if (appointmentId) {
      existing = await prisma.consultation.findFirst({ where: { appointmentId } });
    }

    if (!existing) {
      // Check same-day consultation for this patient
      const todayConsultations = await prisma.consultation.findMany({
        where: { patientId }
      });
      existing = todayConsultations.find(c =>
        c.createdAt && new Date(c.createdAt).toISOString().startsWith(todayStr)
      ) || null;
    }

    let cId = existing ? existing.consultationId : consultationId;
    if (!cId) {
      cId = await idGenerator.nextConsultationId();
    }

    let rxId = existing ? existing.prescriptionId : null;
    const hasPrescriptionData = Boolean((medicines && medicines.length > 0) || advice || diagnosis);
    if (!rxId && hasPrescriptionData) {
      rxId = await idGenerator.nextPrescriptionId();
    }

    // Execute atomic transaction for Prescription and Consultation
    return await prisma.$transaction(async (tx) => {
      // 1. Manage Prescription if details are provided
      if (hasPrescriptionData && rxId) {
        if (existing && existing.prescriptionId) {
          await tx.prescription.update({
            where: { prescriptionId: rxId },
            data: {
              medicines: safeStringify(medicines || []),
              diagnosis: diagnosis || '',
              advice: advice || '',
              followUpDate: followUpDate || '',
              procedures: safeStringify(procedures || [])
            }
          });
        } else {
          await tx.prescription.create({
            data: {
              prescriptionId: rxId,
              consultationId: cId,
              patientId,
              doctorId,
              medicines: safeStringify(medicines || []),
              diagnosis: diagnosis || '',
              advice: advice || '',
              followUpDate: followUpDate || '',
              procedures: safeStringify(procedures || [])
            }
          });
        }
      }

      // 2. Prepare Consultation Data
      const vitalsObj = {
        bp: vitals?.bp || '',
        pulse: vitals?.pulse || '',
        temp: vitals?.temp || '',
        weight: vitals?.weight || '',
        spo2: vitals?.spo2 || ''
      };

      let consultationRecord;
      if (existing) {
        consultationRecord = await tx.consultation.update({
          where: { consultationId: existing.consultationId },
          data: {
            chiefComplaint,
            symptoms,
            diagnosis,
            vitals: safeStringify(vitalsObj),
            examination,
            treatment,
            procedureDetails,
            privateNotes: currentUser.role === 'DOCTOR' ? privateNotes : existing.privateNotes,
            prescriptionId: rxId || existing.prescriptionId,
            status
          }
        });
      } else {
        consultationRecord = await tx.consultation.create({
          data: {
            consultationId: cId,
            appointmentId: appointmentId || null,
            patientId,
            doctorId,
            chiefComplaint,
            symptoms,
            diagnosis,
            vitals: safeStringify(vitalsObj),
            examination,
            treatment,
            procedureDetails,
            privateNotes,
            prescriptionId: rxId,
            status
          }
        });

        if (rxId) {
          await tx.prescription.update({
            where: { prescriptionId: rxId },
            data: { consultationId: cId }
          });
        }
      }

      // 3. Update appointment status to "In Consultation" if applicable
      let targetAptId = appointmentId;
      if (!targetAptId) {
        const todayApts = await tx.appointment.findMany({
          where: { patientId }
        });
        const found = todayApts.find(a =>
          a.date === todayStr || (a.createdAt && new Date(a.createdAt).toISOString().startsWith(todayStr))
        );
        if (found) targetAptId = found.appointmentId;
      }

      if (targetAptId) {
        const apt = await tx.appointment.findUnique({ where: { appointmentId: targetAptId } });
        if (apt && apt.status !== 'Completed') {
          await tx.appointment.update({
            where: { appointmentId: targetAptId },
            data: { status: 'In Consultation' }
          });
        }
      }

      let prescription = null;
      if (rxId) {
        prescription = await tx.prescription.findUnique({ where: { prescriptionId: rxId } });
        if (prescription) {
          prescription.medicines = safeParse(prescription.medicines, []);
          prescription.procedures = safeParse(prescription.procedures, []);
        }
      }

      return {
        ...consultationRecord,
        vitals: safeParse(consultationRecord.vitals, {}),
        prescription
      };
    });
  }

  async getPatientHistory(patientId, userRole = 'STAFF') {
    const patient = await prisma.patient.findUnique({
      where: { patientId }
    });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const [consultations, rawPrescriptions, rawAppointments, doctors] = await Promise.all([
      this.getConsultations({ patientId }, userRole),
      prisma.prescription.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
      prisma.appointment.findMany({ where: { patientId }, orderBy: [{ date: 'desc' }, { time: 'desc' }] }),
      prisma.doctor.findMany()
    ]);

    const docMap = new Map(doctors.map(d => [d.doctorId, d]));

    const prescriptions = rawPrescriptions.map(pr => {
      const doc = docMap.get(pr.doctorId);
      return {
        ...pr,
        medicines: safeParse(pr.medicines, []),
        procedures: safeParse(pr.procedures, []),
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : ''
      };
    });

    const appointments = rawAppointments.map(a => {
      const doc = docMap.get(a.doctorId);
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
