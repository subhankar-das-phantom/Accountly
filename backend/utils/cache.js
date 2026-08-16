const NodeCache = require('node-cache');

// Initialize cache with 60 second TTL
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Helper to generate cache keys
const getCacheKey = (prefix, userId, params = {}) => {
  return `${prefix}_${userId}_${JSON.stringify(params)}`;
};

// Helper to invalidate user cache
const invalidateUserCache = (userId) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(userId.toString())) {
      cache.del(key);
    }
  });
};

module.exports = {
  cache,
  getCacheKey,
  invalidateUserCache
};
