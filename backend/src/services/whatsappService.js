const prisma = require('../config/prisma');
const idGenerator = require('../utils/idGenerator');
const env = require('../config/environment');

class WhatsAppService {
  /**
   * Resolve active WhatsApp API credentials
   * Prioritizes dynamic configuration in SQLite ClinicProfile, falling back to environment variables.
   */
  async getCredentials() {
    const profile = await prisma.clinicProfile.findFirst() || {};
    const apiUrl = profile.whatsappApiUrl || env.whatsappApiUrl || 'https://graph.facebook.com/v20.0';
    const phoneNumberId = profile.whatsappPhoneNumberId || env.whatsappPhoneNumberId || '';
    const accessToken = profile.whatsappAccessToken || env.whatsappAccessToken || '';
    const businessAccountId = profile.whatsappBusinessAccountId || env.whatsappBusinessAccountId || '';

    const isConfigured = Boolean(phoneNumberId && accessToken);

    return {
      apiUrl: apiUrl.replace(/\/+$/, ''),
      phoneNumberId: phoneNumberId.trim(),
      accessToken: accessToken.trim(),
      businessAccountId: businessAccountId.trim(),
      isConfigured
    };
  }

  /**
   * Format phone number to international E.164 digits without '+' or spaces for Meta WhatsApp Cloud API
   */
  formatToMetaRecipient(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      digits = `91${digits}`;
    }
    return digits;
  }

  /**
   * Send WhatsApp bill link and thank-you message to a patient
   */
  async sendBillMessage({ appointmentId = null, billId, patientId, phone, secureLinkUrl, currentUser = null }) {
    if (!billId || !patientId || !secureLinkUrl) {
      throw { statusCode: 400, message: 'Missing required parameters for WhatsApp bill notification' };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const messageId = idGenerator.nextWhatsAppMessageId();

    // Check WhatsApp Consent
    if (patient.whatsappConsent === false) {
      const skippedMsg = await prisma.whatsAppMessage.create({
        data: {
          id: messageId,
          appointmentId: appointmentId || null,
          billId,
          patientId,
          recipientPhone: phone || patient.phone || '',
          messageBody: 'Skipped - Patient has not consented to WhatsApp communications',
          secureLinkUrl,
          status: 'Failed',
          failureReason: 'PATIENT_CONSENT_NOT_GRANTED',
          retryCount: 0
        }
      });

      await prisma.systemAuditLog.create({
        data: {
          action: 'WHATSAPP_SKIPPED',
          resourceType: 'WHATSAPP',
          resourceId: skippedMsg.id,
          patientId,
          userId: currentUser?.userId || currentUser?.id || null,
          userName: currentUser?.name || currentUser?.username || 'System',
          userRole: currentUser?.role || 'SYSTEM',
          status: 'FAILURE',
          details: `WhatsApp skipped: Patient ${patient.name} (${patient.patientId}) has opted out of WhatsApp consent.`
        }
      }).catch(() => {});

      return skippedMsg;
    }

    const targetPhone = phone || patient.whatsappNumber || patient.phone;
    if (!targetPhone) {
      throw { statusCode: 400, message: 'Patient does not have a registered phone number for WhatsApp' };
    }

    // MANDATED VIORA PATIENT BILL & THANK YOU MESSAGE FORMAT
    const appointment = appointmentId ? await prisma.appointment.findUnique({ where: { appointmentId } }) : null;
    const bill = billId ? await prisma.bill.findFirst({ where: { OR: [{ billId }, { invoiceNumber: billId }] } }) : null;

    let visitDateFormatted = '';
    try {
      const rawDate = appointment?.date || bill?.createdAt || new Date();
      visitDateFormatted = new Date(rawDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      visitDateFormatted = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    const messageBody = `Hello ${patient.name}! 👋\n\nThank you for visiting **VIORA Healthcare!** 💚\n\nWe hope you had a comfortable experience with us. Your bill is now available. You can securely view your bill using the link below:\n\n📅 **Visit Date:** ${visitDateFormatted}\n\n🧾 **View Your Bill:** ${secureLinkUrl}\n\nFor your privacy, please do not share this link with anyone else.\n\nThank you for trusting VIORA Healthcare. Take care and stay healthy! 💚\n\n*Your Health, Our Priority.*`;

    // IDEMPOTENCY CHECK:
    // Prevent duplicate messages if already sent or pending for the same bill
    const existingMessage = await prisma.whatsAppMessage.findFirst({
      where: {
        billId,
        status: { in: ['Sent', 'Delivered', 'Pending'] }
      }
    });

    if (existingMessage) {
      console.log(`[WhatsAppService] Idempotency triggered: Message already exists for bill ${billId} with status ${existingMessage.status}`);
      return existingMessage;
    }

    const cleanRecipient = this.formatToMetaRecipient(targetPhone);

    const messageRecord = await prisma.whatsAppMessage.create({
      data: {
        id: messageId,
        appointmentId: appointmentId || null,
        billId,
        patientId,
        recipientPhone: targetPhone,
        messageBody,
        secureLinkUrl,
        status: 'Pending',
        retryCount: 0
      }
    });

    const creds = await this.getCredentials();

    if (creds.isConfigured) {
      try {
        const metaEndpoint = `${creds.apiUrl}/${creds.phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanRecipient,
          type: 'text',
          text: {
            preview_url: true,
            body: messageBody
          }
        };

        const response = await fetch(metaEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = data.error?.message || `Meta API HTTP ${response.status}`;
          const failed = await prisma.whatsAppMessage.update({
            where: { id: messageId },
            data: {
              status: 'Failed',
              failureReason: errMsg,
              failedAt: new Date()
            }
          });

          await prisma.systemAuditLog.create({
            data: {
              action: 'WHATSAPP_FAILED',
              resourceType: 'WHATSAPP',
              resourceId: messageId,
              patientId,
              userId: currentUser?.userId || currentUser?.id || null,
              userName: currentUser?.name || currentUser?.username || 'Staff',
              userRole: currentUser?.role || 'STAFF',
              status: 'FAILURE',
              details: `WhatsApp send failed for patient ${patient.name}: ${errMsg}`
            }
          }).catch(() => {});

          return failed;
        }

        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        const sent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: metaMessageId,
            sentAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_SENT',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `WhatsApp bill link sent via Meta Cloud API to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)} (Meta ID: ${metaMessageId})`
          }
        }).catch(() => {});

        return sent;
      } catch (networkErr) {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: `Network error connecting to Meta WhatsApp API: ${networkErr.message}`,
            failedAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_FAILED',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'FAILURE',
            details: `Network failure sending WhatsApp: ${networkErr.message}`
          }
        }).catch(() => {});

        return failed;
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const simulatedExternalId = `sim_wamid_${Date.now()}`;
        const simSent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: simulatedExternalId,
            sentAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_SENT',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `Simulated WhatsApp dispatch to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)} (Sandbox Mode)`
          }
        }).catch(() => {});

        return simSent;
      } else {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED: Meta Phone Number ID and Access Token are required.',
            failedAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_FAILED',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'FAILURE',
            details: `WhatsApp dispatch failed: Meta Business credentials missing in system configuration`
          }
        }).catch(() => {});

        return failed;
      }
    }
  }

  /**
   * Schedule WhatsApp Patient Registration Message to be sent after delay (default: 60 seconds)
   */
  scheduleRegistrationMessage(patientId, delayMs = 60000, currentUser = null) {
    console.log(`[WhatsAppService] Patient ${patientId} registration successful. Scheduling WhatsApp message in ${delayMs / 1000} seconds...`);
    const timer = setTimeout(async () => {
      try {
        console.log(`[WhatsAppService] Delay elapsed. Dispatching Registration Message for patient ${patientId}...`);
        await this.sendRegistrationMessage({ patientId, currentUser });
      } catch (err) {
        console.error(`[WhatsAppService] Failed to dispatch scheduled registration message for patient ${patientId}:`, err);
      }
    }, delayMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    return timer;
  }

  /**
   * Send WhatsApp Patient Registration Message to a newly registered patient
   */
  async sendRegistrationMessage({ patientId, phone, currentUser = null }) {
    if (!patientId) {
      throw { statusCode: 400, message: 'Missing patientId for registration message' };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    const messageId = idGenerator.nextWhatsAppMessageId();

    if (patient.whatsappConsent === false) {
      const skippedMsg = await prisma.whatsAppMessage.create({
        data: {
          id: messageId,
          appointmentId: null,
          billId: null,
          patientId,
          recipientPhone: phone || patient.phone || '',
          messageBody: 'Skipped - Patient has not consented to WhatsApp communications',
          secureLinkUrl: null,
          status: 'Failed',
          failureReason: 'PATIENT_CONSENT_NOT_GRANTED',
          retryCount: 0
        }
      });

      await prisma.systemAuditLog.create({
        data: {
          action: 'WHATSAPP_SKIPPED',
          resourceType: 'WHATSAPP',
          resourceId: skippedMsg.id,
          patientId,
          userId: currentUser?.userId || currentUser?.id || null,
          userName: currentUser?.name || currentUser?.username || 'System',
          userRole: currentUser?.role || 'SYSTEM',
          status: 'FAILURE',
          details: `Registration WhatsApp skipped: Patient ${patient.name} (${patient.patientId}) has opted out of WhatsApp consent.`
        }
      }).catch(() => {});

      return skippedMsg;
    }

    const targetPhone = phone || patient.whatsappNumber || patient.phone;
    if (!targetPhone) {
      throw { statusCode: 400, message: 'Patient does not have a registered phone number for WhatsApp' };
    }

    // Idempotency: Prevent duplicate registration messages
    const existingMessage = await prisma.whatsAppMessage.findFirst({
      where: {
        patientId,
        status: { in: ['Sent', 'Delivered', 'Pending'] },
        messageBody: { contains: 'Welcome to **VIORA Healthcare!**' }
      }
    });

    if (existingMessage) {
      console.log(`[WhatsAppService] Idempotency: Registration message already exists for patient ${patientId}`);
      return existingMessage;
    }

    let regDateFormatted = '';
    try {
      const rawDate = patient.createdAt || new Date();
      regDateFormatted = new Date(rawDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      regDateFormatted = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    const messageBody = `Hello ${patient.name}! 👋\n\nWelcome to **VIORA Healthcare!** 💚\n\nThank you for registering with us on **${regDateFormatted}**. Your registration has been completed successfully.\n\nWe look forward to providing you with a smooth and comfortable healthcare experience.\n\nThank you for choosing VIORA Healthcare!\n\n*Your Health, Our Priority.* 💚`;
    const cleanRecipient = this.formatToMetaRecipient(targetPhone);

    await prisma.whatsAppMessage.create({
      data: {
        id: messageId,
        appointmentId: null,
        billId: null,
        patientId,
        recipientPhone: targetPhone,
        messageBody,
        secureLinkUrl: null,
        status: 'Pending',
        retryCount: 0
      }
    });

    const creds = await this.getCredentials();

    if (creds.isConfigured) {
      try {
        const metaEndpoint = `${creds.apiUrl}/${creds.phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody
          }
        };

        const response = await fetch(metaEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = data.error?.message || `Meta API HTTP ${response.status}`;
          const failed = await prisma.whatsAppMessage.update({
            where: { id: messageId },
            data: {
              status: 'Failed',
              failureReason: errMsg,
              failedAt: new Date()
            }
          });

          await prisma.systemAuditLog.create({
            data: {
              action: 'WHATSAPP_FAILED',
              resourceType: 'WHATSAPP',
              resourceId: messageId,
              patientId,
              userId: currentUser?.userId || currentUser?.id || null,
              userName: currentUser?.name || currentUser?.username || 'Staff',
              userRole: currentUser?.role || 'STAFF',
              status: 'FAILURE',
              details: `WhatsApp registration send failed for patient ${patient.name}: ${errMsg}`
            }
          }).catch(() => {});

          return failed;
        }

        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        const sent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: metaMessageId,
            sentAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_SENT',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `WhatsApp registration message sent via Meta Cloud API to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)}`
          }
        }).catch(() => {});

        return sent;
      } catch (networkErr) {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: `Network error: ${networkErr.message}`,
            failedAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_FAILED',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'FAILURE',
            details: `Network failure sending WhatsApp registration: ${networkErr.message}`
          }
        }).catch(() => {});

        return failed;
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const simulatedExternalId = `sim_reg_wamid_${Date.now()}`;
        const simSent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: simulatedExternalId,
            sentAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_SENT',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `Simulated WhatsApp registration message dispatched to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)}`
          }
        }).catch(() => {});

        return simSent;
      } else {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED',
            failedAt: new Date()
          }
        });
        return failed;
      }
    }
  }

  /**
   * Retry sending a failed WhatsApp message
   */
  async retryMessage(messageId, currentUser = null) {
    const message = await prisma.whatsAppMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      throw { statusCode: 404, message: 'WhatsApp message record not found' };
    }

    const patient = await prisma.patient.findUnique({ where: { patientId: message.patientId } });
    if (!patient) {
      throw { statusCode: 404, message: 'Patient record associated with this message not found' };
    }

    if (patient.whatsappConsent === false) {
      throw { statusCode: 400, message: 'Cannot retry: Patient has not consented to WhatsApp messages' };
    }

    const targetPhone = patient.whatsappNumber || patient.phone || message.recipientPhone;
    const cleanRecipient = this.formatToMetaRecipient(targetPhone);
    const retryCount = (message.retryCount || 0) + 1;

    const creds = await this.getCredentials();

    if (creds.isConfigured) {
      try {
        const metaEndpoint = `${creds.apiUrl}/${creds.phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanRecipient,
          type: 'text',
          text: {
            preview_url: true,
            body: message.messageBody
          }
        };

        const response = await fetch(metaEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = data.error?.message || `Meta API HTTP ${response.status}`;
          const failed = await prisma.whatsAppMessage.update({
            where: { id: messageId },
            data: {
              status: 'Failed',
              failureReason: errMsg,
              retryCount,
              lastRetriedAt: new Date(),
              failedAt: new Date()
            }
          });

          await prisma.systemAuditLog.create({
            data: {
              action: 'WHATSAPP_RETRIED',
              resourceType: 'WHATSAPP',
              resourceId: message.id,
              patientId: message.patientId,
              userId: currentUser?.userId || currentUser?.id || null,
              userName: currentUser?.name || currentUser?.username || 'Staff',
              userRole: currentUser?.role || 'STAFF',
              status: 'FAILURE',
              details: `Retry #${retryCount} failed for Invoice: ${errMsg}`
            }
          }).catch(() => {});

          return failed;
        }

        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        const sent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: metaMessageId,
            retryCount,
            lastRetriedAt: new Date(),
            sentAt: new Date(),
            failureReason: null
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_RETRIED',
            resourceType: 'WHATSAPP',
            resourceId: message.id,
            patientId: message.patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `WhatsApp message retried successfully via Meta Cloud API (Attempt #${retryCount})`
          }
        }).catch(() => {});

        return sent;
      } catch (err) {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: `Retry failed: ${err.message}`,
            retryCount,
            lastRetriedAt: new Date(),
            failedAt: new Date()
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_RETRIED',
            resourceType: 'WHATSAPP',
            resourceId: message.id,
            patientId: message.patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'FAILURE',
            details: `WhatsApp retry network error: ${err.message}`
          }
        }).catch(() => {});

        return failed;
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const simSent = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Sent',
            externalMessageId: `sim_retry_wamid_${Date.now()}`,
            retryCount,
            lastRetriedAt: new Date(),
            sentAt: new Date(),
            failureReason: null
          }
        });

        await prisma.systemAuditLog.create({
          data: {
            action: 'WHATSAPP_RETRIED',
            resourceType: 'WHATSAPP',
            resourceId: message.id,
            patientId: message.patientId,
            userId: currentUser?.userId || currentUser?.id || null,
            userName: currentUser?.name || currentUser?.username || 'Staff',
            userRole: currentUser?.role || 'STAFF',
            status: 'SUCCESS',
            details: `Simulated retry #${retryCount} succeeded (Sandbox Mode)`
          }
        }).catch(() => {});

        return simSent;
      } else {
        const failed = await prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'Failed',
            failureReason: 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED',
            retryCount,
            lastRetriedAt: new Date(),
            failedAt: new Date()
          }
        });
        return failed;
      }
    }
  }

  /**
   * Handle incoming Meta WhatsApp Webhook event (status updates)
   */
  async handleWebhookStatusUpdate(body) {
    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const statuses = change?.statuses;

      if (!Array.isArray(statuses) || statuses.length === 0) {
        return { processed: 0 };
      }

      let updatedCount = 0;
      for (const st of statuses) {
        const metaId = st.id;
        const statusStr = st.status; // 'sent' | 'delivered' | 'read' | 'failed'

        const msg = await prisma.whatsAppMessage.findFirst({
          where: { externalMessageId: metaId }
        });

        if (msg) {
          const updateData = {};
          if (statusStr === 'delivered' || statusStr === 'read') {
            updateData.status = 'Delivered';
            updateData.deliveredAt = new Date();
          } else if (statusStr === 'failed') {
            updateData.status = 'Failed';
            updateData.failedAt = new Date();
            updateData.failureReason = st.errors?.[0]?.message || 'Delivery failed from carrier';
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.whatsAppMessage.update({
              where: { id: msg.id },
              data: updateData
            });
            updatedCount++;

            await prisma.systemAuditLog.create({
              data: {
                action: 'WHATSAPP_STATUS_UPDATED',
                resourceType: 'WHATSAPP',
                resourceId: msg.id,
                patientId: msg.patientId,
                status: updateData.status === 'Failed' ? 'FAILURE' : 'SUCCESS',
                details: `Meta status callback: status updated to "${updateData.status}" for recipient ${msg.recipientPhone.slice(0, 4)}****`
              }
            }).catch(() => {});
          }
        }
      }

      return { processed: updatedCount };
    } catch (err) {
      console.error('[WhatsApp Webhook Error]', err);
      return { processed: 0, error: err.message };
    }
  }

  /**
   * Test WhatsApp configuration connection by sending a test message
   */
  async testConnection(targetPhone, currentUser = null) {
    const creds = await this.getCredentials();
    if (!creds.isConfigured) {
      return {
        success: false,
        configured: false,
        message: 'WhatsApp Business API is not configured. Please supply Phone Number ID and Access Token.'
      };
    }

    try {
      const cleanRecipient = this.formatToMetaRecipient(targetPhone);
      const metaEndpoint = `${creds.apiUrl}/${creds.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanRecipient,
        type: 'text',
        text: {
          preview_url: false,
          body: 'This is a test notification from VIORA Healthcare Clinic Management System. Your WhatsApp integration is connected successfully.'
        }
      };

      const response = await fetch(metaEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          configured: true,
          message: data.error?.message || `Meta WhatsApp API error (HTTP ${response.status})`,
          error: data.error
        };
      }

      await prisma.systemAuditLog.create({
        data: {
          action: 'WHATSAPP_TEST_SENT',
          resourceType: 'WHATSAPP',
          userId: currentUser?.userId || currentUser?.id || null,
          userName: currentUser?.name || currentUser?.username || 'Admin',
          userRole: currentUser?.role || 'ADMIN',
          status: 'SUCCESS',
          details: `Test WhatsApp notification sent to ${targetPhone.slice(0, 4)}**** via Meta API`
        }
      }).catch(() => {});

      return {
        success: true,
        configured: true,
        message: 'Test message sent successfully via Meta WhatsApp Business Cloud API!',
        metaMessageId: data.messages?.[0]?.id
      };
    } catch (err) {
      return {
        success: false,
        configured: true,
        message: `Connection failed: ${err.message}`
      };
    }
  }

  /**
   * Get all WhatsApp messages with optional filters directly from SQLite
   */
  async getMessages(filters = {}) {
    const where = {};
    if (filters.billId) where.billId = filters.billId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.appointmentId) where.appointmentId = filters.appointmentId;
    if (filters.status) where.status = { equals: filters.status };

    const messages = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        bill: true
      }
    });

    return messages.map(m => ({
      ...m,
      patientName: m.patient?.name || 'Unknown Patient',
      invoiceNumber: m.bill?.invoiceNumber || null,
      billTotal: m.bill?.total || 0
    }));
  }
}

module.exports = new WhatsAppService();
