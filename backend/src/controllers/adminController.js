const prisma = require('../config/prisma');
const env = require('../config/environment');
const whatsappService = require('../services/whatsappService');
const { successResponse } = require('../utils/responseHandler');

class AdminController {
  /**
   * Retrieve system audit logs with filters (ADMIN role only) directly from SQLite
   */
  async getAuditLogs(req, res, next) {
    try {
      const { action, resourceType, status, search, limit = 100 } = req.query;
      const where = {};

      if (action) {
        where.action = { equals: action };
      }
      if (resourceType) {
        where.resourceType = { equals: resourceType };
      }
      if (status) {
        where.status = { equals: status };
      }
      if (search) {
        where.OR = [
          { action: { contains: search } },
          { userName: { contains: search } },
          { details: { contains: search } },
          { resourceId: { contains: search } }
        ];
      }

      const total = await prisma.systemAuditLog.count({ where });
      const logs = await prisma.systemAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10) || 100
      });

      return successResponse(res, 'System audit logs retrieved successfully', {
        total,
        logs
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve WhatsApp and link expiry configuration directly from SQLite
   */
  async getWhatsAppSettings(req, res, next) {
    try {
      const profile = await prisma.clinicProfile.findFirst() || {};
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
   * Update WhatsApp and link expiry configuration directly in SQLite
   */
  async updateWhatsAppSettings(req, res, next) {
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

      let profile = await prisma.clinicProfile.findFirst();
      if (!profile) {
        profile = await prisma.clinicProfile.create({
          data: {
            id: 'viora-primary',
            clinicName: 'VIORA Healthcare'
          }
        });
      }

      const updateData = {};

      if (whatsappEnabled !== undefined) {
        updateData.whatsappEnabled = Boolean(whatsappEnabled);
      }
      if (whatsappApiUrl !== undefined) {
        updateData.whatsappApiUrl = String(whatsappApiUrl).trim();
      }
      if (whatsappPhoneNumberId !== undefined) {
        updateData.whatsappPhoneNumberId = String(whatsappPhoneNumberId).trim();
      }
      if (whatsappBusinessAccountId !== undefined) {
        updateData.whatsappBusinessAccountId = String(whatsappBusinessAccountId).trim();
      }
      if (whatsappAccessToken && !whatsappAccessToken.includes('...')) {
        updateData.whatsappAccessToken = String(whatsappAccessToken).trim();
      }
      if (whatsappDefaultExpiryDays !== undefined) {
        updateData.whatsappDefaultExpiryDays = Math.max(1, parseInt(whatsappDefaultExpiryDays, 10));
      }
      if (whatsappAutoSendOnEnd !== undefined) {
        updateData.whatsappAutoSendOnEnd = Boolean(whatsappAutoSendOnEnd);
      }

      const updated = await prisma.clinicProfile.update({
        where: { id: profile.id },
        data: updateData
      });

      await prisma.systemAuditLog.create({
        data: {
          action: 'SETTINGS_UPDATED',
          resourceType: 'SETTING',
          userId: req.user?.userId || req.user?.id || null,
          userName: req.user?.name || req.user?.username || 'Admin',
          userRole: req.user?.role || 'ADMIN',
          status: 'SUCCESS',
          details: `Updated WhatsApp configuration and bill link policies (Expiry: ${updated.whatsappDefaultExpiryDays} days, Auto-send: ${updated.whatsappAutoSendOnEnd})`
        }
      }).catch(() => {});

      return successResponse(res, 'WhatsApp & Security settings updated successfully', {
        whatsappEnabled: updated.whatsappEnabled,
        whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
        whatsappDefaultExpiryDays: updated.whatsappDefaultExpiryDays,
        whatsappAutoSendOnEnd: updated.whatsappAutoSendOnEnd
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
