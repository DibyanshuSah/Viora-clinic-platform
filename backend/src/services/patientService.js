const prisma = require('../config/prisma');
const db = require('../config/database');
const idGenerator = require('../utils/idGenerator');
const { safeParse } = require('../utils/jsonUtils');

class PatientService {
  async getNextPatientId() {
    return await idGenerator.peekNextPatientId();
  }

  async getAllPatients(query = '') {
    let patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (query) {
      const q = query.toLowerCase().trim();
      patients = patients.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.patientId && p.patientId.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q))
      );
    }

    return patients;
  }

  async getPatientById(patientId) {
    const patient = await prisma.patient.findUnique({
      where: { patientId }
    });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Attach complete medical history directly from SQLite relations
    const [rawAppointments, rawConsultations, rawPrescriptions, rawBills, doctors] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId },
        orderBy: [{ date: 'desc' }, { time: 'desc' }]
      }),
      prisma.consultation.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.bill.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.doctor.findMany()
    ]);

    const doctorMap = new Map(doctors.map(d => [d.doctorId, d]));
    const prescriptionMap = new Map(rawPrescriptions.map(pr => [pr.prescriptionId, pr]));

    const appointments = rawAppointments.map(a => {
      const doc = doctorMap.get(a.doctorId);
      return {
        ...a,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        specialization: doc ? doc.specialization : ''
      };
    });

    const consultationsRaw = rawConsultations.map(c => {
      const doc = doctorMap.get(c.doctorId);
      const pr = prescriptionMap.get(c.prescriptionId);
      return {
        ...c,
        vitals: safeParse(c.vitals, {}),
        doctorName: doc ? doc.name : 'Unknown Doctor',
        specialization: doc ? doc.specialization : '',
        prescription: pr ? {
          ...pr,
          medicines: safeParse(pr.medicines, []),
          procedures: safeParse(pr.procedures, [])
        } : null
      };
    });

    // Deduplicate same-day consultations
    const dayMap = new Map();
    for (const item of consultationsRaw) {
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
    const consultations = Array.from(dayMap.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );

    const prescriptions = rawPrescriptions.map(pr => {
      const doc = doctorMap.get(pr.doctorId);
      return {
        ...pr,
        medicines: safeParse(pr.medicines, []),
        procedures: safeParse(pr.procedures, []),
        doctorName: doc ? doc.name : 'Unknown Doctor'
      };
    });

    const bills = rawBills.map(b => {
      const doc = doctorMap.get(b.doctorId);
      return {
        ...b,
        procedures: safeParse(b.procedures, []),
        doctorName: doc ? doc.name : 'Unknown Doctor'
      };
    });

    return {
      ...patient,
      appointments,
      consultations,
      prescriptions,
      bills
    };
  }

  formatPhoneNumber(phone) {
    if (!phone) return '';
    const trimmed = phone.trim();
    const hasPlus = trimmed.startsWith('+');
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (!digitsOnly) return trimmed;
    if (hasPlus) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    return `+${digitsOnly}`;
  }

  validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const digitsOnly = phone.replace(/[^0-9]/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }

  async createPatient(data) {
    const {
      name,
      dateOfBirth,
      age,
      gender = 'Other',
      phone,
      email = '',
      address = '',
      city = 'Bengaluru',
      state = 'Karnataka',
      pinCode = '',
      allergies = 'None',
      medicalHistory = 'None',
      emergencyContact = '',
      whatsappNumber,
      whatsappConsent = true,
      whatsappConsentDate
    } = data;

    if (!name || !phone) {
      throw { statusCode: 400, message: 'Patient Name and Phone are required' };
    }

    if (!this.validatePhoneNumber(phone)) {
      throw { statusCode: 400, message: 'Invalid phone number. Must contain at least 10 valid digits.' };
    }

    const rawWhatsapp = whatsappNumber && whatsappNumber.trim() ? whatsappNumber.trim() : phone.trim();
    if (!this.validatePhoneNumber(rawWhatsapp)) {
      throw { statusCode: 400, message: 'Invalid WhatsApp number. Must contain at least 10 valid digits.' };
    }

    const formattedPhone = this.formatPhoneNumber(phone);
    const formattedWhatsApp = this.formatPhoneNumber(rawWhatsapp);

    let calculatedAge = age;
    if (!calculatedAge && dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const ageDiff = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDiff);
      calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    const patientId = await idGenerator.nextPatientId();
    const consentDate = whatsappConsent ? (whatsappConsentDate ? new Date(whatsappConsentDate) : new Date()) : null;

    const newPatient = await prisma.patient.create({
      data: {
        patientId,
        name: name.trim(),
        dateOfBirth: dateOfBirth || '',
        age: Number(calculatedAge) || 0,
        gender,
        phone: formattedPhone,
        email: email ? email.trim() : '',
        whatsappNumber: formattedWhatsApp,
        whatsappConsent: Boolean(whatsappConsent),
        whatsappConsentDate: consentDate,
        address: address ? address.trim() : '',
        city: (city || 'Bengaluru').trim(),
        state: (state || 'Karnataka').trim(),
        pinCode: pinCode ? pinCode.trim() : '',
        allergies: allergies ? allergies.trim() : 'None',
        medicalHistory: medicalHistory ? medicalHistory.trim() : 'None',
        emergencyContact: emergencyContact ? emergencyContact.trim() : ''
      }
    });

    // Audit log
    await db.logAuditAction({
      action: 'PATIENT_REGISTERED',
      resourceType: 'PATIENT',
      resourceId: newPatient.patientId,
      patientId: newPatient.patientId,
      details: `Patient registered: ${newPatient.name} with WhatsApp consent: ${newPatient.whatsappConsent}`
    });

    // Schedule WhatsApp registration message
    try {
      const whatsappService = require('./whatsappService');
      whatsappService.scheduleRegistrationMessage(newPatient.patientId, 60000);
    } catch {}

    return newPatient;
  }

  async updatePatient(patientId, data) {
    const existing = await prisma.patient.findUnique({
      where: { patientId }
    });
    if (!existing) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = data.dateOfBirth;
    if (data.age !== undefined) updatePayload.age = Number(data.age);
    if (data.gender !== undefined) updatePayload.gender = data.gender;
    if (data.phone !== undefined) updatePayload.phone = this.formatPhoneNumber(data.phone);
    if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : '';
    if (data.whatsappNumber !== undefined) updatePayload.whatsappNumber = this.formatPhoneNumber(data.whatsappNumber);
    if (data.whatsappConsent !== undefined) updatePayload.whatsappConsent = Boolean(data.whatsappConsent);
    if (data.address !== undefined) updatePayload.address = data.address ? data.address.trim() : '';
    if (data.city !== undefined) updatePayload.city = data.city ? data.city.trim() : '';
    if (data.state !== undefined) updatePayload.state = data.state ? data.state.trim() : '';
    if (data.pinCode !== undefined) updatePayload.pinCode = data.pinCode ? data.pinCode.trim() : '';
    if (data.allergies !== undefined) updatePayload.allergies = data.allergies ? data.allergies.trim() : 'None';
    if (data.medicalHistory !== undefined) updatePayload.medicalHistory = data.medicalHistory ? data.medicalHistory.trim() : 'None';
    if (data.emergencyContact !== undefined) updatePayload.emergencyContact = data.emergencyContact ? data.emergencyContact.trim() : '';

    return await prisma.patient.update({
      where: { patientId },
      data: updatePayload
    });
  }
}

module.exports = new PatientService();
