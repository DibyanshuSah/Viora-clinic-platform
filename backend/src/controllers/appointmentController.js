const appointmentService = require('../services/appointmentService');
const { successResponse } = require('../utils/responseHandler');

class AppointmentController {
  getAppointments(req, res, next) {
    try {
      const appointments = appointmentService.getAppointments(req.query);
      return successResponse(res, 'Appointments retrieved successfully', appointments);
    } catch (err) {
      next(err);
    }
  }

  getDoctorSchedules(req, res, next) {
    try {
      const { date } = req.query;
      const schedules = appointmentService.getDoctorSchedules(date);
      return successResponse(res, 'Doctor schedules retrieved successfully', schedules);
    } catch (err) {
      next(err);
    }
  }

  createAppointment(req, res, next) {
    try {
      const appointment = appointmentService.createAppointment(req.body, req.user);
      return successResponse(res, 'Appointment created successfully', appointment, 201);
    } catch (err) {
      next(err);
    }
  }

  updateAppointmentStatus(req, res, next) {
    try {
      const { status } = req.body;
      const updated = appointmentService.updateAppointmentStatus(req.params.id, status);
      return successResponse(res, `Appointment status updated to ${status}`, updated);
    } catch (err) {
      next(err);
    }
  }

  cancelAppointment(req, res, next) {
    try {
      const updated = appointmentService.cancelAppointment(req.params.id);
      return successResponse(res, 'Appointment cancelled successfully', updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AppointmentController();
