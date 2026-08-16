const Transaction = require('../models/transaction.model');
const { cache, getCacheKey } = require('../utils/cache');

const getSummary = async (organizationId) => {
  const cacheKey = getCacheKey('summary', organizationId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const summary = await Transaction.aggregate([
    { $match: { organizationId: organizationId, type: 'expense' } },
    { $group: { _id: '$category', value: { $sum: '$amount' } } },
    { $project: { name: '$_id', value: 1, _id: 0 } },
  ]);
  
  cache.set(cacheKey, summary);
  return summary;
};

const getStats = async (organizationId) => {
  const cacheKey = getCacheKey('stats', organizationId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ organizationId: organizationId });

  const now = new Date();

  // Current month
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Previous month
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthStartForPrev = new Date(now.getFullYear(), now.getMonth(), 1);

  const currentMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= currentMonthStart && transactionDate < nextMonthStart;
  });

  const previousMonthTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= previousMonthStart && transactionDate < currentMonthStartForPrev;
  });

  // Calculate all-time stats
  const contributions = transactions.filter(t => t.type === 'contribution');
  const expenses = transactions.filter(t => t.type === 'expense');

  const totalCollected = contributions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalSpent = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const remainingBalance = totalCollected - totalSpent;

  // Calculate current month stats
  const currentMonthCollected = currentMonthTransactions
    .filter(t => t.type === 'contribution')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const currentMonthSpent = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const currentMonthRemaining = currentMonthCollected - currentMonthSpent;

  // Calculate previous month stats
  const previousMonthCollected = previousMonthTransactions
    .filter(t => t.type === 'contribution')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const previousMonthSpent = previousMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const previousMonthRemaining = previousMonthCollected - previousMonthSpent;

  const response = {
    totalCollected,
    totalSpent,
    remainingBalance,
    contributionCount: contributions.length,
    expenseCount: expenses.length,
    transactionCount: transactions.length,
    currentMonth: {
      collected: currentMonthCollected,
      spent: currentMonthSpent,
      remainingBalance: currentMonthRemaining,
    },
    previousMonth: {
      collected: previousMonthCollected,
      spent: previousMonthSpent,
      remainingBalance: previousMonthRemaining,
    },
  };

  cache.set(cacheKey, response);
  return response;
};

const getChartData = async (organizationId) => {
  const cacheKey = getCacheKey('chart-data', organizationId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ 
    organizationId: organizationId, 
    type: 'expense' 
  });
  
  // Group by category
  const categoryData = {};
  transactions.forEach(t => {
    categoryData[t.category] = (categoryData[t.category] || 0) + parseFloat(t.amount);
  });
  
  // Convert to chart format
  const chartData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value
  }));
  
  cache.set(cacheKey, chartData);
  return chartData;
};

const getAnalytics = async (organizationId) => {
  const cacheKey = getCacheKey('analytics', organizationId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ organizationId: organizationId }).sort({ date: 'desc' });

  // Return empty analytics data structure if no transactions
  if (transactions.length === 0) {
    const emptyAnalytics = {
      periods: {
        allTime: { collected: 0, spent: 0, remainingBalance: 0, count: 0, avgTransaction: 0, retentionRate: 0 },
        thisMonth: { collected: 0, spent: 0, remainingBalance: 0, count: 0, avgTransaction: 0, retentionRate: 0 },
        lastMonth: { collected: 0, spent: 0, remainingBalance: 0, count: 0, avgTransaction: 0, retentionRate: 0 },
        thisYear: { collected: 0, spent: 0, remainingBalance: 0, count: 0, avgTransaction: 0, retentionRate: 0 }
      },
      categoryBreakdown: {},
      monthlyTrends: [],
      topExpenseCategories: [],
      topContributionCategories: [],
      insights: ['Start adding financial records to see insights!'],
      reportDate: new Date().toISOString(),
      totalTransactions: 0
    };
    cache.set(cacheKey, emptyAnalytics);
    return emptyAnalytics;
  }

  const analyticsData = calculateFinancialStats(transactions);
  cache.set(cacheKey, analyticsData);
  return analyticsData;
};

// Helper function to calculate comprehensive financial statistics
function calculateFinancialStats(transactions) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Date ranges
  const thisMonth = new Date(currentYear, currentMonth, 1);
  const nextMonth = new Date(currentYear, currentMonth + 1, 1);
  const lastMonth = new Date(currentYear, currentMonth - 1, 1);
  const thisYear = new Date(currentYear, 0, 1);
  const nextYear = new Date(currentYear + 1, 0, 1);
  
  // Filter transactions by time periods
  const thisMonthTxns = transactions.filter(t => {
    const date = new Date(t.date);
    return date >= thisMonth && date < nextMonth;
  });
  const lastMonthTxns = transactions.filter(t => {
    const date = new Date(t.date);
    return date >= lastMonth && date < thisMonth;
  });
  const thisYearTxns = transactions.filter(t => {
    const date = new Date(t.date);
    return date >= thisYear && date < nextYear;
  });
  
  // Calculate totals by period
  const periods = {
    allTime: calculatePeriodStats(transactions),
    thisMonth: calculatePeriodStats(thisMonthTxns),
    lastMonth: calculatePeriodStats(lastMonthTxns),
    thisYear: calculatePeriodStats(thisYearTxns)
  };
  
  // Category breakdown
  const categoryBreakdown = {};
  transactions.forEach(t => {
    if (!categoryBreakdown[t.category]) {
      categoryBreakdown[t.category] = { collected: 0, spent: 0, count: 0 };
    }
    if (t.type === 'contribution') categoryBreakdown[t.category].collected += parseFloat(t.amount);
    if (t.type === 'expense') categoryBreakdown[t.category].spent += parseFloat(t.amount);
    categoryBreakdown[t.category].count += 1;
  });
  
  // Monthly trends (last 12 months)
  const monthlyTrends = [];
  for (let i = 11; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = month.toLocaleDateString('en-US', { month: 'short' });
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= month && date < nextMonth;
    });
    
    monthlyTrends.push({
      month: monthKey,
      ...calculatePeriodStats(monthTransactions)
    });
  }
  
  // Top categories
  const topExpenseCategories = Object.entries(categoryBreakdown)
    .map(([cat, data]) => ({ category: cat, amount: data.spent, count: data.count }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
    
  const topContributionCategories = Object.entries(categoryBreakdown)
    .map(([cat, data]) => ({ category: cat, amount: data.collected, count: data.count }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  
  // Financial insights
  const insights = calculateFinancialInsights(periods);
  
  return {
    periods,
    categoryBreakdown,
    monthlyTrends,
    topExpenseCategories,
    topContributionCategories,
    insights,
    reportDate: new Date().toISOString(),
    totalTransactions: transactions.length
  };
}

function calculatePeriodStats(transactions) {
  const collected = transactions
    .filter(t => t.type === 'contribution')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const spent = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  return {
    collected,
    spent,
    remainingBalance: collected - spent,
    count: transactions.length,
    avgTransaction: transactions.length > 0 ? (collected + spent) / transactions.length : 0,
    retentionRate: collected > 0 ? ((collected - spent) / collected * 100) : 0
  };
}

function calculateFinancialInsights(periods) {
  const insights = [];
  
  // Month-over-month analysis
  if (periods.thisMonth.count > 0 && periods.lastMonth.count > 0) {
    const collectedChange = ((periods.thisMonth.collected - periods.lastMonth.collected) / periods.lastMonth.collected * 100);
    const spentChange = ((periods.thisMonth.spent - periods.lastMonth.spent) / periods.lastMonth.spent * 100);
    
    insights.push(`Contributions ${collectedChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(collectedChange).toFixed(1)}% vs last month`);
    insights.push(`Expenses ${spentChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(spentChange).toFixed(1)}% vs last month`);
  }
  
  // Retention rate analysis (replacement for savings rate)
  if (periods.thisMonth.retentionRate > 20) {
    insights.push('Excellent fund retention this month (>20%)');
  } else if (periods.thisMonth.retentionRate > 10) {
    insights.push('Good fund retention this month (10-20%)');
  } else if (periods.thisMonth.retentionRate > 0) {
    insights.push('Positive fund retention this month (<10%)');
  } else {
    insights.push('Spending exceeded contributions this month');
  }
  
  return insights;
}

module.exports = {
  getSummary,
  getStats,
  getChartData,
  getAnalytics,
  calculateFinancialStats
};
