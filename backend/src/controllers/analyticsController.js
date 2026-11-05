const analyticsService = require('../services/analyticsService');
const { successResponse } = require('../utils/responseHandler');

class AnalyticsController {
  async getAdminAnalytics(req, res, next) {
    try {
      const { period, startDate, endDate } = req.query;
      const data = await analyticsService.getAdminAnalytics(period, startDate, endDate);
      return successResponse(res, 'Admin analytics data retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
