const db = require('../config/database');
const env = require('../config/environment');

class WhatsAppService {
  /**
   * Resolve active WhatsApp API credentials
   * Prioritizes Admin dynamic configuration in ClinicProfile, falling back to environment variables.
   */
  getCredentials() {
    const profile = db.clinicProfile || {};
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
   * e.g. "+91 98450 12345" -> "919845012345"
   */
  formatToMetaRecipient(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      // Default to India country code 91 if 10 digits
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

    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Check WhatsApp Consent
    if (patient.whatsappConsent === false) {
      const skippedMsg = {
        id: db.nextWhatsAppMessageId(),
        appointmentId: appointmentId || null,
        billId,
        patientId,
        recipientPhone: phone || patient.phone || '',
        messageBody: 'Skipped - Patient has not consented to WhatsApp communications',
        secureLinkUrl,
        status: 'Failed',
        failureReason: 'PATIENT_CONSENT_NOT_GRANTED',
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.whatsappMessages.unshift(skippedMsg);
      db.logAuditAction({
        action: 'WHATSAPP_SKIPPED',
        resourceType: 'WHATSAPP',
        resourceId: skippedMsg.id,
        patientId,
        user: currentUser,
        status: 'FAILURE',
        details: `WhatsApp skipped: Patient ${patient.name} (${patient.patientId}) has opted out of WhatsApp consent.`
      });
      return skippedMsg;
    }

    const targetPhone = phone || patient.whatsappNumber || patient.phone;
    if (!targetPhone) {
      throw { statusCode: 400, message: 'Patient does not have a registered phone number for WhatsApp' };
    }

    // MANDATED VIORA PATIENT BILL & THANK YOU MESSAGE FORMAT
    const appointment = appointmentId ? db.appointments.find(a => a.appointmentId === appointmentId) : null;
    const bill = billId ? db.bills.find(b => b.billId === billId) : null;
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
    // Prevent duplicate messages if already sent or pending for the same bill within 1 hour
    const existingMessage = db.whatsappMessages.find(
      m => m.billId === billId && (m.status === 'Sent' || m.status === 'Delivered' || m.status === 'Pending')
    );

    if (existingMessage) {
      console.log(`[WhatsAppService] Idempotency triggered: Message already exists for bill ${billId} with status ${existingMessage.status}`);
      return existingMessage;
    }

    const messageId = db.nextWhatsAppMessageId();
    const cleanRecipient = this.formatToMetaRecipient(targetPhone);

    const messageRecord = {
      id: messageId,
      appointmentId: appointmentId || null,
      billId,
      patientId,
      recipientPhone: targetPhone,
      messageBody,
      secureLinkUrl,
      status: 'Pending', // Pending | Sent | Delivered | Failed
      externalMessageId: null,
      failureReason: null,
      retryCount: 0,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      lastRetriedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.whatsappMessages.unshift(messageRecord);

    const creds = this.getCredentials();

    if (creds.isConfigured) {
      // Execute REAL HTTP call to Meta WhatsApp Business Cloud API
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
          messageRecord.status = 'Failed';
          messageRecord.failureReason = errMsg;
          messageRecord.failedAt = new Date().toISOString();
          messageRecord.updatedAt = new Date().toISOString();

          db.logAuditAction({
            action: 'WHATSAPP_FAILED',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            user: currentUser,
            status: 'FAILURE',
            details: `WhatsApp send failed for patient ${patient.name}: ${errMsg}`
          });

          return messageRecord;
        }

        // Successfully dispatched to Meta WhatsApp Cloud API
        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        messageRecord.status = 'Sent';
        messageRecord.externalMessageId = metaMessageId;
        messageRecord.sentAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_SENT',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `WhatsApp bill link sent via Meta Cloud API to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)} (Meta ID: ${metaMessageId})`
        });

        return messageRecord;
      } catch (networkErr) {
        messageRecord.status = 'Failed';
        messageRecord.failureReason = `Network error connecting to Meta WhatsApp API: ${networkErr.message}`;
        messageRecord.failedAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_FAILED',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'FAILURE',
          details: `Network failure sending WhatsApp: ${networkErr.message}`
        });

        return messageRecord;
      }
    } else {
      // Credentials not yet configured
      console.warn(
        `[WhatsApp Business Platform] Meta Cloud API credentials not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env or via Admin Settings.`
      );

      // In development / demo environment without active Meta credentials:
      // We mark as Sent (Sandbox mode) with clear simulated indicator so the workflow and UI can be fully verified.
      if (process.env.NODE_ENV !== 'production') {
        const simulatedExternalId = `sim_wamid_${Date.now()}`;
        messageRecord.status = 'Sent';
        messageRecord.externalMessageId = simulatedExternalId;
        messageRecord.sentAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();
        messageRecord.note = 'Simulated delivery in development mode. Real Meta Cloud API will execute automatically when credentials are provided in Admin Settings or .env.';

        db.logAuditAction({
          action: 'WHATSAPP_SENT',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `Simulated WhatsApp dispatch to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)} (Meta API credentials pending in Admin Settings)`
        });

        return messageRecord;
      } else {
        messageRecord.status = 'Failed';
        messageRecord.failureReason = 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED: Meta Phone Number ID and Access Token are required.';
        messageRecord.failedAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_FAILED',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'FAILURE',
          details: `WhatsApp dispatch failed: Meta Business credentials missing in system configuration`
        });

        return messageRecord;
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
        console.log(`[WhatsAppService] 60-second delay elapsed. Dispatching Registration Message for patient ${patientId}...`);
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

    const patient = db.patients.find(p => p.patientId === patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient not found' };
    }

    // Check WhatsApp Consent
    if (patient.whatsappConsent === false) {
      const skippedMsg = {
        id: db.nextWhatsAppMessageId(),
        messageType: 'REGISTRATION',
        appointmentId: null,
        billId: null,
        patientId,
        recipientPhone: phone || patient.phone || '',
        messageBody: 'Skipped - Patient has not consented to WhatsApp communications',
        secureLinkUrl: null,
        status: 'Failed',
        failureReason: 'PATIENT_CONSENT_NOT_GRANTED',
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.whatsappMessages.unshift(skippedMsg);
      db.logAuditAction({
        action: 'WHATSAPP_SKIPPED',
        resourceType: 'WHATSAPP',
        resourceId: skippedMsg.id,
        patientId,
        user: currentUser,
        status: 'FAILURE',
        details: `Registration WhatsApp skipped: Patient ${patient.name} (${patient.patientId}) has opted out of WhatsApp consent.`
      });
      return skippedMsg;
    }

    const targetPhone = phone || patient.whatsappNumber || patient.phone;
    if (!targetPhone) {
      throw { statusCode: 400, message: 'Patient does not have a registered phone number for WhatsApp' };
    }

    // Idempotency: Prevent duplicate registration messages for the same patient
    const existingMessage = db.whatsappMessages.find(
      m => m.patientId === patientId && m.messageType === 'REGISTRATION' && (m.status === 'Sent' || m.status === 'Delivered' || m.status === 'Pending')
    );

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

    const messageId = db.nextWhatsAppMessageId();
    const cleanRecipient = this.formatToMetaRecipient(targetPhone);

    const messageRecord = {
      id: messageId,
      messageType: 'REGISTRATION',
      appointmentId: null,
      billId: null,
      patientId,
      recipientPhone: targetPhone,
      messageBody,
      secureLinkUrl: null,
      status: 'Pending',
      externalMessageId: null,
      failureReason: null,
      retryCount: 0,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      lastRetriedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.whatsappMessages.unshift(messageRecord);

    const creds = this.getCredentials();

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
          messageRecord.status = 'Failed';
          messageRecord.failureReason = errMsg;
          messageRecord.failedAt = new Date().toISOString();
          messageRecord.updatedAt = new Date().toISOString();

          db.logAuditAction({
            action: 'WHATSAPP_FAILED',
            resourceType: 'WHATSAPP',
            resourceId: messageId,
            patientId,
            user: currentUser,
            status: 'FAILURE',
            details: `WhatsApp registration send failed for patient ${patient.name}: ${errMsg}`
          });

          return messageRecord;
        }

        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        messageRecord.status = 'Sent';
        messageRecord.externalMessageId = metaMessageId;
        messageRecord.sentAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_SENT',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `WhatsApp registration message sent via Meta Cloud API to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)}`
        });

        return messageRecord;
      } catch (networkErr) {
        messageRecord.status = 'Failed';
        messageRecord.failureReason = `Network error connecting to Meta WhatsApp API: ${networkErr.message}`;
        messageRecord.failedAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_FAILED',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'FAILURE',
          details: `Network failure sending WhatsApp registration message: ${networkErr.message}`
        });

        return messageRecord;
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const simulatedExternalId = `sim_reg_wamid_${Date.now()}`;
        messageRecord.status = 'Sent';
        messageRecord.externalMessageId = simulatedExternalId;
        messageRecord.sentAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();
        messageRecord.note = 'Simulated registration notification in development mode.';

        db.logAuditAction({
          action: 'WHATSAPP_SENT',
          resourceType: 'WHATSAPP',
          resourceId: messageId,
          patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `Simulated WhatsApp registration message dispatched to ${targetPhone.slice(0, 4)}****${targetPhone.slice(-3)} (Patient ID: ${patient.patientId})`
        });

        return messageRecord;
      } else {
        messageRecord.status = 'Failed';
        messageRecord.failureReason = 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED';
        messageRecord.failedAt = new Date().toISOString();
        messageRecord.updatedAt = new Date().toISOString();
        return messageRecord;
      }
    }
  }

  /**
   * Retry sending a failed WhatsApp message
   */
  async retryMessage(messageId, currentUser = null) {
    const message = db.whatsappMessages.find(m => m.id === messageId);
    if (!message) {
      throw { statusCode: 404, message: 'WhatsApp message record not found' };
    }

    const patient = db.patients.find(p => p.patientId === message.patientId);
    if (!patient) {
      throw { statusCode: 404, message: 'Patient record associated with this message not found' };
    }

    if (patient.whatsappConsent === false) {
      throw { statusCode: 400, message: 'Cannot retry: Patient has not consented to WhatsApp messages' };
    }

    const targetPhone = patient.whatsappNumber || patient.phone || message.recipientPhone;
    const cleanRecipient = this.formatToMetaRecipient(targetPhone);

    message.retryCount = (message.retryCount || 0) + 1;
    message.lastRetriedAt = new Date().toISOString();
    message.status = 'Pending';
    message.failureReason = null;
    message.updatedAt = new Date().toISOString();

    const creds = this.getCredentials();

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
          message.status = 'Failed';
          message.failureReason = errMsg;
          message.failedAt = new Date().toISOString();
          message.updatedAt = new Date().toISOString();

          db.logAuditAction({
            action: 'WHATSAPP_RETRIED',
            resourceType: 'WHATSAPP',
            resourceId: message.id,
            patientId: message.patientId,
            user: currentUser,
            status: 'FAILURE',
            details: `Retry #${message.retryCount} failed for Invoice: ${errMsg}`
          });

          return message;
        }

        const metaMessageId = data.messages && data.messages[0] ? data.messages[0].id : `wamid.${Date.now()}`;
        message.status = 'Sent';
        message.externalMessageId = metaMessageId;
        message.sentAt = new Date().toISOString();
        message.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_RETRIED',
          resourceType: 'WHATSAPP',
          resourceId: message.id,
          patientId: message.patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `WhatsApp message retried successfully via Meta Cloud API (Attempt #${message.retryCount})`
        });

        return message;
      } catch (err) {
        message.status = 'Failed';
        message.failureReason = `Retry failed: ${err.message}`;
        message.failedAt = new Date().toISOString();
        message.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_RETRIED',
          resourceType: 'WHATSAPP',
          resourceId: message.id,
          patientId: message.patientId,
          user: currentUser,
          status: 'FAILURE',
          details: `WhatsApp retry network error: ${err.message}`
        });

        return message;
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        message.status = 'Sent';
        message.externalMessageId = `sim_retry_wamid_${Date.now()}`;
        message.sentAt = new Date().toISOString();
        message.updatedAt = new Date().toISOString();

        db.logAuditAction({
          action: 'WHATSAPP_RETRIED',
          resourceType: 'WHATSAPP',
          resourceId: message.id,
          patientId: message.patientId,
          user: currentUser,
          status: 'SUCCESS',
          details: `Simulated retry #${message.retryCount} succeeded (Meta API credentials pending)`
        });

        return message;
      } else {
        message.status = 'Failed';
        message.failureReason = 'WHATSAPP_CREDENTIALS_NOT_CONFIGURED';
        message.failedAt = new Date().toISOString();
        message.updatedAt = new Date().toISOString();
        return message;
      }
    }
  }

  /**
   * Handle incoming Meta WhatsApp Webhook event (status updates)
   */
  handleWebhookStatusUpdate(body) {
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

        const msg = db.whatsappMessages.find(m => m.externalMessageId === metaId);
        if (msg) {
          if (statusStr === 'delivered') {
            msg.status = 'Delivered';
            msg.deliveredAt = new Date().toISOString();
          } else if (statusStr === 'read') {
            msg.status = 'Delivered';
            msg.readAt = new Date().toISOString();
          } else if (statusStr === 'failed') {
            msg.status = 'Failed';
            msg.failedAt = new Date().toISOString();
            msg.failureReason = st.errors?.[0]?.message || 'Delivery failed from carrier';
          }
          msg.updatedAt = new Date().toISOString();
          updatedCount++;

          db.logAuditAction({
            action: 'WHATSAPP_STATUS_UPDATED',
            resourceType: 'WHATSAPP',
            resourceId: msg.id,
            patientId: msg.patientId,
            status: msg.status === 'Failed' ? 'FAILURE' : 'SUCCESS',
            details: `Meta status callback: status updated to "${msg.status}" for recipient ${msg.recipientPhone.slice(0, 4)}****`
          });
        }
      }

      return { processed: updatedCount };
    } catch (err) {
      console.error('[WhatsApp Webhook Error]', err);
      return { processed: 0, error: err.message };
    }
  }

  /**
   * Test WhatsApp configuration connection by sending a ping or test message
   */
  async testConnection(targetPhone, currentUser = null) {
    const creds = this.getCredentials();
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

      db.logAuditAction({
        action: 'WHATSAPP_TEST_SENT',
        resourceType: 'WHATSAPP',
        user: currentUser,
        status: 'SUCCESS',
        details: `Test WhatsApp notification sent to ${targetPhone.slice(0, 4)}**** via Meta API`
      });

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
   * Get all WhatsApp messages with optional filters
   */
  getMessages(filters = {}) {
    let list = [...db.whatsappMessages];
    if (filters.billId) {
      list = list.filter(m => m.billId === filters.billId);
    }
    if (filters.patientId) {
      list = list.filter(m => m.patientId === filters.patientId);
    }
    if (filters.appointmentId) {
      list = list.filter(m => m.appointmentId === filters.appointmentId);
    }
    if (filters.status) {
      list = list.filter(m => m.status.toLowerCase() === filters.status.toLowerCase());
    }

    return list.map(m => {
      const patient = db.patients.find(p => p.patientId === m.patientId);
      const bill = db.bills.find(b => b.billId === m.billId);
      return {
        ...m,
        patientName: patient?.name || 'Unknown Patient',
        invoiceNumber: bill?.invoiceNumber || null,
        billTotal: bill?.total || 0
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = new WhatsAppService();
