const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => consultationController.getConsultations(req, res, next));
router.get('/patient/:patientId/history', authenticate, (req, res, next) => consultationController.getPatientHistory(req, res, next));
router.get('/:id', authenticate, (req, res, next) => consultationController.getConsultationById(req, res, next));
router.post('/', authenticate, authorize('DOCTOR', 'ADMIN'), (req, res, next) => consultationController.saveConsultation(req, res, next));

module.exports = router;
