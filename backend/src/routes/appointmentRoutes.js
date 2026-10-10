const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authenticate = require('../middleware/auth');

router.get('/', authenticate, (req, res, next) => appointmentController.getAppointments(req, res, next));
router.get('/:id', authenticate, (req, res, next) => appointmentController.getAppointmentById(req, res, next));
router.post('/', authenticate, (req, res, next) => appointmentController.createAppointment(req, res, next));
router.patch('/:id/status', authenticate, (req, res, next) => appointmentController.updateAppointmentStatus(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => appointmentController.cancelAppointment(req, res, next));

module.exports = router;
