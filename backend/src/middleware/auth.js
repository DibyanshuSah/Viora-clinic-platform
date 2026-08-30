const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/environment');
const db = require('../config/database');
const { errorResponse } = require('../utils/responseHandler');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authorization token required', { code: 'UNAUTHORIZED' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    const user = db.users.find(u => u.id === decoded.id && u.status === 'Active');
    if (!user) {
      return errorResponse(res, 'User session invalid or user deactivated', { code: 'INVALID_SESSION' }, 401);
    }

    // Attach user information without password
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired. Please login again.', { code: 'TOKEN_EXPIRED' }, 401);
    }
    return errorResponse(res, 'Invalid authentication token', { code: 'INVALID_TOKEN' }, 401);
  }
};

module.exports = authenticate;
