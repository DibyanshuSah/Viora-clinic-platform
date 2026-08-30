const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const analyticsController = require('../controllers/analyticsController');
const clinicController = require('../controllers/clinicController');
const doctorController = require('../controllers/doctorController');
const staffController = require('../controllers/staffController');
const procedureController = require('../controllers/procedureController');

// All /api/v1/admin routes are protected and strictly ADMIN only
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard-overview', (req, res, next) => analyticsController.getAdminAnalytics(req, res, next));
router.get('/clinic-profile', (req, res, next) => clinicController.getProfile(req, res, next));
router.put('/clinic-profile', (req, res, next) => clinicController.updateProfile(req, res, next));

module.exports = router;
