const express = require('express');
const router = express.Router();
const clinicController = require('../controllers/clinicController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', (req, res, next) => clinicController.getProfile(req, res, next));
router.put('/', authenticate, authorize('ADMIN'), (req, res, next) => clinicController.updateProfile(req, res, next));

module.exports = router;
