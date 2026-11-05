const prisma = require('../config/prisma');
const db = require('../config/database');
const idGenerator = require('../utils/idGenerator');
const { safeParse } = require('../utils/jsonUtils');

class AppointmentService {
  async populateAppointment(apt, patient = null, doctor = null) {
    if (!patient && apt.patientId) {
      patient = await prisma.patient.findUnique({ where: { patientId: apt.patientId } });
    }
    if (!doctor && apt.doctorId) {
      doctor = await prisma.doctor.findUnique({ where: { doctorId: apt.doctorId } });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        OR: [
          { appointmentId: apt.appointmentId },
          {
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            createdAt: { gte: new Date(apt.date + 'T00:00:00.000Z') }
          }
        ]
      }
    });

    const consultation = await prisma.consultation.findFirst({
      where: {
        OR: [
          { appointmentId: apt.appointmentId },
          {
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            createdAt: { gte: new Date(apt.date + 'T00:00:00.000Z') }
          }
        ]
      }
    });

    let prescription = null;
    if (consultation && consultation.prescriptionId) {
      prescription = await prisma.prescription.findUnique({
        where: { prescriptionId: consultation.prescriptionId }
      });
      if (prescription) {
        prescription.medicines = safeParse(prescription.medicines, []);
        prescription.procedures = safeParse(prescription.procedures, []);
      }
    }

    let activeLink = null;
    let whatsappMessage = null;

    if (bill) {
      const now = new Date();
      activeLink = await prisma.billAccessLink.findFirst({
        where: {
          billId: bill.billId,
          status: 'Active',
          expiresAt: { gt: now }
        },
        orderBy: { createdAt: 'desc' }
      });

      whatsappMessage = await prisma.whatsAppMessage.findFirst({
        where: {
          OR: [
            { billId: bill.billId },
            { appointmentId: apt.appointmentId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      whatsappMessage = await prisma.whatsAppMessage.findFirst({
        where: { appointmentId: apt.appointmentId },
        orderBy: { createdAt: 'desc' }
      });
    }

    const docRates = doctor ? safeParse(doctor.consultationRates, {}) : {};

    return {
      ...apt,
      patientCreatedAt: patient ? patient.createdAt : null,
      patientRegisteredAt: patient ? patient.createdAt : null,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientAge: patient ? patient.age : null,
      patientGender: patient ? patient.gender : null,
      patientPhone: patient ? patient.phone : null,
      patientWhatsappNumber: patient ? (patient.whatsappNumber || patient.phone) : null,
      patientAddress: patient ? patient.address : '',
      allergies: patient ? patient.allergies : 'None',
      medicalHistory: patient ? patient.medicalHistory : 'None',
      doctorName: doctor ? doctor.name : 'Unknown Doctor',
      doctorSpecialization: doctor ? doctor.specialization : '',
      doctorGender: doctor ? doctor.gender : 'Other',
      doctorFee: docRates?.consultationFee || 800,
      hasBill: Boolean(bill),
      billId: bill ? bill.billId : null,
      invoiceNumber: bill ? bill.invoiceNumber : null,
      billTotal: bill ? bill.total : null,
      billPaid: bill ? bill.paid : null,
      billBalance: bill ? bill.balance : null,
      paymentStatus: bill ? bill.paymentStatus : 'Unbilled',
      hasConsultation: Boolean(consultation),
      consultationId: consultation ? consultation.consultationId : null,
      hasPrescription: Boolean(prescription),
      prescriptionId: prescription ? prescription.prescriptionId : null,
      activeLinkToken: activeLink ? activeLink.token : null,
      activeLinkUrl: activeLink ? `https://vioracare.in/view-bill/${activeLink.token}` : null,
      whatsappStatus: whatsappMessage ? whatsappMessage.status : 'None',
      whatsappMessageId: whatsappMessage ? whatsappMessage.id : null,
      whatsappFailureReason: whatsappMessage ? whatsappMessage.failureReason : null
    };
  }

  async getAppointments(filters = {}, currentUser = null) {
    const { date, doctorId, status, type, patientId, role, sortBy } = filters;
    const where = {};

    if (date) where.date = date;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (type) where.appointmentType = type;

    const [appointments, patients, doctors] = await Promise.all([
      prisma.appointment.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.patient.findMany(),
      prisma.doctor.findMany()
    ]);

    const patientMap = new Map(patients.map(p => [p.patientId, p]));
    const doctorMap = new Map(doctors.map(d => [d.doctorId, d]));

    const populated = await Promise.all(
      appointments.map(apt => this.populateAppointment(apt, patientMap.get(apt.patientId), doctorMap.get(apt.doctorId)))
    );

    const isStaffRole =
      (currentUser && currentUser.role && currentUser.role.toUpperCase() === 'STAFF') ||
      (role && role.toUpperCase() === 'STAFF') ||
      sortBy === 'recentRegisteredPatient';

    if (isStaffRole) {
      return populated.sort((a, b) => {
        const timeA = a.patientCreatedAt ? new Date(a.patientCreatedAt).getTime() : 0;
        const timeB = b.patientCreatedAt ? new Date(b.patientCreatedAt).getTime() : 0;
        if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
          return timeB - timeA;
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
      const statusOrder = { 'In Consultation': 1, 'Waiting': 2, 'Completed': 3, 'Cancelled': 4 };
      const diff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (diff !== 0) return diff;
      return (a.time || '').localeCompare(b.time || '');
    });
  }

  async getAppointmentById(appointmentId) {
    const apt = await prisma.appointment.findUnique({
      where: { appointmentId }
    });
    if (!apt) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }
    return await this.populateAppointment(apt);
  }

  async getDoctorSchedules(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const dateObj = new Date(targetDate);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateObj.getDay()];

    const [activeDoctors, todayAppointments] = await Promise.all([
      prisma.doctor.findMany({ where: { status: 'Active' } }),
      prisma.appointment.findMany({
        where: {
          date: targetDate,
          status: { not: 'Cancelled' }
        }
      })
    ]);

    return activeDoctors.map(doc => {
      const workingDays = safeParse(doc.workingDays, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
      const workingHours = safeParse(doc.workingHours, { start: "09:00", end: "17:00" });
      const breakTimes = safeParse(doc.breakTimes, { start: "13:00", end: "14:00" });

      const isWorkingDay = Array.isArray(workingDays) && workingDays.includes(dayName);
      const docApts = todayAppointments.filter(a => a.doctorId === doc.doctorId);

      const waitingCount = docApts.filter(a => a.status === 'Waiting').length;
      const inConsultationCount = docApts.filter(a => a.status === 'In Consultation').length;
      const completedCount = docApts.filter(a => a.status === 'Completed').length;

      const slots = [];
      if (isWorkingDay && workingHours && workingHours.start && workingHours.end) {
        const [startH, startM] = workingHours.start.split(':').map(Number);
        const [endH, endM] = workingHours.end.split(':').map(Number);
        const [breakStartH, breakStartM] = (breakTimes?.start || '13:00').split(':').map(Number);
        const [breakEndH, breakEndM] = (breakTimes?.end || '14:00').split(':').map(Number);

        let currentMin = startH * 60 + startM;
        const endMinTotal = endH * 60 + endM;
        const breakStartMin = breakStartH * 60 + breakStartM;
        const breakEndMin = breakEndH * 60 + breakEndM;

        while (currentMin + 20 <= endMinTotal) {
          const isBreak = currentMin >= breakStartMin && currentMin < breakEndMin;
          const hh = String(Math.floor(currentMin / 60)).padStart(2, '0');
          const mm = String(currentMin % 60).padStart(2, '0');
          const timeSlot = `${hh}:${mm}`;

          const isBooked = docApts.some(a => a.time === timeSlot);
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
        doctorName: doc.name,
        specialization: doc.specialization,
        date: targetDate,
        dayName,
        isWorkingDay,
        workingHours,
        breakTimes,
        totalBookings: docApts.length,
        waitingCount,
        inConsultationCount,
        completedCount,
        availableSlotsCount: slots.filter(s => s.available).length,
        slots
      };
    });
  }

  async createAppointment(data, currentUser = null) {
    const {
      patientId,
      doctorId,
      appointmentType = 'Consultation',
      procedureId = null,
      procedureName = null,
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

    const patient = await prisma.patient.findUnique({ where: { patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const doctor = await prisma.doctor.findFirst({ where: { doctorId, status: 'Active' } });
    if (!doctor) {
      throw { statusCode: 404, message: 'Doctor not found or inactive' };
    }

    const dateObj = new Date(date);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateObj.getDay()];
    const workingDays = safeParse(doctor.workingDays, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

    if (Array.isArray(workingDays) && !workingDays.includes(dayName)) {
      throw { statusCode: 400, message: `${doctor.name} is not available on ${dayName}s.` };
    }

    const todayDoctorApts = await prisma.appointment.findMany({
      where: {
        doctorId,
        date,
        status: { not: 'Cancelled' }
      }
    });

    const queueNum = todayDoctorApts.length + 1;
    const queueNumber = `Q-${String(queueNum).padStart(2, '0')}`;
    const appointmentId = await idGenerator.nextAppointmentId();

    const createdBy = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Front Desk Staff';

    const newAppointment = await prisma.appointment.create({
      data: {
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
        createdBy
      }
    });

    return {
      ...newAppointment,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      patientPhone: patient.phone,
      patientCreatedAt: patient.createdAt,
      patientRegisteredAt: patient.createdAt,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization
    };
  }

  async endVisit(appointmentId, currentUser = null) {
    const apt = await prisma.appointment.findUnique({
      where: { appointmentId }
    });
    if (!apt) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId: apt.patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const doctor = await prisma.doctor.findUnique({ where: { doctorId: apt.doctorId } });
    const billingService = require('./billingService');
    const linkService = require('./linkService');
    const whatsappService = require('./whatsappService');

    // 1. Mark appointment Completed in SQLite
    const updatedApt = await prisma.appointment.update({
      where: { appointmentId },
      data: { status: 'Completed' }
    });

    // 2. Finalize Bill (Check for existing bill or create one now)
    let bill = await prisma.bill.findFirst({
      where: {
        OR: [
          { appointmentId: apt.appointmentId },
          {
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            createdAt: { gte: new Date(apt.date + 'T00:00:00.000Z') }
          }
        ]
      }
    });

    if (!bill) {
      const docRates = doctor ? safeParse(doctor.consultationRates, {}) : {};
      const consultationFee = apt.appointmentType === 'Follow-up Visit (Zero Bill)' ? 0 : (docRates.consultationFee || 800);

      const billProcedures = [];
      if (apt.procedureId && apt.procedureName) {
        billProcedures.push({
          procedureId: apt.procedureId,
          name: apt.procedureName,
          price: 500,
          qty: 1
        });
      }

      bill = await billingService.createBill({
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
    const accessLink = await linkService.generateBillAccessLink(bill.billId, currentUser);

    // 4. Dispatch WhatsApp thank-you message with secure link
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

    // 5. Audit log
    await db.logAuditAction({
      action: 'VISIT_COMPLETED',
      resourceType: 'APPOINTMENT',
      resourceId: apt.appointmentId,
      patientId: apt.patientId,
      user: currentUser,
      status: 'SUCCESS',
      details: `Visit ended for ${patient.name} (${patient.patientId}). Invoice ${bill.invoiceNumber} finalized. Secure bill link generated.`
    });

    const populatedAppointment = await this.populateAppointment(updatedApt, patient, doctor);

    return {
      appointment: populatedAppointment,
      bill,
      link: accessLink,
      accessLink,
      whatsappMessage,
      message: `Visit for ${patient.name} completed successfully. Invoice ${bill.invoiceNumber} generated and WhatsApp notification processed.`
    };
  }

  async updateAppointmentStatus(appointmentId, status, currentUser = null) {
    if (status === 'Completed') {
      const result = await this.endVisit(appointmentId, currentUser);
      return result.appointment;
    }

    const apt = await prisma.appointment.findUnique({ where: { appointmentId } });
    if (!apt) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }

    const updated = await prisma.appointment.update({
      where: { appointmentId },
      data: { status }
    });

    await db.logAuditAction({
      action: 'APPOINTMENT_STATUS_CHANGED',
      resourceType: 'APPOINTMENT',
      resourceId: appointmentId,
      patientId: apt.patientId,
      user: currentUser,
      details: `Appointment status updated to ${status}`
    });

    return await this.populateAppointment(updated);
  }

  async cancelAppointment(appointmentId, currentUser = null) {
    return await this.updateAppointmentStatus(appointmentId, 'Cancelled', currentUser);
  }
}

module.exports = new AppointmentService();
