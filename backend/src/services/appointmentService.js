const db = require('../config/database');

class AppointmentService {
  getAppointments(filters = {}) {
    const { date, doctorId, status, type, patientId } = filters;
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

    // Populate patient and doctor information
    return list.map(apt => {
      const patient = db.patients.find(p => p.patientId === apt.patientId) || {};
      const doctor = db.doctors.find(d => d.doctorId === apt.doctorId) || {};
      return {
        ...apt,
        patientName: patient.name || 'Unknown Patient',
        patientAge: patient.age || null,
        patientGender: patient.gender || null,
        patientPhone: patient.phone || null,
        doctorName: doctor.name || 'Unknown Doctor',
        doctorSpecialization: doctor.specialization || ''
      };
    }).sort((a, b) => {
      // Sort by status priority (Waiting -> In Consultation -> Completed -> Cancelled) then time
      const statusOrder = { 'In Consultation': 1, 'Waiting': 2, 'Completed': 3, 'Cancelled': 4 };
      const diff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (diff !== 0) return diff;
      return a.time.localeCompare(b.time);
    });
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
        workingDays: doc.workingDays,
        workingHours: doc.workingHours,
        breakTimes: doc.breakTimes,
        isWorkingToday: isWorkingDay,
        consultationFee: doc.consultationRates.consultationFee,
        doctorCut: doc.consultationRates.doctorCut,
        clinicShare: doc.consultationRates.clinicShare,
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

    if (!['Consultation', 'Procedure'].includes(appointmentType)) {
      throw { statusCode: 400, message: 'Appointment Type must be either Consultation or Procedure' };
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
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization
    };
  }

  updateAppointmentStatus(appointmentId, status) {
    const validStatuses = ['Waiting', 'In Consultation', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw { statusCode: 400, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    const index = db.appointments.findIndex(a => a.appointmentId === appointmentId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Appointment not found' };
    }

    db.appointments[index].status = status;
    db.appointments[index].updatedAt = new Date().toISOString();

    return db.appointments[index];
  }

  cancelAppointment(appointmentId) {
    return this.updateAppointmentStatus(appointmentId, 'Cancelled');
  }
}

module.exports = new AppointmentService();
