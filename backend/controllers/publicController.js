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
    const search = req.query.search || '';
    const result = await publicService.getPublicContributions(slug, page, limit, search);
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
    const search = req.query.search || '';
    const result = await publicService.getPublicExpenses(slug, page, limit, search);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getPublicAnalytics = async (req, res, next) => {
  try {
    const org = await require('../models/organization.model').findOne({ slug: req.params.slug }).lean();
    if (!org || !org.settings?.publicAccess) {
      const error = new Error('Organization not found or unauthorized');
      error.status = 404;
      throw error;
    }
    
    const groupBy = req.query.groupBy;
    if (!groupBy) {
      return res.status(400).json({ error: 'groupBy parameter is required' });
    }

    const fieldConfig = (org.contributorFields || []).find(f => f.key === groupBy);
    if (!fieldConfig || fieldConfig.publicVisibility !== 'visible') {
      return res.status(403).json({ error: 'Cannot group by this field publicly' });
    }

    const analyticsService = require('../services/analyticsService');
    const result = await analyticsService.getMetadataAnalytics(org._id, groupBy);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrganizationSummary,
  getPublicContributions,
  getPublicExpenses,
  getPublicAnalytics
};
