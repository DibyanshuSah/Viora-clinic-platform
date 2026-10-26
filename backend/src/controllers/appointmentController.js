const appointmentService = require('../services/appointmentService');
const { successResponse } = require('../utils/responseHandler');

class AppointmentController {
  getAppointments(req, res, next) {
    try {
      const appointments = appointmentService.getAppointments(req.query, req.user);
      return successResponse(res, 'Appointments retrieved successfully', appointments);
    } catch (err) {
      next(err);
    }
  }

  getAppointmentById(req, res, next) {
    try {
      const appointment = appointmentService.getAppointmentById(req.params.id);
      return successResponse(res, 'Appointment retrieved successfully', appointment);
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

  async updateAppointmentStatus(req, res, next) {
    try {
      const { status } = req.body;
      const updated = await appointmentService.updateAppointmentStatus(req.params.id, status, req.user);
      return successResponse(res, `Appointment status updated to ${status}`, updated);
    } catch (err) {
      next(err);
    }
  }

  async endVisit(req, res, next) {
    try {
      const result = await appointmentService.endVisit(req.params.id, req.user);
      return successResponse(res, 'Visit ended, bill finalized and WhatsApp notification sent', result);
    } catch (err) {
      next(err);
    }
  }

  async retryWhatsApp(req, res, next) {
    try {
      const whatsappService = require('../services/whatsappService');
      const messages = whatsappService.getMessages({ appointmentId: req.params.id });
      if (messages.length === 0) {
        throw { statusCode: 404, message: 'No WhatsApp message record found for this visit to retry' };
      }
      const retried = await whatsappService.retryMessage(messages[0].id, req.user);
      return successResponse(res, 'WhatsApp notification retried successfully', retried);
    } catch (err) {
      next(err);
    }
  }

  async cancelAppointment(req, res, next) {
    try {
      const updated = await appointmentService.cancelAppointment(req.params.id, req.user);
      return successResponse(res, 'Appointment cancelled successfully', updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AppointmentController();
