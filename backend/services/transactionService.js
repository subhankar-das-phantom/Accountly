const Transaction = require('../models/transaction.model');
const { cache, getCacheKey, invalidateUserCache } = require('../utils/cache');

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
    filter.$or = [
      { description: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }

  const validSortFields = ['date', 'amount', 'category', 'type'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
  const sortObj = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
  if (sortField !== 'date') sortObj.date = -1;

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

const createTransaction = async (organizationId, userId, data) => {
  const { type, category, amount, date, description, contributor, recipient, status } = data;
  
  const newTransaction = new Transaction({
    type,
    category,
    amount,
    date,
    description,
    contributor,
    recipient,
    status,
    user: userId, // temporarily preserved
    organizationId: organizationId,
  });

  const savedTransaction = await newTransaction.save();
  await invalidateUserCache(organizationId);
  return savedTransaction;
};

const updateTransaction = async (organizationId, transactionId, data) => {
  const { type, category, amount, date, description, contributor, recipient, status } = data;
  // Ensure the transaction belongs to the organization
  const updatedTransaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, organizationId: organizationId },
    {
      type,
      category,
      amount,
      date,
      description,
      contributor,
      recipient,
      status
    },
    { new: true }
  );

  await invalidateUserCache(organizationId);
  return updatedTransaction;
};

const deleteTransaction = async (organizationId, transactionId) => {
  const deletedTransaction = await Transaction.findOneAndDelete({
    _id: transactionId, 
    organizationId: organizationId
  });
  await invalidateUserCache(organizationId);
  return deletedTransaction;
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
