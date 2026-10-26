const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => appointmentController.getAppointments(req, res, next));
router.get('/:id', authenticate, (req, res, next) => appointmentController.getAppointmentById(req, res, next));
router.post('/', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => appointmentController.createAppointment(req, res, next));
router.post('/:id/end-visit', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => appointmentController.endVisit(req, res, next));
router.post('/:id/retry-whatsapp', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => appointmentController.retryWhatsApp(req, res, next));
router.patch('/:id/status', authenticate, (req, res, next) => appointmentController.updateAppointmentStatus(req, res, next));
router.delete('/:id', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => appointmentController.cancelAppointment(req, res, next));

module.exports = router;
