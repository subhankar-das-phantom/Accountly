const Organization = require('../models/organization.model');

const resolveOrganization = async (req, res, next) => {
  try {
    // Check if client explicitly sent an organization ID (for future multi-org support)
    const orgId = req.header('X-Organization-Id');

    let org;
    if (orgId) {
      org = await Organization.findOne({ _id: orgId, owner: req.user });
    } else {
      // Default to the user's first created organization
      org = await Organization.findOne({ owner: req.user }).sort({ createdAt: 1 });
    }

    if (!org) {
      const error = new Error('No active organization found for this user.');
      error.status = 403;
      return next(error);
    }

    req.organization = org;
    req.organizationId = org._id;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = resolveOrganization;
