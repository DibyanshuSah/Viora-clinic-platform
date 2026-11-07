const patientService = require('../services/patientService');
const { successResponse } = require('../utils/responseHandler');

class PatientController {
  async getNextPatientId(req, res, next) {
    try {
      const nextPatientId = await patientService.getNextPatientId();
      return successResponse(res, 'Next patient ID preview retrieved', { nextPatientId });
    } catch (err) {
      next(err);
    }
  }

  async getAllPatients(req, res, next) {
    try {
      const { search, includeArchived } = req.query;
      // Only ADMIN users are allowed to request archived patients.
      const isAdmin = req.user?.role === 'ADMIN';
      const patients = await patientService.getAllPatients(search, {
        includeArchived: isAdmin && includeArchived === 'true',
        requestingUser: req.user   // doctor scoping applied inside service
      });
      return successResponse(res, 'Patients retrieved successfully', patients);
    } catch (err) {
      next(err);
    }
  }

  async getPatientById(req, res, next) {
    try {
      const patient = await patientService.getPatientById(req.params.id, req.user);
      return successResponse(res, 'Patient details retrieved successfully', patient);
    } catch (err) {
      next(err);
    }
  }

  async archivePatient(req, res, next) {
    try {
      const result = await patientService.archivePatient(req.params.id);
      return successResponse(res, result.message, result.patient);
    } catch (err) {
      next(err);
    }
  }

  async createPatient(req, res, next) {
    try {
      const patient = await patientService.createPatient(req.body);
      return successResponse(res, 'Patient registered successfully', patient, 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePatient(req, res, next) {
    try {
      const patient = await patientService.updatePatient(req.params.id, req.body);
      return successResponse(res, 'Patient updated successfully', patient);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PatientController();
