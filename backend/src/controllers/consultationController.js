const consultationService = require('../services/consultationService');
const { successResponse } = require('../utils/responseHandler');

class ConsultationController {
  getConsultations(req, res, next) {
    try {
      const list = consultationService.getConsultations(req.query, req.user.role);
      return successResponse(res, 'Consultations retrieved successfully', list);
    } catch (err) {
      next(err);
    }
  }

  getConsultationById(req, res, next) {
    try {
      const consultation = consultationService.getConsultationById(req.params.id, req.user.role);
      return successResponse(res, 'Consultation record retrieved successfully', consultation);
    } catch (err) {
      next(err);
    }
  }

  saveConsultation(req, res, next) {
    try {
      const result = consultationService.createOrUpdateConsultation(req.body, req.user);
      return successResponse(res, 'Consultation record and prescription saved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  getPatientHistory(req, res, next) {
    try {
      const history = consultationService.getPatientHistory(req.params.patientId, req.user.role);
      return successResponse(res, 'Patient history retrieved successfully', history);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConsultationController();
