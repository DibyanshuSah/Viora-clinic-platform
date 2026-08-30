const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => doctorController.getAllDoctors(req, res, next));
router.get('/:id', authenticate, (req, res, next) => doctorController.getDoctorById(req, res, next));
router.post('/', authenticate, authorize('ADMIN'), (req, res, next) => doctorController.createDoctor(req, res, next));
router.put('/:id', authenticate, authorize('ADMIN'), (req, res, next) => doctorController.updateDoctor(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res, next) => doctorController.deleteDoctor(req, res, next));

module.exports = router;
