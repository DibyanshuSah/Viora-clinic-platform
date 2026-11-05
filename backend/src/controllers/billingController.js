const billingService = require('../services/billingService');
const { successResponse } = require('../utils/responseHandler');

class BillingController {
  async getAllBills(req, res, next) {
    try {
      const bills = await billingService.getAllBills(req.query);
      return successResponse(res, 'Bills retrieved successfully', bills);
    } catch (err) {
      next(err);
    }
  }

  async getBillById(req, res, next) {
    try {
      const bill = await billingService.getBillById(req.params.id);
      return successResponse(res, 'Bill details retrieved successfully', bill);
    } catch (err) {
      next(err);
    }
  }

  async createBill(req, res, next) {
    try {
      const bill = await billingService.createBill(req.body, req.user);
      return successResponse(res, 'Bill and Invoice generated successfully', bill, 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePayment(req, res, next) {
    try {
      const bill = await billingService.updateBillPayment(req.params.id, req.body, req.user);
      return successResponse(res, 'Payment updated successfully', bill);
    } catch (err) {
      next(err);
    }
  }

  async updateBill(req, res, next) {
    try {
      const updated = await billingService.updateBill(req.params.id, req.body, req.user);
      return successResponse(res, 'Bill updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  async deleteBill(req, res, next) {
    try {
      const result = await billingService.deleteBill(req.params.id, req.user);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  async deletePatientBills(req, res, next) {
    try {
      const result = await billingService.deletePatientTotalBills(req.params.patientId, req.user);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  async getBillingLogs(req, res, next) {
    try {
      const logs = await billingService.getBillingLogs();
      return successResponse(res, 'Billing audit logs retrieved successfully', logs);
    } catch (err) {
      next(err);
    }
  }

  async connectedRegisterAndBill(req, res, next) {
    try {
      const result = await billingService.registerAndBill(req.body, req.user);
      return successResponse(res, 'Patient registered, appointment booked, and bill generated successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }

  async generateBillLink(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const { expiryDays } = req.body || {};
      const link = await linkService.generateBillAccessLink(req.params.billId, req.user, expiryDays);
      return successResponse(res, 'Secure UUID bill link generated successfully', link);
    } catch (err) {
      next(err);
    }
  }

  async getBillLinks(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const links = await linkService.getLinksForBill(req.params.billId);
      return successResponse(res, 'Bill links retrieved successfully', links);
    } catch (err) {
      next(err);
    }
  }

  async revokeBillLink(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const link = await linkService.revokeBillAccessLink(req.params.linkId, req.user);
      return successResponse(res, 'Bill access link revoked successfully', link);
    } catch (err) {
      next(err);
    }
  }

  async getWhatsAppMessages(req, res, next) {
    try {
      const whatsappService = require('../services/whatsappService');
      const messages = await whatsappService.getMessages(req.query);
      return successResponse(res, 'WhatsApp message records retrieved successfully', messages);
    } catch (err) {
      next(err);
    }
  }

  async retryWhatsAppMessage(req, res, next) {
    try {
      const whatsappService = require('../services/whatsappService');
      const retried = await whatsappService.retryMessage(req.params.messageId, req.user);
      return successResponse(res, 'WhatsApp message retried successfully', retried);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BillingController();
