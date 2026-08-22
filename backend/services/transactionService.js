const Transaction = require('../models/transaction.model');
const { cache, getCacheKey, invalidateUserCache } = require('../utils/cache');
const auditLogService = require('./auditLogService');
const escapeRegex = require('../utils/escapeRegex');

const getTransactions = async (organizationId, queryParams) => {
  const {
    type,
    category,
    search,
    sortBy = 'date',
    sortOrder = 'desc',
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page,
    pageSize
  } = queryParams;

  // Check cache first
  const cacheKey = getCacheKey('transactions', organizationId, queryParams);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filter = { organizationId: organizationId };

  if (type) filter.type = type;
  if (category) filter.category = category;

  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = parseFloat(minAmount);
    if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
  }

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { description: { $regex: safeSearch, $options: 'i' } },
      { category: { $regex: safeSearch, $options: 'i' } }
    ];
  }

  const validSortFields = ['date', 'amount', 'category', 'type'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
  const sortObj = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
  if (sortField !== 'date') sortObj.date = -1;
  sortObj.createdAt = -1;

  // If page/pageSize are provided, paginate; otherwise return all
  let query = Transaction.find(filter).sort(sortObj);
  let result;

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 50);
    const skip = (p - 1) * ps;

    const [transactions, totalCount] = await Promise.all([
      query.skip(skip).limit(ps).lean(),
      Transaction.countDocuments(filter)
    ]);

    result = {
      transactions,
      pagination: {
        page: p,
        pageSize: ps,
        totalCount,
        totalPages: Math.ceil(totalCount / ps),
        hasMore: skip + transactions.length < totalCount
      }
    };
  } else {
    const transactions = await query.lean();
    result = transactions;
  }

  // Cache the result
  cache.set(cacheKey, result);
  return result;
};

const validateMetadata = async (organizationId, type, contributor) => {
  if (type !== 'contribution' || !contributor || !contributor.metadata) {
    return contributor; // Pass through if not a contribution or no metadata
  }

  const Organization = require('../models/organization.model');
  const org = await Organization.findById(organizationId).lean();
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

  const fields = org.contributorFields || [];
  const submittedMetadata = contributor.metadata;
  const validatedMetadata = {};

  for (const field of fields) {
    const value = submittedMetadata[field.key];
    
    // Check required
    if (field.required && (value === undefined || value === null || value === '')) {
      throw Object.assign(new Error(`Missing required field: ${field.label}`), { status: 400 });
    }

    if (value !== undefined && value !== null && value !== '') {
      // Check select options
      if (field.type === 'select' && !field.options.includes(value)) {
        throw Object.assign(new Error(`Invalid option for field ${field.label}`), { status: 400 });
      }

      // Check number type
      if (field.type === 'number' && isNaN(Number(value))) {
        throw Object.assign(new Error(`Field ${field.label} must be a number`), { status: 400 });
      }

      validatedMetadata[field.key] = value;
    }
  }

  // Reject any keys not in validatedMetadata (unknown keys)
  return {
    ...contributor,
    metadata: validatedMetadata
  };
};

const createTransaction = async (organizationId, userId, data) => {
  const { type, category, amount, date, description, contributor, recipient, status } = data;
  
  const validatedContributor = await validateMetadata(organizationId, type, contributor);

  return await auditLogService.withAuditTransaction(async (session) => {
    const newTransaction = new Transaction({
      type,
      category,
      amount,
      date,
      description,
      contributor: validatedContributor,
      recipient,
      status,
      organizationId: organizationId,
    });

    const savedTransaction = session ? await newTransaction.save({ session }) : await newTransaction.save();
    
    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId: userId,
        action: 'CREATE',
        entityType: 'FinancialRecord',
        entityId: savedTransaction._id,
        previousData: null,
        newData: savedTransaction
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    await invalidateUserCache(organizationId);
    return savedTransaction;
  });
};

const updateTransaction = async (organizationId, transactionId, data, userId) => {
  const { type, category, amount, date, description, contributor, recipient, status } = data;
  
  const validatedContributor = await validateMetadata(organizationId, type, contributor);

  return await auditLogService.withAuditTransaction(async (session) => {
    // Ensure the transaction belongs to the organization
    const prevTransaction = await Transaction.findOne({ _id: transactionId, organizationId }).lean();
    if (!prevTransaction) throw Object.assign(new Error('Transaction not found'), { status: 404 });

    const updatedTransaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, organizationId },
      {
        type,
        category,
        amount,
        date,
        description,
        contributor: validatedContributor,
        recipient,
        status
      },
      { new: true, session }
    );

    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId: userId,
        action: 'UPDATE',
        entityType: 'FinancialRecord',
        entityId: transactionId,
        previousData: prevTransaction,
        newData: updatedTransaction
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    await invalidateUserCache(organizationId);
    return updatedTransaction;
  });
};

const deleteTransaction = async (organizationId, transactionId, userId) => {
  return await auditLogService.withAuditTransaction(async (session) => {
    const prevTransaction = await Transaction.findOne({ _id: transactionId, organizationId }).lean();
    if (!prevTransaction) throw Object.assign(new Error('Transaction not found'), { status: 404 });

    const deletedTransaction = await Transaction.findOneAndDelete({
      _id: transactionId, 
      organizationId
    }, { session });

    try {
      await auditLogService.createAuditLog({
        organizationId,
        actorId: userId,
        action: 'DELETE',
        entityType: 'FinancialRecord',
        entityId: transactionId,
        previousData: prevTransaction,
        newData: null
      }, session);
    } catch (err) {
      if (!session) err.isAuditFailure = true;
      throw err;
    }

    await invalidateUserCache(organizationId);
    return deletedTransaction;
  });
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
