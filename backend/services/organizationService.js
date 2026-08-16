const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const auditLogService = require('./auditLogService');

const generateSlug = (name) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

const createOrganization = async (userId, data) => {
  const { name, description, currency, settings } = data;
  
  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;
  
  // Ensure unique slug
  while (await Organization.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return await auditLogService.withAuditTransaction(async (session) => {
    const newOrg = new Organization({
      name,
      slug,
      description,
      currency,
      settings,
      owner: userId // Retained temporarily for backward compatibility
    });

    const savedOrg = await newOrg.save({ session });

    const newMember = new OrganizationMember({
      organizationId: savedOrg._id,
      userId,
      role: 'OWNER',
      status: 'ACTIVE'
    });

    await newMember.save({ session });

    return savedOrg;
  });
};

const getOrganizationsForUser = async (userId) => {
  const memberships = await OrganizationMember.find({ userId, status: 'ACTIVE' });
  const orgIds = memberships.map(m => m.organizationId);
  return await Organization.find({ _id: { $in: orgIds } }).sort({ createdAt: -1 });
};

const getOrganization = async (orgId) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  return org;
};

const updateOrganization = async (userId, orgId, data) => {
  const { name, description, currency, settings } = data;
  
  return await auditLogService.withAuditTransaction(async (session) => {
    const org = await Organization.findById(orgId).session(session);
    if (!org) {
      const error = new Error('Organization not found');
      error.status = 404;
      throw error;
    }

    const prevOrg = org.toObject();

    let settingsChanged = false;
    if (name) org.name = name;
    if (description !== undefined) org.description = description;
    
    if (currency && org.currency !== currency) {
      org.currency = currency;
      settingsChanged = true;
    }
    
    if (settings) {
      org.settings = { ...org.settings, ...settings };
      settingsChanged = true;
    }

    await org.save({ session });

    try {
      await auditLogService.createAuditLog({
        organizationId: orgId,
        actorId: userId,
        action: settingsChanged ? 'PUBLIC_SETTINGS_UPDATE' : 'UPDATE',
        entityType: 'Organization',
        entityId: orgId,
        previousData: prevOrg,
        newData: org.toObject()
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    return org;
  });
};

const deleteOrganization = async (userId, orgId) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }

  // TODO: Handle cascading deletes for Transactions, Budgets, etc. safely.
  // For now, just delete the organization.
  await Organization.findByIdAndDelete(orgId);
  return { message: 'Organization deleted successfully' };
};

module.exports = {
  createOrganization,
  getOrganizationsForUser,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  generateSlug
};
