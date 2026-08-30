const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

// STRICT RBAC: Analytics is ONLY accessible by ADMIN
router.get('/', authenticate, authorize('ADMIN'), (req, res, next) => analyticsController.getAdminAnalytics(req, res, next));

module.exports = router;
