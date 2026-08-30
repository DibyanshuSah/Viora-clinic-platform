const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const authenticate = require('../middleware/auth');

router.get('/', authenticate, (req, res, next) => patientController.getAllPatients(req, res, next));
router.get('/:id', authenticate, (req, res, next) => patientController.getPatientById(req, res, next));
router.post('/', authenticate, (req, res, next) => patientController.createPatient(req, res, next));
router.put('/:id', authenticate, (req, res, next) => patientController.updatePatient(req, res, next));

module.exports = router;
