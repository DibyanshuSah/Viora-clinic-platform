const db = require('../config/database');

class PatientService {
  getNextPatientId() {
    return db.peekNextPatientId();
  }

  getAllPatients(query = '') {
    let list = [...db.patients];
    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.patientId.toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    }
    // Sort latest registered first
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getPatientById(patientId) {
    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Attach complete medical history
    const appointments = db.appointments
      .filter(a => a.patientId === patientId)
      .map(a => {
        const doc = db.doctors.find(d => d.doctorId === a.doctorId);
        return {
          ...a,
          doctorName: doc ? doc.name : 'Unknown Doctor',
          specialization: doc ? doc.specialization : ''
        };
      })
      .sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

    const consultationsRaw = db.consultations
      .filter(c => c.patientId === patientId)
      .map(c => {
        const doc = db.doctors.find(d => d.doctorId === c.doctorId);
        const prescription = db.prescriptions.find(pr => pr.prescriptionId === c.prescriptionId);
        return {
          ...c,
          doctorName: doc ? doc.name : 'Unknown Doctor',
          specialization: doc ? doc.specialization : '',
          prescription: prescription || null
        };
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const dayMap = new Map();
    for (const item of consultationsRaw) {
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
    const consultations = Array.from(dayMap.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const prescriptions = db.prescriptions
      .filter(pr => pr.patientId === patientId)
      .map(pr => {
        const doc = db.doctors.find(d => d.doctorId === pr.doctorId);
        return {
          ...pr,
          doctorName: doc ? doc.name : 'Unknown Doctor'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const bills = db.bills
      .filter(b => b.patientId === patientId)
      .map(b => {
        const doc = db.doctors.find(d => d.doctorId === b.doctorId);
        return {
          ...b,
          doctorName: doc ? doc.name : 'Unknown Doctor'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    // Remove non-numeric except leading +
    const hasPlus = trimmed.startsWith('+');
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (!digitsOnly) return trimmed;
    if (hasPlus) {
      return `+${digitsOnly}`;
    }
    // Default 10-digit Indian mobile number: prefix +91
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

  createPatient(data) {
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

    const patientId = db.nextPatientId();
    const newPatient = {
      patientId,
      name: name.trim(),
      dateOfBirth: dateOfBirth || '',
      age: Number(calculatedAge) || 0,
      gender,
      phone: formattedPhone,
      email: email ? email.trim() : '',
      whatsappNumber: formattedWhatsApp,
      whatsappConsent: Boolean(whatsappConsent),
      whatsappConsentDate: whatsappConsent ? (whatsappConsentDate || new Date().toISOString()) : null,
      address: address ? address.trim() : '',
      city: city.trim(),
      state: state.trim(),
      pinCode: pinCode.trim(),
      allergies: allergies ? allergies.trim() : 'None',
      medicalHistory: medicalHistory ? medicalHistory.trim() : 'None',
      emergencyContact: emergencyContact ? emergencyContact.trim() : '',
      createdAt: new Date().toISOString()
    };

    db.patients.push(newPatient);

    db.logAuditAction({
      action: 'PATIENT_REGISTERED',
      resourceType: 'PATIENT',
      resourceId: newPatient.patientId,
      patientId: newPatient.patientId,
      details: `Patient registered: ${newPatient.name} with WhatsApp consent: ${newPatient.whatsappConsent}`
    });

    // Schedule Patient Registration WhatsApp message to be sent after 60 seconds of registration
    const whatsappService = require('./whatsappService');
    whatsappService.scheduleRegistrationMessage(newPatient.patientId, 60000);

    return newPatient;
  }

  updatePatient(patientId, data) {
    const index = db.patients.findIndex(p => p.patientId === patientId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const current = db.patients[index];
    const updateData = { ...data };

    if (updateData.phone) {
      if (!this.validatePhoneNumber(updateData.phone)) {
        throw { statusCode: 400, message: 'Invalid phone number format.' };
      }
      updateData.phone = this.formatPhoneNumber(updateData.phone);
    }

    if (updateData.whatsappNumber) {
      if (!this.validatePhoneNumber(updateData.whatsappNumber)) {
        throw { statusCode: 400, message: 'Invalid WhatsApp number format.' };
      }
      updateData.whatsappNumber = this.formatPhoneNumber(updateData.whatsappNumber);
    } else if (updateData.phone && !current.whatsappNumber) {
      updateData.whatsappNumber = updateData.phone;
    }

    if (updateData.whatsappConsent !== undefined) {
      updateData.whatsappConsent = Boolean(updateData.whatsappConsent);
      if (updateData.whatsappConsent && !current.whatsappConsentDate) {
        updateData.whatsappConsentDate = new Date().toISOString();
      }
    }

    db.patients[index] = {
      ...current,
      ...updateData,
      patientId: current.patientId,
      updatedAt: new Date().toISOString()
    };

    return db.patients[index];
  }
}

module.exports = new PatientService();
