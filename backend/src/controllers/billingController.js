const billingService = require('../services/billingService');
const { successResponse } = require('../utils/responseHandler');

class BillingController {
  getAllBills(req, res, next) {
    try {
      const bills = billingService.getAllBills(req.query);
      return successResponse(res, 'Bills retrieved successfully', bills);
    } catch (err) {
      next(err);
    }
  }

  getBillById(req, res, next) {
    try {
      const bill = billingService.getBillById(req.params.id);
      return successResponse(res, 'Bill details retrieved successfully', bill);
    } catch (err) {
      next(err);
    }
  }

  createBill(req, res, next) {
    try {
      const bill = billingService.createBill(req.body, req.user);
      return successResponse(res, 'Bill and Invoice generated successfully', bill, 201);
    } catch (err) {
      next(err);
    }
  }

  updatePayment(req, res, next) {
    try {
      const bill = billingService.updateBillPayment(req.params.id, req.body, req.user);
      return successResponse(res, 'Payment updated successfully', bill);
    } catch (err) {
      next(err);
    }
  }

  updateBill(req, res, next) {
    try {
      const updated = billingService.updateBill(req.params.id, req.body, req.user);
      return successResponse(res, 'Bill updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  deleteBill(req, res, next) {
    try {
      const result = billingService.deleteBill(req.params.id, req.user);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  deletePatientBills(req, res, next) {
    try {
      const result = billingService.deletePatientTotalBills(req.params.patientId, req.user);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  getBillingLogs(req, res, next) {
    try {
      const logs = billingService.getBillingLogs();
      return successResponse(res, 'Billing audit logs retrieved successfully', logs);
    } catch (err) {
      next(err);
    }
  }

  connectedRegisterAndBill(req, res, next) {
    try {
      const result = billingService.registerAndBill(req.body, req.user);
      return successResponse(res, 'Patient registered, appointment booked, and bill generated successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }

  async generateBillLink(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const { expiryDays } = req.body || {};
      const link = linkService.generateBillAccessLink(req.params.billId, req.user, expiryDays);
      return successResponse(res, 'Secure UUID bill link generated successfully', link);
    } catch (err) {
      next(err);
    }
  }

  getBillLinks(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const links = linkService.getLinksForBill(req.params.billId);
      return successResponse(res, 'Bill links retrieved successfully', links);
    } catch (err) {
      next(err);
    }
  }

  revokeBillLink(req, res, next) {
    try {
      const linkService = require('../services/linkService');
      const link = linkService.revokeBillAccessLink(req.params.linkId, req.user);
      return successResponse(res, 'Bill access link revoked successfully', link);
    } catch (err) {
      next(err);
    }
  }

  getWhatsAppMessages(req, res, next) {
    try {
      const whatsappService = require('../services/whatsappService');
      const messages = whatsappService.getMessages(req.query);
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
