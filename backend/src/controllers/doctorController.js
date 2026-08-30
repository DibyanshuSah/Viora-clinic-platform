const doctorService = require('../services/doctorService');
const { successResponse } = require('../utils/responseHandler');

class DoctorController {
  getAllDoctors(req, res, next) {
    try {
      const doctors = doctorService.getAllDoctors();
      return successResponse(res, 'Doctors retrieved successfully', doctors);
    } catch (err) {
      next(err);
    }
  }

  getDoctorById(req, res, next) {
    try {
      const doctor = doctorService.getDoctorById(req.params.id);
      return successResponse(res, 'Doctor details retrieved successfully', doctor);
    } catch (err) {
      next(err);
    }
  }

  createDoctor(req, res, next) {
    try {
      const doctor = doctorService.createDoctor(req.body);
      return successResponse(res, 'Doctor created successfully', doctor, 201);
    } catch (err) {
      next(err);
    }
  }

  updateDoctor(req, res, next) {
    try {
      const doctor = doctorService.updateDoctor(req.params.id, req.body);
      return successResponse(res, 'Doctor updated successfully', doctor);
    } catch (err) {
      next(err);
    }
  }

  deleteDoctor(req, res, next) {
    try {
      const result = doctorService.deleteDoctor(req.params.id);
      return successResponse(res, 'Doctor deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DoctorController();
