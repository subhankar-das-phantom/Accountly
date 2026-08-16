const mongoose = require('mongoose');
const BudgetGoal = require('../models/budgetGoal.model');
const Transaction = require('../models/transaction.model');

const getBudgetGoals = async (organizationId) => {
  return await BudgetGoal.find({ organizationId });
};

const createBudgetGoal = async (organizationId, data) => {
  const { category, amount, month, year } = data;

  const existingGoal = await BudgetGoal.findOne({
    organizationId,
    category,
    month,
    year,
  });

  if (existingGoal) {
    const error = new Error('Budget goal for this category and month already exists.');
    error.status = 400;
    throw error;
  }

  const newBudgetGoal = new BudgetGoal({
    organizationId,
    category,
    amount,
    month,
    year,
  });

  return await newBudgetGoal.save();
};

const updateBudgetGoal = async (organizationId, goalId, data) => {
  const { category, amount, month, year } = data;

  const updatedBudgetGoal = await BudgetGoal.findOneAndUpdate(
    { _id: goalId, organizationId },
    { category, amount, month, year },
    { new: true, runValidators: true }
  );

  if (!updatedBudgetGoal) {
    const error = new Error('Budget goal not found or unauthorized.');
    error.status = 404;
    throw error;
  }

  return updatedBudgetGoal;
};

const deleteBudgetGoal = async (organizationId, goalId) => {
  const deletedBudgetGoal = await BudgetGoal.findOneAndDelete({
    _id: goalId,
    organizationId,
  });

  if (!deletedBudgetGoal) {
    const error = new Error('Budget goal not found or unauthorized.');
    error.status = 404;
    throw error;
  }

  return { message: 'Budget goal deleted successfully.' };
};

const getCategories = async (organizationId) => {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  return await Transaction.aggregate([
    { $match: { organizationId: orgObjectId, type: 'expense' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { category: '$_id', transactionCount: '$count', _id: 0 } },
  ]);
};

const getBudgetProgress = async (organizationId) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const budgetGoals = await BudgetGoal.find({
    organizationId,
    month: currentMonth,
    year: currentYear,
  });

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(
    currentYear,
    currentMonth + 1,
    0,
    23,
    59,
    59,
    999
  );

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  const actualSpending = await Transaction.aggregate([
    {
      $match: {
        organizationId: orgObjectId,
        type: 'expense',
        date: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    {
      $group: {
        _id: '$category',
        totalSpent: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  const budgetProgress = budgetGoals.map((goal) => {
    const actual = actualSpending.find(
      (spending) =>
        spending._id.toLowerCase().trim() ===
        goal.category.toLowerCase().trim()
    ) || { totalSpent: 0, transactionCount: 0 };

    const spent = actual.totalSpent;
    const remaining = goal.amount - spent;
    const percentageUsed = goal.amount > 0 ? (spent / goal.amount) * 100 : 0;

    return {
      _id: goal._id,
      category: goal.category,
      budgetAmount: goal.amount,
      actualSpent: spent,
      remaining: remaining,
      percentageUsed: percentageUsed,
      transactionCount: actual.transactionCount,
      status:
        percentageUsed > 100
          ? 'over'
          : percentageUsed > 80
          ? 'warning'
          : 'good',
      month: goal.month,
      year: goal.year,
    };
  });

  const totalBudget = budgetGoals.reduce((sum, goal) => sum + goal.amount, 0);
  const totalSpent = actualSpending.reduce(
    (sum, spending) => sum + spending.totalSpent,
    0
  );

  return {
    budgetProgress,
    summary: {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      overallPercentageUsed:
        totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      categoriesCount: budgetGoals.length,
    },
    month: currentMonth,
    year: currentYear,
  };
};

module.exports = {
  getBudgetGoals,
  createBudgetGoal,
  updateBudgetGoal,
  deleteBudgetGoal,
  getCategories,
  getBudgetProgress
};
