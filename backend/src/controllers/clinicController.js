const clinicService = require('../services/clinicService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

class ClinicController {
  getProfile(req, res, next) {
    try {
      const profile = clinicService.getProfile();
      return successResponse(res, 'Clinic profile retrieved successfully', profile);
    } catch (err) {
      next(err);
    }
  }

  updateProfile(req, res, next) {
    try {
      const updated = clinicService.updateProfile(req.body);
      return successResponse(res, 'Clinic profile updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClinicController();
