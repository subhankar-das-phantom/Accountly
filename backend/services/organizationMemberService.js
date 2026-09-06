const bcrypt = require('bcryptjs');
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

/**
 * Get all distribution operators for an organization with aggregated activity stats
 */
const getDistributionOperators = async (organizationId) => {
  const DistributionActivity = require('../models/distributionActivity.model');

  const operators = await OrganizationMember.find({
    organizationId,
    role: 'DISTRIBUTION_OPERATOR'
  })
    .populate('userId', 'username email')
    .sort({ createdAt: -1 });

  // Compute activity stats for each operator
  const userIds = operators.map(o => o.userId?._id).filter(Boolean);

  const statsAggregation = await DistributionActivity.aggregate([
    {
      $match: {
        organizationId: new (require('mongoose').Types.ObjectId)(organizationId.toString()),
        'operator._id': { $in: userIds }
      }
    },
    {
      $group: {
        _id: '$operator._id',
        totalDistributions: {
          $sum: { $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, 1, 0] }
        },
        totalReversals: {
          $sum: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 1, 0] }
        },
        lastActivity: { $max: '$distributedAt' }
      }
    }
  ]);

  const statsMap = new Map(statsAggregation.map(s => [s._id.toString(), s]));

  return operators.map(op => {
    const userIdStr = op.userId?._id?.toString();
    const stat = statsMap.get(userIdStr) || { totalDistributions: 0, totalReversals: 0, lastActivity: null };
    return {
      _id: op._id,
      memberId: op._id,
      organizationId: op.organizationId,
      user: op.userId ? {
        _id: op.userId._id,
        username: op.userId.username,
        email: op.userId.email
      } : null,
      username: op.userId?.username,
      email: op.userId?.email,
      role: op.role,
      status: op.status,
      createdAt: op.createdAt,
      totalDistributions: stat.totalDistributions,
      totalReversals: stat.totalReversals,
      lastActive: stat.lastActivity,
      lastActivity: stat.lastActivity
    };
  });
};

/**
 * Add or reactivate a distribution operator
 * Supports provisioning a new user account with password on the fly
 */
const addDistributionOperator = async (organizationId, actorId, operatorInput) => {
  const email = typeof operatorInput === 'string' 
    ? operatorInput.trim().toLowerCase() 
    : (operatorInput?.email || '').trim().toLowerCase();
  const username = typeof operatorInput === 'object' && operatorInput?.username 
    ? operatorInput.username.trim() 
    : null;
  const password = typeof operatorInput === 'object' && operatorInput?.password 
    ? operatorInput.password 
    : null;

  if (!email) {
    const error = new Error('Operator email is required.');
    error.status = 400;
    throw error;
  }

  return await auditLogService.withAuditTransaction(async (session) => {
    let userToAdd = await User.findOne({ email }).session(session);

    // If user does not exist, provision account on the fly if password is provided
    if (!userToAdd) {
      if (!password) {
        const error = new Error('User with this email not found. Please provide a password to create their account.');
        error.status = 404;
        throw error;
      }

      if (password.length < 6) {
        const error = new Error('Password must be at least 6 characters long.');
        error.status = 400;
        throw error;
      }

      // Generate clean unique username
      let baseUsername = username || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = `operator_${Date.now().toString().slice(-4)}`;
      }

      let finalUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: finalUsername }).session(session)) {
        finalUsername = `${baseUsername}_${counter}`;
        counter++;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      userToAdd = new User({
        username: finalUsername,
        email,
        password: hashedPassword
      });
      await userToAdd.save({ session });
    }

    let member = await OrganizationMember.findOne({
      organizationId,
      userId: userToAdd._id
    }).session(session);

    if (member) {
      if (member.status === 'ACTIVE') {
        if (member.role === 'DISTRIBUTION_OPERATOR') {
          const error = new Error('User is already an active distribution operator.');
          error.status = 400;
          throw error;
        } else {
          const error = new Error(`User is already an active ${member.role} in this organization.`);
          error.status = 400;
          throw error;
        }
      }

      // Reactivate inactive member
      const previousData = member.toObject();
      member.status = 'ACTIVE';
      member.role = 'DISTRIBUTION_OPERATOR';
      member.removedAt = null;
      await member.save({ session });

      await auditLogService.createAuditLog({
        organizationId,
        actorId,
        action: 'OPERATOR_REACTIVATED',
        entityType: 'OrganizationMember',
        entityId: member._id,
        previousData,
        newData: member.toObject()
      }, session);

      return await OrganizationMember.findById(member._id).populate('userId', 'username email').session(session);
    }

    member = new OrganizationMember({
      organizationId,
      userId: userToAdd._id,
      role: 'DISTRIBUTION_OPERATOR',
      status: 'ACTIVE'
    });

    await member.save({ session });

    await auditLogService.createAuditLog({
      organizationId,
      actorId,
      action: 'OPERATOR_ADDED',
      entityType: 'OrganizationMember',
      entityId: member._id,
      previousData: null,
      newData: member.toObject()
    }, session);

    return await OrganizationMember.findById(member._id).populate('userId', 'username email').session(session);
  });
};

/**
 * Activate or Deactivate an operator
 */
const setOperatorStatus = async (organizationId, actorId, memberId, newStatus) => {
  if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
    const error = new Error('Invalid status. Must be ACTIVE or INACTIVE.');
    error.status = 400;
    throw error;
  }

  return await auditLogService.withAuditTransaction(async (session) => {
    const member = await OrganizationMember.findOne({
      _id: memberId,
      organizationId
    }).session(session);

    if (!member) {
      const error = new Error('Operator membership not found.');
      error.status = 404;
      throw error;
    }

    if (member.role === 'OWNER') {
      const error = new Error('Cannot change status of an OWNER.');
      error.status = 403;
      throw error;
    }

    const previousData = member.toObject();
    member.status = newStatus;
    member.removedAt = newStatus === 'INACTIVE' ? new Date() : null;
    await member.save({ session });

    await auditLogService.createAuditLog({
      organizationId,
      actorId,
      action: newStatus === 'ACTIVE' ? 'OPERATOR_ACTIVATED' : 'OPERATOR_DEACTIVATED',
      entityType: 'OrganizationMember',
      entityId: member._id,
      previousData,
      newData: member.toObject()
    }, session);

    return await OrganizationMember.findById(member._id).populate('userId', 'username email').session(session);
  });
};

module.exports = {
  createMembership,
  getOrganizationMembers,
  getUserMemberships,
  updateMembershipRole,
  removeMembership,
  getDistributionOperators,
  addDistributionOperator,
  setOperatorStatus
};
