const prescriptionService = require('../services/prescriptionService');
const { successResponse } = require('../utils/responseHandler');

class PrescriptionController {
  async getPrescriptions(req, res, next) {
    try {
      const list = await prescriptionService.getPrescriptions(req.query, req.user);
      return successResponse(res, 'Prescriptions retrieved successfully', list);
    } catch (err) {
      next(err);
    }
  }

  async getPrescriptionById(req, res, next) {
    try {
      const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);
      return successResponse(res, 'Prescription retrieved successfully', prescription);
    } catch (err) {
      next(err);
    }
  }

  async createPrescription(req, res, next) {
    try {
      const prescription = await prescriptionService.createPrescription(req.body);
      return successResponse(res, 'Prescription created successfully', prescription, 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PrescriptionController();
