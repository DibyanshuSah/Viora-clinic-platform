const whatsappService = require('../services/whatsappService');
const env = require('../config/environment');

class WhatsAppController {
  /**
   * Meta Webhook Verification (GET request from Meta during webhook subscription)
   */
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = env.whatsappWebhookVerifyToken || 'viora_webhook_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return res.status(200).send(challenge);
    } else {
      console.warn('[WhatsApp Webhook] Verification failed: Invalid verify token');
      return res.status(403).json({ error: 'Verification token mismatch' });
    }
  }

  /**
   * Meta Webhook Event Handler (POST request from Meta with message delivery updates)
   */
  handleWebhookEvents(req, res) {
    try {
      const result = whatsappService.handleWebhookStatusUpdate(req.body);
      return res.status(200).json({ success: true, processed: result.processed });
    } catch (err) {
      console.error('[WhatsApp Webhook Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new WhatsAppController();
