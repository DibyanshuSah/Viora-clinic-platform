const linkService = require('../services/linkService');
const { successResponse } = require('../utils/responseHandler');

class PublicController {
  getBillByToken(req, res, next) {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const billData = linkService.getBillByToken(req.params.token, clientIp);
      return successResponse(res, 'Bill accessed successfully', billData);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicController();
