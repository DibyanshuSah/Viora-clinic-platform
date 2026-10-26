const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'viora_clinic_secret_key_jwt_2026_super_secure',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  clinicName: process.env.CLINIC_NAME || 'VIORA',
  whatsappApiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'viora_webhook_verify_token_2026',
  billLinkExpiryDays: parseInt(process.env.BILL_LINK_EXPIRY_DAYS || '365', 10),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173'
};
