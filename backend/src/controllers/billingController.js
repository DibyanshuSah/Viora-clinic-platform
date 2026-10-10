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
}

module.exports = new BillingController();
