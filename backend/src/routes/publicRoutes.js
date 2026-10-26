const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { publicBillLimiter } = require('../middleware/rateLimiter');

// Rate-limited public endpoint for patients accessing bills via UUID token
router.get('/bills/:token', publicBillLimiter, (req, res, next) => publicController.getBillByToken(req, res, next));

module.exports = router;
