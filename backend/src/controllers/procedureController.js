const procedureService = require('../services/procedureService');
const { successResponse } = require('../utils/responseHandler');

class ProcedureController {
  async getAllProcedures(req, res, next) {
    try {
      const procedures = await procedureService.getAllProcedures();
      return successResponse(res, 'Procedures retrieved successfully', procedures);
    } catch (err) {
      next(err);
    }
  }

  async getProcedureById(req, res, next) {
    try {
      const procedure = await procedureService.getProcedureById(req.params.id);
      return successResponse(res, 'Procedure details retrieved successfully', procedure);
    } catch (err) {
      next(err);
    }
  }

  async createProcedure(req, res, next) {
    try {
      const procedure = await procedureService.createProcedure(req.body);
      return successResponse(res, 'Procedure created successfully', procedure, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateProcedure(req, res, next) {
    try {
      const procedure = await procedureService.updateProcedure(req.params.id, req.body);
      return successResponse(res, 'Procedure updated successfully', procedure);
    } catch (err) {
      next(err);
    }
  }

  async deleteProcedure(req, res, next) {
    try {
      const result = await procedureService.deleteProcedure(req.params.id);
      return successResponse(res, 'Procedure deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProcedureController();
