const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return errorResponse(res, 'Username and password are required', { field: 'credentials' }, 400);
      }

      const result = await authService.login(username, password);
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  async switchDemoRole(req, res, next) {
    try {
      const { role } = req.body;
      if (!role || !['ADMIN', 'DOCTOR', 'STAFF'].includes(role.toUpperCase())) {
        return errorResponse(res, 'Valid demo role (ADMIN, DOCTOR, STAFF) is required', null, 400);
      }

      const result = await authService.switchDemoRole(role.toUpperCase());
      return successResponse(res, `Switched to demo role: ${role.toUpperCase()}`, result);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      return successResponse(res, 'User profile retrieved', user);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
