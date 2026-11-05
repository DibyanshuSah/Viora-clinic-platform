const clinicService = require('../services/clinicService');
const { successResponse } = require('../utils/responseHandler');

class ClinicController {
  async getProfile(req, res, next) {
    try {
      const profile = await clinicService.getProfile();
      return successResponse(res, 'Clinic profile retrieved successfully', profile);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await clinicService.updateProfile(req.body);
      return successResponse(res, 'Clinic profile updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClinicController();
