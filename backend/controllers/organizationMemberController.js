const organizationMemberService = require('../services/organizationMemberService');

const createMembership = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const result = await organizationMemberService.createMembership(req.organizationId, req.user, email, role);
    res.status(201).json(result);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
};

const getOrganizationMembers = async (req, res, next) => {
  try {
    const result = await organizationMemberService.getOrganizationMembers(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getUserMemberships = async (req, res, next) => {
  try {
    const result = await organizationMemberService.getUserMemberships(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateMembershipRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const result = await organizationMemberService.updateMembershipRole(req.organizationId, req.user, req.params.memberId, role);
    res.json(result);
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
};

const removeMembership = async (req, res, next) => {
  try {
    const result = await organizationMemberService.removeMembership(req.organizationId, req.user, req.params.memberId);
    res.json(result);
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
};

module.exports = {
  createMembership,
  getOrganizationMembers,
  getUserMemberships,
  updateMembershipRole,
  removeMembership
};
