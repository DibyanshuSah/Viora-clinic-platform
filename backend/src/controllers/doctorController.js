const doctorService = require('../services/doctorService');
const { successResponse } = require('../utils/responseHandler');

class DoctorController {
  async getAllDoctors(req, res, next) {
    try {
      const doctors = await doctorService.getAllDoctors();
      return successResponse(res, 'Doctors retrieved successfully', doctors);
    } catch (err) {
      next(err);
    }
  }

  async getDoctorById(req, res, next) {
    try {
      const doctor = await doctorService.getDoctorById(req.params.id);
      return successResponse(res, 'Doctor details retrieved successfully', doctor);
    } catch (err) {
      next(err);
    }
  }

  async createDoctor(req, res, next) {
    try {
      const doctor = await doctorService.createDoctor(req.body);
      return successResponse(res, 'Doctor created successfully', doctor, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateDoctor(req, res, next) {
    try {
      const doctor = await doctorService.updateDoctor(req.params.id, req.body);
      return successResponse(res, 'Doctor updated successfully', doctor);
    } catch (err) {
      next(err);
    }
  }

  async deleteDoctor(req, res, next) {
    try {
      const result = await doctorService.deleteDoctor(req.params.id);
      return successResponse(res, 'Doctor deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DoctorController();
