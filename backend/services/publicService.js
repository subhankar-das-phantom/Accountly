const Organization = require('../models/organization.model');
const Transaction = require('../models/transaction.model');
const analyticsService = require('./analyticsService');

const getOrganizationBySlug = async (slug) => {
  const org = await Organization.findOne({ slug });
  if (!org) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  if (!org.settings || org.settings.publicAccess !== true) {
    const error = new Error('This transparency page is currently unavailable.');
    error.status = 403;
    throw error;
  }
  return org;
};

const formatContributorName = (name, policy) => {
  if (!name) return 'Anonymous';
  
  if (policy === 'full') {
    return name;
  } else if (policy === 'anonymous') {
    return 'Anonymous';
  } else {
    // Default to 'anonymized'
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
};

const getOrganizationSummary = async (slug) => {
  const org = await getOrganizationBySlug(slug);
  
  // Reuse analytics service for calculations
  const analytics = await analyticsService.getAnalytics(org._id);
  
  return {
    organization: {
      name: org.name,
      description: org.description,
      currency: org.currency
    },
    summary: {
      totalCollected: analytics.periods.allTime.collected,
      totalSpent: analytics.periods.allTime.spent,
      remainingBalance: analytics.periods.allTime.remainingBalance,
      contributionCount: analytics.periods.allTime.contributionCount,
      expenseCount: analytics.periods.allTime.expenseCount
    },
    analytics: {
      topExpenseCategories: analytics.topExpenseCategories,
      topContributionCategories: analytics.topContributionCategories,
      monthlyTrends: analytics.monthlyTrends
    }
  };
};

const getPublicContributions = async (slug, page = 1, limit = 10) => {
  const org = await getOrganizationBySlug(slug);
  const skip = (page - 1) * limit;

  const contributions = await Transaction.find({ organizationId: org._id, type: 'contribution' })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await Transaction.countDocuments({ organizationId: org._id, type: 'contribution' });

  const privacyPolicy = (org.settings && org.settings.publicContributorNames) || 'anonymized';
  const publicFields = (org.contributorFields || []).filter(f => f.publicVisibility === 'visible').map(f => f.key);

  const mapped = contributions.map(c => {
    let metadata = {};
    if (c.contributor?.metadata) {
      // Safely handle Map or plain object
      const meta = typeof c.contributor.metadata.get === 'function' ? Object.fromEntries(c.contributor.metadata) : c.contributor.metadata;
      for (const key of publicFields) {
        if (meta[key] !== undefined) {
          metadata[key] = meta[key];
        }
      }
    }

    return {
      id: c._id,
      contributorName: formatContributorName(c.contributor?.name, privacyPolicy),
      amount: c.amount,
      date: c.date,
      status: c.status,
      metadata
    };
  });

  return {
    contributions: mapped,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  };
};

const getPublicExpenses = async (slug, page = 1, limit = 10) => {
  const org = await getOrganizationBySlug(slug);
  const skip = (page - 1) * limit;

  const expenses = await Transaction.find({ organizationId: org._id, type: 'expense' })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);
    
  const total = await Transaction.countDocuments({ organizationId: org._id, type: 'expense' });

  const mapped = expenses.map(e => ({
    id: e._id,
    category: e.category,
    description: e.description,
    amount: e.amount,
    date: e.date,
    status: e.status,
    recipientName: e.recipient?.name
  }));

  return {
    expenses: mapped,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  getOrganizationSummary,
  getPublicContributions,
  getPublicExpenses
};
