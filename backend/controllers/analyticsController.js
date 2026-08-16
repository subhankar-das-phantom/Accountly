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
    const filter = {
      periodType: req.query.periodType,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const result = await analyticsService.getAnalytics(req.organizationId, filter);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getBudgetVsActual = async (req, res, next) => {
  try {
    const filter = {
      month: parseInt(req.query.month),
      year: parseInt(req.query.year)
    };
    const result = await analyticsService.getBudgetVsActual(req.organizationId, filter);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const checkIntegrity = async (req, res, next) => {
  try {
    const result = await analyticsService.checkIntegrity(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSummary,
  getStats,
  getChartData,
  getAnalytics,
  getBudgetVsActual,
  checkIntegrity
};
