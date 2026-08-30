const { errorResponse } = require('../utils/responseHandler');

/**
 * Role-Based Access Control Middleware
 * @param  {...string} allowedRoles Roles allowed to access the endpoint (e.g. 'ADMIN', 'DOCTOR', 'STAFF')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 'Authentication required', { code: 'UNAUTHORIZED' }, 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Role '${req.user.role}' is not authorized for this resource.`,
        { code: 'FORBIDDEN', requiredRoles: allowedRoles, currentRole: req.user.role },
        403
      );
    }

    next();
  };
};

module.exports = authorize;
