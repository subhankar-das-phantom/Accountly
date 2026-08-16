const NodeCache = require('node-cache');

// Initialize cache with 60 second TTL
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Helper to generate cache keys
const getCacheKey = (prefix, orgId, params = {}) => {
  return `${prefix}_org_${orgId}_${JSON.stringify(params)}`;
};

// Helper to invalidate organization cache
const invalidateUserCache = (orgId) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(`org_${orgId.toString()}`)) {
      cache.del(key);
    }
  });
};

module.exports = {
  cache,
  getCacheKey,
  invalidateUserCache
};
