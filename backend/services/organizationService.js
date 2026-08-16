const Organization = require('../models/organization.model');

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

  const newOrg = new Organization({
    name,
    slug,
    description,
    currency,
    settings,
    owner: userId
  });

  return await newOrg.save();
};

const getOrganizationsForUser = async (userId) => {
  return await Organization.find({ owner: userId }).sort({ createdAt: -1 });
};

const getOrganization = async (userId, orgId) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) {
    const error = new Error('Organization not found or unauthorized');
    error.status = 404;
    throw error;
  }
  return org;
};

const updateOrganization = async (userId, orgId, data) => {
  const { name, description, currency, settings } = data;
  
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) {
    const error = new Error('Organization not found or unauthorized');
    error.status = 404;
    throw error;
  }

  if (name) org.name = name;
  if (description !== undefined) org.description = description;
  if (currency) org.currency = currency;
  if (settings) org.settings = settings;

  return await org.save();
};

const deleteOrganization = async (userId, orgId) => {
  const org = await Organization.findOne({ _id: orgId, owner: userId });
  if (!org) {
    const error = new Error('Organization not found or unauthorized');
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
