const publicService = require('../services/publicService');

const getOrganizationSummary = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await publicService.getOrganizationSummary(slug);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getPublicContributions = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const result = await publicService.getPublicContributions(slug, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getPublicExpenses = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const result = await publicService.getPublicExpenses(slug, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrganizationSummary,
  getPublicContributions,
  getPublicExpenses
};
