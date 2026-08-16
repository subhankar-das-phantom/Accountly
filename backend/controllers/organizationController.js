const organizationService = require('../services/organizationService');

const createOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.createOrganization(req.user, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const getOrganizations = async (req, res, next) => {
  try {
    const result = await organizationService.getOrganizationsForUser(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.getOrganization(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.updateOrganization(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.deleteOrganization(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const patchPublicSettings = async (req, res, next) => {
  try {
    const { publicAccess, publicContributorNames } = req.body;
    const settingsUpdate = {};
    if (publicAccess !== undefined) settingsUpdate.publicAccess = publicAccess;
    if (publicContributorNames !== undefined) settingsUpdate.publicContributorNames = publicContributorNames;
    
    const result = await organizationService.updateOrganization(req.user, req.params.id, { settings: settingsUpdate });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const archiveOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.archiveOrganization(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const restoreOrganization = async (req, res, next) => {
  try {
    const result = await organizationService.restoreOrganization(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrganization,
  getOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  patchPublicSettings,
  archiveOrganization,
  restoreOrganization
};
