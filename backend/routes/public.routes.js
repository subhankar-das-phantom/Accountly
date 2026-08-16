const router = require('express').Router();
const publicController = require('../controllers/publicController');
const { cache } = require('../utils/cache');

// Helper to generate public cache keys
const getPublicCacheKey = (req) => {
  const { slug } = req.params;
  const pathStr = req.path.replace(/\//g, '_');
  const pageStr = req.query.page ? `_page${req.query.page}` : '';
  const limitStr = req.query.limit ? `_limit${req.query.limit}` : '';
  return `public_org_${slug}${pathStr}${pageStr}${limitStr}`;
};

const cacheMiddleware = (req, res, next) => {
  const key = getPublicCacheKey(req);
  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }
  
  // Override res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(key, body);
    originalJson(body);
  };
  next();
};

// Route: /api/public/organizations/:slug
router.get('/organizations/:slug', cacheMiddleware, publicController.getOrganizationSummary);
router.get('/organizations/:slug/contributions', cacheMiddleware, publicController.getPublicContributions);
router.get('/organizations/:slug/expenses', cacheMiddleware, publicController.getPublicExpenses);
router.get('/organizations/:slug/analytics', cacheMiddleware, publicController.getPublicAnalytics);

module.exports = router;
