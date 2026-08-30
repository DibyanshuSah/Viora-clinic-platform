const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => prescriptionController.getPrescriptions(req, res, next));
router.get('/:id', authenticate, (req, res, next) => prescriptionController.getPrescriptionById(req, res, next));
router.post('/', authenticate, authorize('DOCTOR', 'ADMIN'), (req, res, next) => prescriptionController.createPrescription(req, res, next));

module.exports = router;
