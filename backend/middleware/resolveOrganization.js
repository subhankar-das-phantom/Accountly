const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');

const resolveOrganization = async (req, res, next) => {
  try {
    // Check if client explicitly sent an organization ID (for future multi-org support)
    const orgId = req.header('X-Organization-Id');

    let membership;
    
    if (orgId) {
      membership = await OrganizationMember.findOne({ organizationId: orgId, userId: req.user, status: 'ACTIVE' });
    } else {
      // Default to the user's first active membership
      membership = await OrganizationMember.findOne({ userId: req.user, status: 'ACTIVE' }).sort({ createdAt: 1 });
    }

    if (!membership) {
      const error = new Error('No active organization membership found for this user.');
      error.status = 403;
      return next(error);
    }

    const org = await Organization.findById(membership.organizationId);
    if (!org) {
      const error = new Error('Organization not found.');
      error.status = 404;
      return next(error);
    }

    req.organization = org;
    req.organizationId = org._id;
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = resolveOrganization;
