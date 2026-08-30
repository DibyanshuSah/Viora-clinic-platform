const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, authorize('ADMIN'), (req, res, next) => staffController.getAllStaff(req, res, next));
router.get('/:id', authenticate, authorize('ADMIN'), (req, res, next) => staffController.getStaffById(req, res, next));
router.post('/', authenticate, authorize('ADMIN'), (req, res, next) => staffController.createStaff(req, res, next));
router.put('/:id', authenticate, authorize('ADMIN'), (req, res, next) => staffController.updateStaff(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res, next) => staffController.deleteStaff(req, res, next));

module.exports = router;
