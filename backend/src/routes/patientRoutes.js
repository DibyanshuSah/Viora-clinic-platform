const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => patientController.getAllPatients(req, res, next));
router.get('/next-id', authenticate, (req, res, next) => patientController.getNextPatientId(req, res, next));
router.get('/:id', authenticate, (req, res, next) => patientController.getPatientById(req, res, next));
router.post('/', authenticate, (req, res, next) => patientController.createPatient(req, res, next));
router.put('/:id', authenticate, (req, res, next) => patientController.updatePatient(req, res, next));
// Archive (soft-deactivation) — ADMIN and STAFF only; physical deletion is prohibited
router.patch('/:id/archive', authenticate, authorize('ADMIN', 'STAFF'), (req, res, next) => patientController.archivePatient(req, res, next));
// DELETE is aliased to archive to prevent accidental physical deletion; kept ADMIN-only
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res, next) => patientController.archivePatient(req, res, next));

module.exports = router;
