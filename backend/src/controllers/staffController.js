const staffService = require('../services/staffService');
const { successResponse } = require('../utils/responseHandler');

class StaffController {
  getAllStaff(req, res, next) {
    try {
      const staffList = staffService.getAllStaff();
      return successResponse(res, 'Staff members retrieved successfully', staffList);
    } catch (err) {
      next(err);
    }
  }

  getStaffById(req, res, next) {
    try {
      const staff = staffService.getStaffById(req.params.id);
      return successResponse(res, 'Staff details retrieved successfully', staff);
    } catch (err) {
      next(err);
    }
  }

  createStaff(req, res, next) {
    try {
      const staff = staffService.createStaff(req.body);
      return successResponse(res, 'Staff member created successfully', staff, 201);
    } catch (err) {
      next(err);
    }
  }

  updateStaff(req, res, next) {
    try {
      const staff = staffService.updateStaff(req.params.id, req.body);
      return successResponse(res, 'Staff member updated successfully', staff);
    } catch (err) {
      next(err);
    }
  }

  deleteStaff(req, res, next) {
    try {
      const result = staffService.deleteStaff(req.params.id);
      return successResponse(res, 'Staff member deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
