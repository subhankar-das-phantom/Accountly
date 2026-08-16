const OrganizationMember = require('../models/organizationMember.model');
const User = require('../models/user.model');
const auditLogService = require('./auditLogService');

const createMembership = async (organizationId, actorId, email, role) => {
  return await auditLogService.withAuditTransaction(async (session) => {
    const userToAdd = await User.findOne({ email }).session(session);
    if (!userToAdd) {
      const error = new Error('User with this email not found.');
      error.status = 404;
      throw error;
    }

    const existingMember = await OrganizationMember.findOne({
      organizationId,
      userId: userToAdd._id,
      status: 'ACTIVE'
    }).session(session);

    if (existingMember) {
      const error = new Error('User is already an active member of this organization.');
      error.status = 400;
      throw error;
    }

    const membership = new OrganizationMember({
      organizationId,
      userId: userToAdd._id,
      role,
      status: 'ACTIVE'
    });

    await membership.save({ session });

    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId,
        action: 'MEMBER_ADDED',
        entityType: 'OrganizationMember',
        entityId: membership._id,
        previousData: null,
        newData: membership.toObject()
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    return await OrganizationMember.findById(membership._id)
      .populate('userId', 'username email')
      .session(session);
  });
};

const getOrganizationMembers = async (organizationId) => {
  return await OrganizationMember.find({ organizationId, status: 'ACTIVE' })
    .populate('userId', 'username email')
    .sort({ role: -1, createdAt: 1 });
};

const getUserMemberships = async (userId) => {
  return await OrganizationMember.find({ userId, status: 'ACTIVE' })
    .populate('organizationId');
};

const updateMembershipRole = async (organizationId, actorId, memberId, newRole) => {
  return await auditLogService.withAuditTransaction(async (session) => {
    const membership = await OrganizationMember.findOne({
      _id: memberId,
      organizationId,
      status: 'ACTIVE'
    }).session(session);

    if (!membership) {
      const error = new Error('Active membership not found.');
      error.status = 404;
      throw error;
    }

    if (membership.role === 'OWNER') {
      const error = new Error('Cannot modify the role of an OWNER.');
      error.status = 403;
      throw error;
    }

    const previousData = membership.toObject();
    membership.role = newRole;
    await membership.save({ session });

    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId,
        action: 'MEMBER_ROLE_UPDATED',
        entityType: 'OrganizationMember',
        entityId: membership._id,
        previousData,
        newData: membership.toObject()
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    return await OrganizationMember.findById(membership._id)
      .populate('userId', 'username email')
      .session(session);
  });
};

const removeMembership = async (organizationId, actorId, memberId) => {
  return await auditLogService.withAuditTransaction(async (session) => {
    const membership = await OrganizationMember.findOne({
      _id: memberId,
      organizationId,
      status: 'ACTIVE'
    }).session(session);

    if (!membership) {
      const error = new Error('Active membership not found.');
      error.status = 404;
      throw error;
    }

    if (membership.role === 'OWNER') {
      const error = new Error('Cannot remove the OWNER of the organization.');
      error.status = 403;
      throw error;
    }

    const previousData = membership.toObject();
    
    membership.status = 'INACTIVE';
    membership.removedAt = new Date();
    await membership.save({ session });

    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId,
        action: 'MEMBER_REMOVED',
        entityType: 'OrganizationMember',
        entityId: membership._id,
        previousData,
        newData: membership.toObject()
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    return { message: 'Membership removed successfully.' };
  });
};

module.exports = {
  createMembership,
  getOrganizationMembers,
  getUserMemberships,
  updateMembershipRole,
  removeMembership
};
