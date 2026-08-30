const billingService = require('../services/billingService');
const { successResponse } = require('../utils/responseHandler');

class InvoiceController {
  getInvoice(req, res, next) {
    try {
      const invoiceData = billingService.getBillById(req.params.id);
      return successResponse(res, 'Invoice details retrieved successfully', invoiceData);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InvoiceController();
