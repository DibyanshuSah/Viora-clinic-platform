const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authenticate = require('../middleware/auth');

router.get('/doctors', authenticate, (req, res, next) => appointmentController.getDoctorSchedules(req, res, next));

module.exports = router;
