const patientService = require('../services/patientService');
const { successResponse } = require('../utils/responseHandler');

class PatientController {
  getAllPatients(req, res, next) {
    try {
      const { search } = req.query;
      const patients = patientService.getAllPatients(search);
      return successResponse(res, 'Patients retrieved successfully', patients);
    } catch (err) {
      next(err);
    }
  }

  getPatientById(req, res, next) {
    try {
      const patient = patientService.getPatientById(req.params.id);
      return successResponse(res, 'Patient details retrieved successfully', patient);
    } catch (err) {
      next(err);
    }
  }

  createPatient(req, res, next) {
    try {
      const patient = patientService.createPatient(req.body);
      return successResponse(res, 'Patient registered successfully', patient, 201);
    } catch (err) {
      next(err);
    }
  }

  updatePatient(req, res, next) {
    try {
      const patient = patientService.updatePatient(req.params.id, req.body);
      return successResponse(res, 'Patient updated successfully', patient);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PatientController();
