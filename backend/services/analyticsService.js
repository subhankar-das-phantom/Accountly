const mongoose = require('mongoose');
const Transaction = require('../models/transaction.model');
const Organization = require('../models/organization.model');
const { cache, getCacheKey } = require('../utils/cache');

/**
 * The Canonical Analytics Engine
 * Provides a single source of truth for all Accountly financial calculations.
 */
const getAnalytics = async (organizationId, filter = {}) => {
  const { periodType = 'all', startDate, endDate } = filter;
  const cacheKey = getCacheKey('canonical_analytics', `${organizationId}_${periodType}_${startDate}_${endDate}`);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const orgId = new mongoose.Types.ObjectId(organizationId);
  let matchQuery = { organizationId: orgId };
  let prevMatchQuery = null;

  const now = new Date();
  let start = null, end = null;
  let prevStart = null, prevEnd = null;

  if (periodType === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (periodType === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (periodType === 'thisWeek') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7);
    prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    prevEnd = start;
  } else if (periodType === 'thisYear') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear(), 0, 1);
  } else if (periodType === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    prevStart = new Date(start.getTime() - duration);
    prevEnd = start;
  }

  if (start && end) {
    matchQuery.date = { $gte: start, $lt: end };
    prevMatchQuery = {
      organizationId: orgId,
      date: { $gte: prevStart, $lt: prevEnd }
    };
  }

  // 1. Current Period Stats
  const currentStatsPromise = Transaction.aggregate([
    { $match: matchQuery },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: '$type',
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 },
              maxAmount: { $max: '$amount' }
            }
          }
        ],
        expensesByCategory: [
          { $match: { type: 'expense' } },
          { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { amount: -1 } },
          { $project: { category: '$_id', amount: 1, count: 1, _id: 0 } }
        ],
        contributionsByCategory: [
          { $match: { type: 'contribution' } },
          { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { amount: -1 } },
          { $project: { category: '$_id', amount: 1, count: 1, _id: 0 } }
        ],
        monthlyTrends: [
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                type: '$type'
              },
              amount: { $sum: '$amount' }
            }
          },
          {
            $group: {
              _id: { year: '$_id.year', month: '$_id.month' },
              totals: {
                $push: { type: '$_id.type', amount: '$amount' }
              }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ]
      }
    }
  ]);

  // 2. Previous Period Stats (for comparison)
  const prevStatsPromise = prevMatchQuery ? Transaction.aggregate([
    { $match: prevMatchQuery },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' }
      }
    }
  ]) : Promise.resolve([]);

  const [currentResult, prevResult] = await Promise.all([currentStatsPromise, prevStatsPromise]);
  const current = currentResult[0];

  let totalCollected = 0, totalSpent = 0, contributionCount = 0, expenseCount = 0;
  let maxContribution = 0, maxExpense = 0;

  current.summary.forEach(s => {
    if (s._id === 'contribution') {
      totalCollected = s.totalAmount || 0;
      contributionCount = s.count || 0;
      maxContribution = s.maxAmount || 0;
    } else if (s._id === 'expense') {
      totalSpent = s.totalAmount || 0;
      expenseCount = s.count || 0;
      maxExpense = s.maxAmount || 0;
    }
  });

  const remainingBalance = totalCollected - totalSpent;
  const spendingRatio = totalCollected > 0 ? (totalSpent / totalCollected) * 100 : 0;
  const remainingRatio = totalCollected > 0 ? (remainingBalance / totalCollected) * 100 : (totalCollected === 0 && totalSpent > 0 ? -100 : 0);

  let prevCollected = 0, prevSpent = 0;
  prevResult.forEach(s => {
    if (s._id === 'contribution') prevCollected = s.totalAmount || 0;
    if (s._id === 'expense') prevSpent = s.totalAmount || 0;
  });

  const collectedChange = prevCollected > 0 ? ((totalCollected - prevCollected) / prevCollected) * 100 : (totalCollected > 0 ? 100 : 0);
  const spentChange = prevSpent > 0 ? ((totalSpent - prevSpent) / prevSpent) * 100 : (totalSpent > 0 ? 100 : 0);

  // Format monthly trends
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trends = current.monthlyTrends.map(m => {
    let col = 0, spn = 0;
    m.totals.forEach(t => {
      if (t.type === 'contribution') col = t.amount;
      if (t.type === 'expense') spn = t.amount;
    });
    return {
      month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
      collected: col,
      spent: spn,
      remainingBalance: col - spn
    };
  }).reverse(); // chronological

  const response = {
    period: {
      type: periodType,
      start,
      end
    },
    summary: {
      totalCollected,
      totalSpent,
      remainingBalance,
      contributionCount,
      expenseCount
    },
    contributions: {
      average: contributionCount > 0 ? totalCollected / contributionCount : 0,
      largest: maxContribution,
      byCategory: current.contributionsByCategory,
      trends
    },
    expenses: {
      average: expenseCount > 0 ? totalSpent / expenseCount : 0,
      largest: maxExpense,
      byCategory: current.expensesByCategory,
      trends
    },
    ratios: {
      spendingRatio,
      remainingRatio
    },
    comparison: {
      previousPeriod: prevMatchQuery ? { start: prevStart, end: prevEnd } : null,
      prevCollected,
      prevSpent,
      collectedChange,
      spentChange
    }
  };

  cache.set(cacheKey, response);
  return response;
};

// ==========================================
// COMPATIBILITY WRAPPERS
// These map the old API contract to the new canonical analytics engine.
// They will be removed in a future cleanup step.
// ==========================================

const getSummary = async (organizationId) => {
  const analytics = await getAnalytics(organizationId, { periodType: 'all' });
  // Map back to [{ name: category, value: amount }] for expenses
  return analytics.expenses.byCategory.map(c => ({
    name: c.category || 'Other',
    value: c.amount
  }));
};

const getChartData = async (organizationId) => {
  // Chart data was essentially the same as summary
  return getSummary(organizationId);
};

const getStats = async (organizationId) => {
  const allTime = await getAnalytics(organizationId, { periodType: 'all' });
  const thisMonth = await getAnalytics(organizationId, { periodType: 'thisMonth' });
  const lastMonth = await getAnalytics(organizationId, { periodType: 'lastMonth' });

  return {
    totalCollected: allTime.summary.totalCollected,
    totalSpent: allTime.summary.totalSpent,
    remainingBalance: allTime.summary.remainingBalance,
    contributionCount: allTime.summary.contributionCount,
    expenseCount: allTime.summary.expenseCount,
    transactionCount: allTime.summary.contributionCount + allTime.summary.expenseCount,
    currentMonth: {
      collected: thisMonth.summary.totalCollected,
      spent: thisMonth.summary.totalSpent,
      remainingBalance: thisMonth.summary.remainingBalance,
    },
    previousMonth: {
      collected: lastMonth.summary.totalCollected,
      spent: lastMonth.summary.totalSpent,
      remainingBalance: lastMonth.summary.remainingBalance,
    }
  };
};

const calculateFinancialStats = (transactions) => {
  // Deprecated: this was a large synchronous helper. No longer used by getAnalytics.
  return {}; 
};

const getMetadataAnalytics = async (organizationId, groupBy, filter = {}) => {
  const org = await Organization.findById(organizationId).lean();
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

  // Validate that groupBy is a configured field
  const fieldConfig = (org.contributorFields || []).find(f => f.key === groupBy);
  if (!fieldConfig) {
    throw Object.assign(new Error(`Invalid groupBy parameter: ${groupBy}`), { status: 400 });
  }

  const { periodType = 'all', startDate, endDate } = filter;
  let matchQuery = { organizationId: new mongoose.Types.ObjectId(organizationId), type: 'contribution' };

  if (periodType === 'thisMonth') {
    const now = new Date();
    matchQuery.date = { 
      $gte: new Date(now.getFullYear(), now.getMonth(), 1), 
      $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) 
    };
  } else if (periodType === 'custom' && startDate && endDate) {
    matchQuery.date = { $gte: new Date(startDate), $lt: new Date(endDate) };
  }

  // Use aggregation to group by metadata (Map values are stored natively in MongoDB as subdocuments)
  // E.g. contributor.metadata.department
  const groupByFieldPath = `$contributor.metadata.${groupBy}`;

  const groupsAgg = await Transaction.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: { $ifNull: [groupByFieldPath, 'Unknown'] },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);

  return {
    field: {
      key: fieldConfig.key,
      label: fieldConfig.label,
      type: fieldConfig.type
    },
    data: groupsAgg.map(g => ({
      value: g._id,
      count: g.count,
      totalAmount: g.totalAmount
    }))
  };
};

// ==========================================
// ADMIN-ONLY REPORTS
// ==========================================

const getBudgetVsActual = async (organizationId, filter = {}) => {
  const Budget = require('../models/budget.model');
  const orgId = new mongoose.Types.ObjectId(organizationId);
  
  const now = new Date();
  const year = filter.year || now.getFullYear();
  const month = filter.month || (now.getMonth() + 1);

  // Get budgets for the given month/year
  const budgets = await Budget.find({ organizationId: orgId, year, month }).lean();
  
  // Get expenses for that month/year
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  
  const expensesAgg = await Transaction.aggregate([
    { $match: { organizationId: orgId, type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' } } }
  ]);

  const expenseMap = {};
  expensesAgg.forEach(e => expenseMap[e._id] = e.amount);

  const breakdown = budgets.map(b => {
    const actual = expenseMap[b.category] || 0;
    return {
      category: b.category,
      budget: b.limit,
      actual: actual,
      variance: b.limit - actual,
      utilizationPercentage: b.limit > 0 ? (actual / b.limit) * 100 : 0
    };
  });

  const totalBudget = breakdown.reduce((sum, b) => sum + b.limit, 0);
  const totalActual = breakdown.reduce((sum, b) => sum + b.actual, 0);

  return {
    period: { year, month },
    summary: {
      totalBudget,
      totalActual,
      totalVariance: totalBudget - totalActual,
      overallUtilization: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
    },
    breakdown
  };
};

module.exports = {
  getAnalytics,
  getSummary,
  getStats,
  getChartData,
  calculateFinancialStats,
  getMetadataAnalytics,
  getBudgetVsActual
};
