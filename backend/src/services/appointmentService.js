const db = require('../config/database');

class AppointmentService {
  getAppointments(filters = {}, currentUser = null) {
    const { date, doctorId, status, type, patientId, role, sortBy } = filters;
    let list = [...db.appointments];

    if (date) {
      list = list.filter(a => a.date === date);
    }
    if (doctorId) {
      list = list.filter(a => a.doctorId === doctorId);
    }
    if (patientId) {
      list = list.filter(a => a.patientId === patientId);
    }
    if (status) {
      list = list.filter(a => a.status.toLowerCase() === status.toLowerCase());
    }
    if (type) {
      list = list.filter(a => a.appointmentType.toLowerCase() === type.toLowerCase());
    }

    const populated = list.map(apt => this.populateAppointment(apt));

    const isStaffRole =
      (currentUser && currentUser.role && currentUser.role.toUpperCase() === 'STAFF') ||
      (role && role.toUpperCase() === 'STAFF') ||
      sortBy === 'recentRegisteredPatient';

    if (isStaffRole) {
      return populated.sort((a, b) => {
        const timeA = a.patientCreatedAt ? new Date(a.patientCreatedAt).getTime() : 0;
        const timeB = b.patientCreatedAt ? new Date(b.patientCreatedAt).getTime() : 0;
        if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
          return timeB - timeA; // most recent registered patient first
        }
        const patientDiff = (b.patientId || '').localeCompare(a.patientId || '', undefined, { numeric: true });
        if (patientDiff !== 0) return patientDiff;

        const aptTimeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(`${a.date}T${a.time}`).getTime();
        const aptTimeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(`${b.date}T${b.time}`).getTime();
        if (!isNaN(aptTimeA) && !isNaN(aptTimeB) && aptTimeA !== aptTimeB) {
          return aptTimeB - aptTimeA;
        }
        return (b.appointmentId || '').localeCompare(a.appointmentId || '');
      });
    }

    return populated.sort((a, b) => {
      // Sort by status priority (Waiting -> In Consultation -> Completed -> Cancelled) then time
      const statusOrder = { 'In Consultation': 1, 'Waiting': 2, 'Completed': 3, 'Cancelled': 4 };
      const diff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (diff !== 0) return diff;
      return a.time.localeCompare(b.time);
    });
  }

  getAppointmentById(appointmentId) {
    const apt = db.appointments.find(a => a.appointmentId === appointmentId);
    if (!apt) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }
    return this.populateAppointment(apt);
  }

  getDoctorSchedules(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const dateObj = new Date(targetDate);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateObj.getDay()];

    return db.doctors.filter(d => d.status === 'Active').map(doc => {
      const isWorkingDay = doc.workingDays.includes(dayName);
      const todayAppointments = db.appointments.filter(
        a => a.doctorId === doc.doctorId && a.date === targetDate && a.status !== 'Cancelled'
      );

      const waitingCount = todayAppointments.filter(a => a.status === 'Waiting').length;
      const inConsultationCount = todayAppointments.filter(a => a.status === 'In Consultation').length;
      const completedCount = todayAppointments.filter(a => a.status === 'Completed').length;

      // Generate 20-min slots across doctor working hours
      const slots = [];
      if (isWorkingDay && doc.workingHours && doc.workingHours.start && doc.workingHours.end) {
        const [startH, startM] = doc.workingHours.start.split(':').map(Number);
        const [endH, endM] = doc.workingHours.end.split(':').map(Number);
        const [breakStartH, breakStartM] = (doc.breakTimes?.start || '13:00').split(':').map(Number);
        const [breakEndH, breakEndM] = (doc.breakTimes?.end || '14:00').split(':').map(Number);

        let currentMin = startH * 60 + startM;
        const endMinTotal = endH * 60 + endM;
        const breakStartMin = breakStartH * 60 + breakStartM;
        const breakEndMin = breakEndH * 60 + breakEndM;

        while (currentMin + 20 <= endMinTotal) {
          // Check if slot falls in break time
          const isBreak = currentMin >= breakStartMin && currentMin < breakEndMin;
          const hh = String(Math.floor(currentMin / 60)).padStart(2, '0');
          const mm = String(currentMin % 60).padStart(2, '0');
          const timeSlot = `${hh}:${mm}`;

          const isBooked = todayAppointments.some(a => a.time === timeSlot);

          slots.push({
            time: timeSlot,
            available: !isBreak && !isBooked,
            isBreak,
            isBooked
          });

          currentMin += 20;
        }
      }

      return {
        doctorId: doc.doctorId,
        name: doc.name,
        specialization: doc.specialization,
        qualification: doc.qualification || '',
        registrationNumber: doc.registrationNumber || '',
        workingDays: doc.workingDays,
        workingHours: doc.workingHours,
        breakTimes: doc.breakTimes,
        isWorkingToday: isWorkingDay,
        consultationFee: doc.consultationRates?.consultationFee ?? doc.consultationFee ?? 800,
        doctorCut: doc.consultationRates?.doctorCut ?? doc.doctorCut ?? 500,
        clinicShare: doc.consultationRates?.clinicShare ?? doc.clinicShare ?? 300,
        totalBookedToday: todayAppointments.length,
        waitingCount,
        inConsultationCount,
        completedCount,
        availableSlotsCount: slots.filter(s => s.available).length,
        slots
      };
    });
  }

  createAppointment(data, currentUser) {
    const {
      patientId,
      doctorId,
      appointmentType = 'Consultation',
      procedureId,
      procedureName,
      date,
      time,
      status = 'Waiting'
    } = data;

    if (!patientId || !doctorId || !date || !time) {
      throw { statusCode: 400, message: 'Patient ID, Doctor ID, Date and Time are required' };
    }

    if (!['Consultation', 'Procedure', 'Follow-up Visit (Zero Bill)', 'Follow-up Visit'].includes(appointmentType)) {
      throw { statusCode: 400, message: 'Appointment Type must be Consultation, Procedure, or Follow-up Visit (Zero Bill)' };
    }

    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const doctor = db.doctors.find(d => d.doctorId === doctorId && d.status === 'Active');
    if (!doctor) {
      throw { statusCode: 404, message: 'Doctor not found or inactive' };
    }

    // Validate Doctor Schedule
    const dateObj = new Date(date);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateObj.getDay()];

    if (!doctor.workingDays.includes(dayName)) {
      throw { statusCode: 400, message: `${doctor.name} is not available on ${dayName}s.` };
    }

    // Check existing appointments for queue number
    const todayDoctorApts = db.appointments.filter(
      a => a.doctorId === doctorId && a.date === date && a.status !== 'Cancelled'
    );

    const queueNum = todayDoctorApts.length + 1;
    const queueNumber = `Q-${String(queueNum).padStart(2, '0')}`;

    const appointmentId = db.nextAppointmentId();
    const newAppointment = {
      appointmentId,
      patientId,
      doctorId,
      appointmentType,
      procedureId: appointmentType === 'Procedure' ? procedureId : null,
      procedureName: appointmentType === 'Procedure' ? procedureName : null,
      date,
      time,
      status,
      queueNumber,
      waitingTimeMinutes: (queueNum - 1) * 15,
      createdBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Front Desk Staff',
      createdAt: new Date().toISOString()
    };

    db.appointments.push(newAppointment);

    return {
      ...newAppointment,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      patientPhone: patient.phone,
      patientCreatedAt: patient.createdAt || null,
      patientRegisteredAt: patient.createdAt || null,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization
    };
  }

  populateAppointment(apt) {
    const patient = db.patients.find(p => p.patientId === apt.patientId) || {};
    const doctor = db.doctors.find(d => d.doctorId === apt.doctorId) || {};
    const bill = db.bills.find(b => b.appointmentId === apt.appointmentId || (b.patientId === apt.patientId && b.doctorId === apt.doctorId && b.createdAt?.startsWith(apt.date))) || null;
    const consultation = db.consultations.find(c => c.appointmentId === apt.appointmentId || (c.patientId === apt.patientId && c.doctorId === apt.doctorId && c.createdAt?.startsWith(apt.date))) || null;
    const prescription = consultation?.prescriptionId ? db.prescriptions.find(pr => pr.prescriptionId === consultation.prescriptionId) : null;

    // Resolve WhatsApp message & active link
    let activeLink = null;
    let whatsappMessage = null;

    if (bill) {
      const linkService = require('./linkService');
      const links = linkService.getLinksForBill(bill.billId);
      const now = new Date();
      activeLink = links.find(l => l.status === 'Active' && new Date(l.expiresAt) > now) || null;

      const msgs = db.whatsappMessages.filter(m => m.billId === bill.billId || m.appointmentId === apt.appointmentId);
      whatsappMessage = msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    } else {
      const msgs = db.whatsappMessages.filter(m => m.appointmentId === apt.appointmentId);
      whatsappMessage = msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    }

    return {
      ...apt,
      patientCreatedAt: patient.createdAt || null,
      patientRegisteredAt: patient.createdAt || null,
      patientName: patient.name || 'Unknown Patient',
      patientAge: patient.age || null,
      patientGender: patient.gender || null,
      patientPhone: patient.phone || null,
      patientWhatsappNumber: patient.whatsappNumber || patient.phone || null,
      patientWhatsappConsent: patient.whatsappConsent !== undefined ? Boolean(patient.whatsappConsent) : true,
      patientDOB: patient.dateOfBirth || null,
      patientAddress: patient.address || null,
      allergies: patient.allergies || 'None',
      medicalHistory: patient.medicalHistory || 'None',
      doctorName: doctor.name || 'Unknown Doctor',
      doctorSpecialization: doctor.specialization || '',
      doctorQualification: doctor.qualification || '',
      doctorRegNo: doctor.registrationNumber || '',
      billId: bill ? bill.billId : null,
      invoiceNumber: bill ? bill.invoiceNumber : null,
      bill: bill || null,
      consultation: consultation || null,
      prescription: prescription || null,
      activeLink,
      whatsappMessage
    };
  }

  /**
   * Complete visit workflow when staff/doctor clicks "End" button:
   * 1. Finalize the bill and save it in CMS.
   * 2. Generate unique cryptographically secure UUID for bill-sharing link.
   * 3. Create secure, time-limited bill access link.
   * 4. Send bill link to patient's registered WhatsApp number.
   * 5. Send thank-you message after visit is completed.
   * + Idempotency: Prevent duplicate bills and messages on multiple clicks.
   */
  async endVisit(appointmentId, currentUser = null) {
    const index = db.appointments.findIndex(a => a.appointmentId === appointmentId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }

    const apt = db.appointments[index];
    const patient = db.patients.find(p => p.patientId === apt.patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const doctor = db.doctors.find(d => d.doctorId === apt.doctorId);
    const billingService = require('./billingService');
    const linkService = require('./linkService');
    const whatsappService = require('./whatsappService');

    // 1. Mark appointment Completed
    apt.status = 'Completed';
    apt.updatedAt = new Date().toISOString();

    // 2. Finalize Bill (Check for existing bill or create one now)
    let bill = db.bills.find(
      b => b.appointmentId === apt.appointmentId ||
           (b.patientId === apt.patientId && b.doctorId === apt.doctorId && b.createdAt?.startsWith(apt.date))
    );

    if (!bill) {
      // Find consultation or procedure if any
      const consultation = db.consultations.find(c => c.appointmentId === apt.appointmentId);
      const consultationFee = apt.appointmentType === 'Follow-up Visit (Zero Bill)' ? 0 : (doctor?.consultationRates?.consultationFee || 800);

      const billProcedures = [];
      if (apt.procedureId && apt.procedureName) {
        billProcedures.push({
          procedureId: apt.procedureId,
          name: apt.procedureName,
          price: 500,
          qty: 1
        });
      }

      bill = billingService.createBill({
        patientId: apt.patientId,
        doctorId: apt.doctorId,
        appointmentId: apt.appointmentId,
        consultationType: apt.appointmentType,
        consultationFee,
        procedures: billProcedures,
        paymentMethod: 'UPI',
        paymentStatus: 'Paid',
        paid: consultationFee + (billProcedures.reduce((acc, p) => acc + (p.price || 0), 0))
      }, currentUser);
    }

    // 3. Generate or retrieve secure UUID bill link
    const accessLink = linkService.generateBillAccessLink(bill.billId, currentUser);

    // 4 & 5. Dispatch WhatsApp thank-you message with secure link
    let whatsappMessage = null;
    try {
      const recipientPhone = patient.whatsappNumber || patient.phone;
      whatsappMessage = await whatsappService.sendBillMessage({
        appointmentId: apt.appointmentId,
        billId: bill.billId,
        patientId: patient.patientId,
        phone: recipientPhone,
        secureLinkUrl: accessLink.url,
        currentUser
      });
    } catch (waErr) {
      console.error('[endVisit WhatsApp Dispatch Error]', waErr);
    }

    // Audit log
    db.logAuditAction({
      action: 'VISIT_COMPLETED',
      resourceType: 'APPOINTMENT',
      resourceId: apt.appointmentId,
      patientId: apt.patientId,
      user: currentUser,
      status: 'SUCCESS',
      details: `Visit ended for ${patient.name} (${apt.queueNumber}). Finalized Invoice: ${bill.invoiceNumber}. WhatsApp Status: ${whatsappMessage?.status || 'N/A'}`
    });

    const populated = this.populateAppointment(apt);
    return {
      appointment: populated,
      bill: billingService.populateBill(bill),
      link: accessLink,
      whatsappMessage
    };
  }

  async updateAppointmentStatus(appointmentId, status, currentUser = null) {
    const validStatuses = ['Waiting', 'In Consultation', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw { statusCode: 400, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    // When status transitions to Completed, execute the automated visit end & billing workflow!
    if (status === 'Completed') {
      const result = await this.endVisit(appointmentId, currentUser);
      return result.appointment;
    }

    const index = db.appointments.findIndex(a => a.appointmentId === appointmentId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }

    db.appointments[index].status = status;
    db.appointments[index].updatedAt = new Date().toISOString();

    db.logAuditAction({
      action: 'APPOINTMENT_STATUS_CHANGED',
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      patientId: db.appointments[index].patientId,
      user: currentUser,
      details: `Appointment status updated to ${status}`
    });

    return this.populateAppointment(db.appointments[index]);
  }

  async cancelAppointment(appointmentId, currentUser = null) {
    return this.updateAppointmentStatus(appointmentId, 'Cancelled', currentUser);
  }
}

module.exports = new AppointmentService();
