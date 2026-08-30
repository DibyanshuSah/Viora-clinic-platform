const procedureService = require('../services/procedureService');
const { successResponse } = require('../utils/responseHandler');

class ProcedureController {
  getAllProcedures(req, res, next) {
    try {
      const procedures = procedureService.getAllProcedures();
      return successResponse(res, 'Procedures retrieved successfully', procedures);
    } catch (err) {
      next(err);
    }
  }

  getProcedureById(req, res, next) {
    try {
      const procedure = procedureService.getProcedureById(req.params.id);
      return successResponse(res, 'Procedure details retrieved successfully', procedure);
    } catch (err) {
      next(err);
    }
  }

  createProcedure(req, res, next) {
    try {
      const procedure = procedureService.createProcedure(req.body);
      return successResponse(res, 'Procedure created successfully', procedure, 201);
    } catch (err) {
      next(err);
    }
  }

  updateProcedure(req, res, next) {
    try {
      const procedure = procedureService.updateProcedure(req.params.id, req.body);
      return successResponse(res, 'Procedure updated successfully', procedure);
    } catch (err) {
      next(err);
    }
  }

  deleteProcedure(req, res, next) {
    try {
      const result = procedureService.deleteProcedure(req.params.id);
      return successResponse(res, 'Procedure deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProcedureController();
