const AuditLog = require('../models/auditLog.model');

// Explicit allowlist to prevent blind serialization of Mongoose documents
// and prevent sensitive fields from leaking into the audit log.
const ALLOWED_FIELDS = {
  FinancialRecord: ['type', 'category', 'amount', 'date', 'description', 'contributor', 'recipient', 'status'],
  Organization: ['name', 'description', 'currency', 'settings'],
  ContributorField: ['key', 'label', 'type', 'options', 'required', 'publicVisibility', 'order'],
  Budget: ['category', 'amount', 'month', 'year']
};

const redactData = (entityType, data) => {
  if (!data) return null;
  
  // If data is a Mongoose document, convert to plain object
  const plainData = data.toObject ? data.toObject() : { ...data };
  
  const allowed = ALLOWED_FIELDS[entityType];
  if (!allowed) {
    // Fallback denylist if entityType is missing or not configured with an allowlist
    const redacted = { ...plainData };
    const denylist = ['password', 'token', 'secret', 'email', 'hash', 'salt', '__v'];
    for (const key of Object.keys(redacted)) {
      if (denylist.some(d => key.toLowerCase().includes(d))) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }

  const result = {};
  for (const field of allowed) {
    if (plainData[field] !== undefined) {
      // Very basic deep clone for allowed fields to avoid reference issues
      result[field] = JSON.parse(JSON.stringify(plainData[field]));
    }
  }
  return result;
};

/**
 * createAuditLog
 * 
 * @param {Object} params
 * @param {String} params.organizationId
 * @param {String} params.actorId
 * @param {String} params.action - CREATE, UPDATE, DELETE, etc.
 * @param {String} params.entityType - FinancialRecord, Organization, etc.
 * @param {String} params.entityId - Nullable for organization-level actions where org is the entity
 * @param {Object} params.previousData
 * @param {Object} params.newData
 * @param {Object} params.metadata - Extra context
 * @param {Object} [session] - Optional Mongoose session for atomic transactions
 */
const createAuditLog = async (params, session = null) => {
  const {
    organizationId,
    actorId,
    action,
    entityType,
    entityId,
    previousData,
    newData,
    metadata
  } = params;

  if (!organizationId || !actorId || !action || !entityType) {
    throw new Error('Missing required audit log parameters');
  }

  const redactedPrev = redactData(entityType, previousData);
  const redactedNew = redactData(entityType, newData);

  const logEntry = new AuditLog({
    organizationId,
    actorId,
    action,
    entityType,
    entityId: entityId || organizationId, // fallback to orgId if entityId is omitted
    previousData: redactedPrev,
    newData: redactedNew,
    metadata
  });

  if (session) {
    return await logEntry.save({ session });
  }
  return await logEntry.save();
};

const getAuditLogs = async (organizationId, queryParams) => {
  const {
    action,
    entityType,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20
  } = queryParams;

  const filter = { organizationId };

  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, parseInt(pageSize, 10) || 20);
  const skip = (p - 1) * ps;

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(ps)
      .populate('actorId', 'username email') // Just basics for UI
      .lean(),
    AuditLog.countDocuments(filter)
  ]);

  // Strip emails out completely for the UI just in case
  const safeLogs = logs.map(log => {
    if (log.actorId && typeof log.actorId === 'object') {
      log.actor = { name: log.actorId.username };
      delete log.actorId;
    }
    return {
      id: log._id,
      actor: log.actor,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      previousData: log.previousData,
      newData: log.newData,
      createdAt: log.createdAt,
      metadata: log.metadata
    };
  });

  return {
    logs: safeLogs,
    pagination: {
      page: p,
      pageSize: ps,
      totalCount,
      totalPages: Math.ceil(totalCount / ps),
      hasMore: skip + logs.length < totalCount
    }
  };
};

const getAuditLogById = async (organizationId, auditId) => {
  const log = await AuditLog.findOne({ _id: auditId, organizationId })
    .populate('actorId', 'username')
    .lean();
    
  if (!log) {
    const error = new Error('Audit log not found');
    error.status = 404;
    throw error;
  }

  return {
    id: log._id,
    actor: log.actorId ? { name: log.actorId.username } : null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    previousData: log.previousData,
    newData: log.newData,
    createdAt: log.createdAt,
    metadata: log.metadata
  };
};

const mongoose = require('mongoose');

const withAuditTransaction = async (operation) => {
  let session;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    // session start might fail if replica set isn't available at all in some envs
    session = null;
  }

  if (session) {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (error.code === 20 || error.message.includes('replica set')) {
        // Transaction not supported on this cluster (standalone fallback)
        return await executeSequentialAuditFallback(operation);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } else {
    return await executeSequentialAuditFallback(operation);
  }
};

const executeSequentialAuditFallback = async (operation) => {
  try {
    return await operation(null);
  } catch (error) {
    if (error.isAuditFailure) {
      console.error('CRITICAL AUDIT FAILURE:', error);
      const wrappedError = new Error('Financial mutation succeeded, but audit log creation failed. The action could not be confirmed as audited.');
      wrappedError.status = 503;
      throw wrappedError;
    }
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  withAuditTransaction
};
