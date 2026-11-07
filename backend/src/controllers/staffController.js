const staffService = require('../services/staffService');
const { successResponse } = require('../utils/responseHandler');

class StaffController {
  async getAllStaff(req, res, next) {
    try {
      // Only ADMIN users are allowed to request inactive staff.
      // All other roles always receive the active-only list.
      const isAdmin = req.user?.role === 'ADMIN';
      const includeInactive = isAdmin && req.query.includeInactive === 'true';
      const staffList = await staffService.getAllStaff({ includeInactive });
      return successResponse(res, 'Staff members retrieved successfully', staffList);
    } catch (err) {
      next(err);
    }
  }

  async getStaffById(req, res, next) {
    try {
      const staff = await staffService.getStaffById(req.params.id);
      return successResponse(res, 'Staff details retrieved successfully', staff);
    } catch (err) {
      next(err);
    }
  }

  async createStaff(req, res, next) {
    try {
      const staff = await staffService.createStaff(req.body);
      return successResponse(res, 'Staff member created successfully', staff, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateStaff(req, res, next) {
    try {
      const staff = await staffService.updateStaff(req.params.id, req.body);
      return successResponse(res, 'Staff member updated successfully', staff);
    } catch (err) {
      next(err);
    }
  }

  async deleteStaff(req, res, next) {
    try {
      const result = await staffService.deleteStaff(req.params.id);
      return successResponse(res, 'Staff member deactivated successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
