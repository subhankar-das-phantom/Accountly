const NodeCache = require('node-cache');

// Initialize cache with 60 second TTL
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Helper to generate cache keys
const getCacheKey = (prefix, orgId, params = {}) => {
  return `${prefix}_org_${orgId}_${JSON.stringify(params)}`;
};

// Helper to invalidate organization cache
const invalidateUserCache = async (orgId) => {
  const keys = cache.keys();
  
  // Find the slug manually to avoid circular dependencies
  const mongoose = require('mongoose');
  const org = await mongoose.model('Organization').findById(orgId);
  const slugStr = org ? `public_org_${org.slug}` : null;
  
  keys.forEach(key => {
    if (key.includes(`org_${orgId.toString()}`) || (slugStr && key.includes(slugStr))) {
      cache.del(key);
    }
  });
};

module.exports = {
  cache,
  getCacheKey,
  invalidateUserCache
};
