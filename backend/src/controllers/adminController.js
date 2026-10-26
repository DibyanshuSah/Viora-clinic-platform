const db = require('../config/database');
const env = require('../config/environment');
const whatsappService = require('../services/whatsappService');
const { successResponse } = require('../utils/responseHandler');

class AdminController {
  /**
   * Retrieve system audit logs with filters (ADMIN role only)
   */
  getAuditLogs(req, res, next) {
    try {
      const { action, resourceType, status, search, limit = 100 } = req.query;
      let logs = [...db.auditLogs];

      if (action) {
        logs = logs.filter(l => l.action.toLowerCase() === action.toLowerCase());
      }
      if (resourceType) {
        logs = logs.filter(l => l.resourceType.toLowerCase() === resourceType.toLowerCase());
      }
      if (status) {
        logs = logs.filter(l => l.status.toLowerCase() === status.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        logs = logs.filter(l =>
          (l.action && l.action.toLowerCase().includes(q)) ||
          (l.userName && l.userName.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          (l.resourceId && l.resourceId.toLowerCase().includes(q))
        );
      }

      // Sort newest first
      logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const paged = logs.slice(0, parseInt(limit, 10));

      return successResponse(res, 'System audit logs retrieved successfully', {
        total: logs.length,
        logs: paged
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve WhatsApp and link expiry configuration
   */
  getWhatsAppSettings(req, res, next) {
    try {
      const profile = db.clinicProfile || {};
      const token = profile.whatsappAccessToken || env.whatsappAccessToken || '';
      const maskedToken = token ? `${token.substring(0, 6)}...${token.slice(-4)}` : '';

      const settings = {
        whatsappEnabled: profile.whatsappEnabled !== undefined ? profile.whatsappEnabled : false,
        whatsappApiUrl: profile.whatsappApiUrl || env.whatsappApiUrl || 'https://graph.facebook.com/v20.0',
        whatsappPhoneNumberId: profile.whatsappPhoneNumberId || env.whatsappPhoneNumberId || '',
        whatsappBusinessAccountId: profile.whatsappBusinessAccountId || env.whatsappBusinessAccountId || '',
        whatsappAccessTokenMasked: maskedToken,
        isTokenConfigured: Boolean(token),
        whatsappDefaultExpiryDays: profile.whatsappDefaultExpiryDays || env.billLinkExpiryDays || 365,
        whatsappAutoSendOnEnd: profile.whatsappAutoSendOnEnd !== undefined ? profile.whatsappAutoSendOnEnd : true,
        appBaseUrl: env.appBaseUrl || 'http://localhost:5173',
        webhookVerifyToken: env.whatsappWebhookVerifyToken || 'viora_webhook_verify_token_2026'
      };

      return successResponse(res, 'WhatsApp settings retrieved successfully', settings);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update WhatsApp and link expiry configuration
   */
  updateWhatsAppSettings(req, res, next) {
    try {
      const {
        whatsappEnabled,
        whatsappApiUrl,
        whatsappPhoneNumberId,
        whatsappBusinessAccountId,
        whatsappAccessToken,
        whatsappDefaultExpiryDays,
        whatsappAutoSendOnEnd
      } = req.body;

      if (!db.clinicProfile) {
        db.clinicProfile = {};
      }

      if (whatsappEnabled !== undefined) {
        db.clinicProfile.whatsappEnabled = Boolean(whatsappEnabled);
      }
      if (whatsappApiUrl !== undefined) {
        db.clinicProfile.whatsappApiUrl = String(whatsappApiUrl).trim();
      }
      if (whatsappPhoneNumberId !== undefined) {
        db.clinicProfile.whatsappPhoneNumberId = String(whatsappPhoneNumberId).trim();
      }
      if (whatsappBusinessAccountId !== undefined) {
        db.clinicProfile.whatsappBusinessAccountId = String(whatsappBusinessAccountId).trim();
      }
      // Only update token if a new non-masked value was provided
      if (whatsappAccessToken && !whatsappAccessToken.includes('...')) {
        db.clinicProfile.whatsappAccessToken = String(whatsappAccessToken).trim();
      }
      if (whatsappDefaultExpiryDays !== undefined) {
        db.clinicProfile.whatsappDefaultExpiryDays = Math.max(1, parseInt(whatsappDefaultExpiryDays, 10));
      }
      if (whatsappAutoSendOnEnd !== undefined) {
        db.clinicProfile.whatsappAutoSendOnEnd = Boolean(whatsappAutoSendOnEnd);
      }

      db.clinicProfile.updatedAt = new Date().toISOString();

      db.logAuditAction({
        action: 'SETTINGS_UPDATED',
        resourceType: 'SETTING',
        user: req.user,
        details: `Updated WhatsApp configuration and bill link policies (Expiry: ${db.clinicProfile.whatsappDefaultExpiryDays} days, Auto-send: ${db.clinicProfile.whatsappAutoSendOnEnd})`
      });

      return successResponse(res, 'WhatsApp & Security settings updated successfully', {
        whatsappEnabled: db.clinicProfile.whatsappEnabled,
        whatsappPhoneNumberId: db.clinicProfile.whatsappPhoneNumberId,
        whatsappDefaultExpiryDays: db.clinicProfile.whatsappDefaultExpiryDays,
        whatsappAutoSendOnEnd: db.clinicProfile.whatsappAutoSendOnEnd
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Test WhatsApp Connection by sending a ping notification
   */
  async testWhatsApp(req, res, next) {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        throw { statusCode: 400, message: 'Recipient phone number is required for test' };
      }

      const result = await whatsappService.testConnection(phoneNumber, req.user);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }

      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
