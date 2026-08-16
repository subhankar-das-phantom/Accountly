const router = require('express').Router();
let Transaction = require('../models/transaction.model');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const NodeCache = require('node-cache');

// Initialize cache with 60 second TTL
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Helper to generate cache keys
const getCacheKey = (prefix, userId, params = {}) => {
  return `${prefix}_${userId}_${JSON.stringify(params)}`;
};

// Helper to invalidate user cache
const invalidateUserCache = (userId) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(userId.toString())) {
      cache.del(key);
    }
  });
};

// Get all transactions
router.get('/', auth, async (req, res) => {
  try {
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
    } = req.query;

    // Check cache first
    const cacheKey = getCacheKey('transactions', req.user, req.query);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const filter = { user: req.user };

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
    return res.json(result);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add new transaction
router.post('/', auth, async (req, res) => {
  try {
    const { type, category, amount, date, description } = req.body;
    const newTransaction = new Transaction({
      type,
      category,
      amount,
      date,
      description,
      user: req.user,
    });

    const savedTransaction = await newTransaction.save();
    
    // Invalidate cache for this user
    invalidateUserCache(req.user);
    
    res.json(savedTransaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update transaction
router.put('/:id', auth, async (req, res) => {
  try {
    const { type, category, amount, date, description } = req.body;
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      {
        type,
        category,
        amount,
        date,
        description,
      },
      { new: true }
    );
    
    // Invalidate cache for this user
    invalidateUserCache(req.user);
    
    res.json(updatedTransaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedTransaction = await Transaction.findByIdAndDelete(req.params.id);
    
    // Invalidate cache for this user
    invalidateUserCache(req.user);
    
    res.json(deletedTransaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transaction summary
router.get('/summary', auth, async (req, res) => {
  try {
    const cacheKey = getCacheKey('summary', req.user);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const summary = await Transaction.aggregate([
      { $match: { user: req.user, type: 'expense' } },
      { $group: { _id: '$category', value: { $sum: '$amount' } } },
      { $project: { name: '$_id', value: 1, _id: 0 } },
    ]);
    
    cache.set(cacheKey, summary);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const cacheKey = getCacheKey('stats', req.user);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const transactions = await Transaction.find({ user: req.user });

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
    res.json(response);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get chart data
router.get('/chart-data', auth, async (req, res) => {
  try {
    const cacheKey = getCacheKey('chart-data', req.user);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const transactions = await Transaction.find({ 
      user: req.user, 
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
    res.json(chartData);
  } catch (err) {
    console.error('Chart data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get comprehensive analytics data
router.get('/analytics', auth, async (req, res) => {
  try {
    const cacheKey = getCacheKey('analytics', req.user);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const transactions = await Transaction.find({ user: req.user }).sort({ date: 'desc' });

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
      return res.json(emptyAnalytics);
    }

    const analyticsData = calculateFinancialStats(transactions);
    
    cache.set(cacheKey, analyticsData);
    res.json(analyticsData);
  } catch (err) {
    console.error('Error generating analytics data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Professional PDF Report Route (NO CACHE - always fresh)
router.get('/report', auth, async (req, res) => {
  try {
    const User = require('../models/user.model');
    const user = await User.findById(req.user);
    const transactions = await Transaction.find({ user: req.user }).sort({ date: -1 });
    
    if (transactions.length === 0) {
      return res.status(404).json({ message: 'No transactions found for report generation' });
    }

    // Get user currency preferences (default to INR if not set)
    const userCurrency = user?.currency || { code: 'INR', locale: 'en-IN' };

    // Calculate comprehensive statistics
    const stats = calculateFinancialStats(transactions);
    
    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Financial_Report_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Generate PDF content with user's currency
    await generatePDFReport(doc, transactions, stats, userCurrency);
    
    // Finalize PDF
    doc.end();
    
  } catch (err) {
    console.error('Error generating PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

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

// Main PDF generation function
async function generatePDFReport(doc, transactions, stats, userCurrency) {
  let yPosition = 50;
  let currentPage = 1;
  
  // Currency formatting helper
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat(userCurrency.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    // Map currency codes to symbols safe for PDFKit (Standard Fonts)
    const symbols = {
      'INR': 'Rs ', // Rupee symbol ₹ is not supported in standard PDF fonts
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'AUD': 'A$',
      'CAD': 'C$',
    };

    const symbol = symbols[userCurrency.code] || `${userCurrency.code} `;
    return `${symbol}${formatted}`;
  };
  
  // Helper function to add page footer
  const addPageFooter = (pageNum, totalPages) => {
    const footerY = 750;
    doc.fontSize(8).fillColor('#999').text(
      `Page ${pageNum} of ${totalPages} | Generated by Personal Finance Tracker`, 
      50, 
      footerY, 
      { align: 'center', width: 495 }
    );
  };
  
  // Helper function to check if we need a new page
  const checkNewPage = (neededSpace = 100) => {
    if (yPosition > 700) {
      addPageFooter(currentPage, '...');
      doc.addPage();
      currentPage++;
      yPosition = 50;
    }
  };
  
  // Header
  doc.fontSize(24).fillColor('#2D3748').text('PERSONAL FINANCIAL REPORT', 50, yPosition, { align: 'center' });
  yPosition += 40;
  
  doc.fontSize(12).fillColor('#666').text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  })}`, 50, yPosition, { align: 'center' });
  yPosition += 20;
  
  doc.fontSize(10).text(`Report Period: ${transactions.length > 0 ? new Date(transactions[transactions.length - 1].date).toLocaleDateString() : 'N/A'} to ${transactions.length > 0 ? new Date(transactions[0].date).toLocaleDateString() : 'N/A'}`, 50, yPosition, { align: 'center' });
  yPosition += 40;
  
  // Executive Summary Box
  checkNewPage();
  doc.rect(50, yPosition, 495, 120).fill('#F7FAFC').stroke('#E2E8F0');
  yPosition += 15;
  
  doc.fontSize(16).fillColor('#2D3748').text('EXECUTIVE SUMMARY', 70, yPosition);
  yPosition += 25;
  
  // Summary stats in columns
  const leftCol = 70;
  const rightCol = 320;
  
  doc.fontSize(11).fillColor('#4A5568');
  doc.text('Total Income:', leftCol, yPosition).text(formatCurrency(stats.periods.allTime.income), leftCol + 100, yPosition);
  doc.text('This Month Income:', rightCol, yPosition).text(formatCurrency(stats.periods.thisMonth.income), rightCol + 120, yPosition);
  yPosition += 18;
  
  doc.text('Total Expenses:', leftCol, yPosition).text(formatCurrency(stats.periods.allTime.expense), leftCol + 100, yPosition);
  doc.text('This Month Expenses:', rightCol, yPosition).text(formatCurrency(stats.periods.thisMonth.expense), rightCol + 120, yPosition);
  yPosition += 18;
  
  doc.text('Net Balance:', leftCol, yPosition).fillColor(stats.periods.allTime.netBalance >= 0 ? '#38A169' : '#E53E3E').text(formatCurrency(stats.periods.allTime.netBalance), leftCol + 100, yPosition);
  doc.fillColor('#4A5568').text('Savings Rate:', rightCol, yPosition).text(`${stats.periods.thisMonth.savingsRate.toFixed(1)}%`, rightCol + 120, yPosition);
  yPosition += 18;
  
  doc.text('Total Transactions:', leftCol, yPosition).text(stats.totalTransactions.toString(), leftCol + 100, yPosition);
  doc.text('Avg Transaction:', rightCol, yPosition).text(formatCurrency(stats.periods.allTime.avgTransaction), rightCol + 120, yPosition);
  yPosition += 30;
  
  // Key Insights
  checkNewPage(100);
  doc.fontSize(14).fillColor('#2D3748').text('KEY FINANCIAL INSIGHTS', 50, yPosition);
  yPosition += 20;
  
  stats.insights.forEach((insight) => {
    checkNewPage();
    doc.fontSize(10).fillColor('#4A5568').text(`• ${insight}`, 70, yPosition);
    yPosition += 15;
  });
  yPosition += 20;
  
  // Top Expense Categories
  checkNewPage(150);
  doc.fontSize(14).fillColor('#2D3748').text('TOP EXPENSE CATEGORIES', 50, yPosition);
  yPosition += 25;
  
  // Table header
  doc.rect(50, yPosition, 495, 25).fill('#EDF2F7').stroke('#CBD5E0');
  doc.fontSize(10).fillColor('#2D3748');
  doc.text('Category', 60, yPosition + 8);
  doc.text('Amount', 200, yPosition + 8);
  doc.text('Transactions', 300, yPosition + 8);
  doc.text('Avg per Transaction', 420, yPosition + 8);
  yPosition += 25;
  
  stats.topExpenseCategories.forEach((cat, index) => {
    checkNewPage();
    const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F7FAFC';
    doc.rect(50, yPosition, 495, 20).fill(bgColor).stroke('#E2E8F0');
    doc.fontSize(9).fillColor('#4A5568');
    doc.text(cat.category.substring(0, 20), 60, yPosition + 6);
    doc.text(formatCurrency(cat.amount), 200, yPosition + 6);
    doc.text(cat.count.toString(), 320, yPosition + 6);
    doc.text(formatCurrency(cat.amount / cat.count), 440, yPosition + 6);
    yPosition += 20;
  });
  yPosition += 20;
  
  // Monthly Trends Chart (Text-based)
  checkNewPage(200);
  doc.fontSize(14).fillColor('#2D3748').text('MONTHLY TRENDS (Last 12 Months)', 50, yPosition);
  yPosition += 25;
  
  // Chart header
  doc.rect(50, yPosition, 495, 25).fill('#EDF2F7').stroke('#CBD5E0');
  doc.fontSize(10).fillColor('#2D3748');
  doc.text('Month', 60, yPosition + 8);
  doc.text('Income', 140, yPosition + 8);
  doc.text('Expenses', 220, yPosition + 8);
  doc.text('Net Balance', 300, yPosition + 8);
  doc.text('Savings Rate', 400, yPosition + 8);
  doc.text('Txns', 480, yPosition + 8);
  yPosition += 25;
  
  stats.monthlyTrends.forEach((trend, index) => {
    checkNewPage();
    const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F7FAFC';
    doc.rect(50, yPosition, 495, 20).fill(bgColor).stroke('#E2E8F0');
    doc.fontSize(9).fillColor('#4A5568');
    doc.text(trend.month, 60, yPosition + 6);
    doc.text(formatCurrency(trend.income), 140, yPosition + 6);
    doc.text(formatCurrency(trend.expense), 220, yPosition + 6);
    doc.fillColor(trend.netBalance >= 0 ? '#38A169' : '#E53E3E').text(formatCurrency(trend.netBalance), 300, yPosition + 6);
    doc.fillColor('#4A5568').text(`${trend.savingsRate.toFixed(1)}%`, 410, yPosition + 6);
    doc.text(trend.count.toString(), 485, yPosition + 6);
    yPosition += 20;
  });
  yPosition += 30;
  
  // Detailed Transaction History
  addPageFooter(currentPage, '...');
  doc.addPage();
  currentPage++;
  yPosition = 50;
  
  doc.fontSize(14).fillColor('#2D3748').text('TRANSACTION HISTORY', 50, yPosition);
  yPosition += 25;
  
  // Transaction table header
  doc.rect(50, yPosition, 495, 25).fill('#EDF2F7').stroke('#CBD5E0');
  doc.fontSize(9).fillColor('#2D3748');
  doc.text('Date', 60, yPosition + 8);
  doc.text('Type', 130, yPosition + 8);
  doc.text('Category', 180, yPosition + 8);
  doc.text('Amount', 280, yPosition + 8);
  doc.text('Description', 350, yPosition + 8);
  yPosition += 25;
  
  let runningBalance = 0;
  transactions.slice().reverse().forEach((t, index) => {
    if (index >= 50) return; // Limit to recent 50 transactions
    
    checkNewPage();
    const amount = parseFloat(t.amount);
    runningBalance += (t.type === 'income' ? amount : -amount);
    
    const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F7FAFC';
    doc.rect(50, yPosition, 495, 18).fill(bgColor).stroke('#E2E8F0');
    
    doc.fontSize(8).fillColor('#4A5568');
    doc.text(new Date(t.date).toLocaleDateString(), 60, yPosition + 5);
    doc.fillColor(t.type === 'income' ? '#38A169' : '#E53E3E').text(t.type.toUpperCase(), 130, yPosition + 5);
    doc.fillColor('#4A5568').text(t.category.substring(0, 12), 180, yPosition + 5);
    doc.text(formatCurrency(amount), 280, yPosition + 5);
    doc.text(String(t.description || '').substring(0, 25), 350, yPosition + 5);
    yPosition += 18;
  });
  
  // Add footer to last page
  addPageFooter(currentPage, currentPage);
}

module.exports = router;
