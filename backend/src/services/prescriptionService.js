const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const { safeParse, safeStringify } = require('../utils/jsonUtils');

class PrescriptionService {
  async getPrescriptions(filters = {}) {
    const { patientId, doctorId } = filters;
    const where = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    const [prescriptions, patients, doctors, clinic] = await Promise.all([
      prisma.prescription.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.patient.findMany(),
      prisma.doctor.findMany(),
      prisma.clinicProfile.findFirst()
    ]);

    const patientMap = new Map(patients.map(p => [p.patientId, p]));
    const doctorMap = new Map(doctors.map(d => [d.doctorId, d]));

    return prescriptions.map(pr => {
      const patient = patientMap.get(pr.patientId);
      const doctor = doctorMap.get(pr.doctorId);
      return {
        ...pr,
        medicines: safeParse(pr.medicines, []),
        procedures: safeParse(pr.procedures, []),
        patientName: patient ? patient.name : 'Unknown Patient',
        patientAge: patient ? patient.age : null,
        patientGender: patient ? patient.gender : null,
        doctorName: doctor ? doctor.name : 'Unknown Doctor',
        doctorSpecialization: doctor ? doctor.specialization : '',
        doctorRegNo: doctor ? doctor.registrationNumber : '',
        clinic
      };
    });
  }

  async getPrescriptionById(prescriptionId) {
    const pr = await prisma.prescription.findUnique({
      where: { prescriptionId }
    });
    if (!pr) {
      throw { statusCode: 404, message: 'Prescription not found' };
    }

    const [patient, doctor, clinic] = await Promise.all([
      prisma.patient.findUnique({ where: { patientId: pr.patientId } }),
      prisma.doctor.findUnique({ where: { doctorId: pr.doctorId } }),
      prisma.clinicProfile.findFirst()
    ]);

    return {
      ...pr,
      medicines: safeParse(pr.medicines, []),
      procedures: safeParse(pr.procedures, []),
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientAddress: patient ? `${patient.address || ''}, ${patient.city || ''}` : '',
      allergies: patient ? patient.allergies : 'None',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorQualification: doctor ? doctor.qualification : '',
      doctorRegNo: doctor ? doctor.registrationNumber : '',
      clinic
    };
  }

  async createPrescription(data) {
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

    const prescriptionId = await idGenerator.nextPrescriptionId();
    await prisma.prescription.create({
      data: {
        prescriptionId,
        consultationId: consultationId || null,
        patientId,
        doctorId,
        medicines: safeStringify(medicines),
        diagnosis,
        advice,
        followUpDate,
        procedures: safeStringify(procedures)
      }
    });

    return await this.getPrescriptionById(prescriptionId);
  }
}

module.exports = new PrescriptionService();
