const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { webhookLimiter } = require('../middleware/rateLimiter');

// Meta Webhook Verification (Challenge from Meta App Dashboard)
router.get('/webhook', (req, res) => whatsappController.verifyWebhook(req, res));

// Meta Webhook Delivery Status Callbacks (sent, delivered, read, failed)
router.post('/webhook', webhookLimiter, (req, res) => whatsappController.handleWebhookEvents(req, res));

module.exports = router;
