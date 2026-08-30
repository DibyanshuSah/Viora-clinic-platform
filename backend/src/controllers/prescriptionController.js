const prescriptionService = require('../services/prescriptionService');
const { successResponse } = require('../utils/responseHandler');

class PrescriptionController {
  getPrescriptions(req, res, next) {
    try {
      const list = prescriptionService.getPrescriptions(req.query);
      return successResponse(res, 'Prescriptions retrieved successfully', list);
    } catch (err) {
      next(err);
    }
  }

  getPrescriptionById(req, res, next) {
    try {
      const prescription = prescriptionService.getPrescriptionById(req.params.id);
      return successResponse(res, 'Prescription retrieved successfully', prescription);
    } catch (err) {
      next(err);
    }
  }

  createPrescription(req, res, next) {
    try {
      const prescription = prescriptionService.createPrescription(req.body);
      return successResponse(res, 'Prescription created successfully', prescription, 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PrescriptionController();
