const Transaction = require('../models/transaction.model');
const { cache, getCacheKey } = require('../utils/cache');

const getSummary = async (userId) => {
  const cacheKey = getCacheKey('summary', userId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const summary = await Transaction.aggregate([
    { $match: { user: userId, type: 'expense' } },
    { $group: { _id: '$category', value: { $sum: '$amount' } } },
    { $project: { name: '$_id', value: 1, _id: 0 } },
  ]);
  
  cache.set(cacheKey, summary);
  return summary;
};

const getStats = async (userId) => {
  const cacheKey = getCacheKey('stats', userId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ user: userId });

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
  const totalIncomeAllTime = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpensesAllTime = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netBalanceAllTime = totalIncomeAllTime - totalExpensesAllTime;

  // Calculate current month stats
  const currentMonthIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const currentMonthExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const currentMonthNetBalance = currentMonthIncome - currentMonthExpenses;

  // Calculate previous month stats
  const previousMonthIncome = previousMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const previousMonthExpenses = previousMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const previousMonthNetBalance = previousMonthIncome - previousMonthExpenses;

  const response = {
    totalIncomeAllTime,
    totalExpensesAllTime,
    netBalanceAllTime,
    transactionCount: transactions.length,
    currentMonth: {
      income: currentMonthIncome,
      expenses: currentMonthExpenses,
      netBalance: currentMonthNetBalance,
    },
    previousMonth: {
      income: previousMonthIncome,
      expenses: previousMonthExpenses,
      netBalance: previousMonthNetBalance,
    },
  };

  cache.set(cacheKey, response);
  return response;
};

const getChartData = async (userId) => {
  const cacheKey = getCacheKey('chart-data', userId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ 
    user: userId, 
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

const getAnalytics = async (userId) => {
  const cacheKey = getCacheKey('analytics', userId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const transactions = await Transaction.find({ user: userId }).sort({ date: 'desc' });

  // Return empty analytics data structure if no transactions
  if (transactions.length === 0) {
    const emptyAnalytics = {
      periods: {
        allTime: { income: 0, expense: 0, netBalance: 0, count: 0, avgTransaction: 0, savingsRate: 0 },
        thisMonth: { income: 0, expense: 0, netBalance: 0, count: 0, avgTransaction: 0, savingsRate: 0 },
        lastMonth: { income: 0, expense: 0, netBalance: 0, count: 0, avgTransaction: 0, savingsRate: 0 },
        thisYear: { income: 0, expense: 0, netBalance: 0, count: 0, avgTransaction: 0, savingsRate: 0 }
      },
      categoryBreakdown: {},
      monthlyTrends: [],
      topExpenseCategories: [],
      topIncomeCategories: [],
      insights: ['Start adding transactions to see insights!'],
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
      categoryBreakdown[t.category] = { income: 0, expense: 0, count: 0 };
    }
    categoryBreakdown[t.category][t.type] += parseFloat(t.amount);
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
    .map(([cat, data]) => ({ category: cat, amount: data.expense, count: data.count }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
    
  const topIncomeCategories = Object.entries(categoryBreakdown)
    .map(([cat, data]) => ({ category: cat, amount: data.income, count: data.count }))
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
    topIncomeCategories,
    insights,
    reportDate: new Date().toISOString(),
    totalTransactions: transactions.length
  };
}

function calculatePeriodStats(transactions) {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  return {
    income,
    expense,
    netBalance: income - expense,
    count: transactions.length,
    avgTransaction: transactions.length > 0 ? (income + expense) / transactions.length : 0,
    savingsRate: income > 0 ? ((income - expense) / income * 100) : 0
  };
}

function calculateFinancialInsights(periods) {
  const insights = [];
  
  // Month-over-month analysis
  if (periods.thisMonth.count > 0 && periods.lastMonth.count > 0) {
    const incomeChange = ((periods.thisMonth.income - periods.lastMonth.income) / periods.lastMonth.income * 100);
    const expenseChange = ((periods.thisMonth.expense - periods.lastMonth.expense) / periods.lastMonth.expense * 100);
    
    insights.push(`Income ${incomeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(incomeChange).toFixed(1)}% vs last month`);
    insights.push(`Expenses ${expenseChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(expenseChange).toFixed(1)}% vs last month`);
  }
  
  // Savings rate analysis
  if (periods.thisMonth.savingsRate > 20) {
    insights.push('Excellent savings rate this month (>20%)');
  } else if (periods.thisMonth.savingsRate > 10) {
    insights.push('Good savings rate this month (10-20%)');
  } else if (periods.thisMonth.savingsRate > 0) {
    insights.push('Positive savings this month (<10%)');
  } else {
    insights.push('Spending exceeded income this month - consider budget review');
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
