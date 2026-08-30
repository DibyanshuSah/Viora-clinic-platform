const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/switch-demo', (req, res, next) => authController.switchDemoRole(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

module.exports = router;
