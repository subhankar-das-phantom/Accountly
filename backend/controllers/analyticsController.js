const analyticsService = require('../services/analyticsService');

const getSummary = async (req, res, next) => {
  try {
    const result = await analyticsService.getSummary(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const result = await analyticsService.getStats(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getChartData = async (req, res, next) => {
  try {
    const result = await analyticsService.getChartData(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.getAnalytics(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSummary,
  getStats,
  getChartData,
  getAnalytics
};
