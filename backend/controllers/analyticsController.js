const analyticsService = require('../services/analyticsService');

const getSummary = async (req, res, next) => {
  try {
    const result = await analyticsService.getSummary(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const result = await analyticsService.getStats(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getChartData = async (req, res, next) => {
  try {
    const result = await analyticsService.getChartData(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const result = await analyticsService.getAnalytics(req.user);
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
