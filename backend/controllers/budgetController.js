const budgetService = require('../services/budgetService');

const getBudgetGoals = async (req, res, next) => {
  try {
    const result = await budgetService.getBudgetGoals(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const createBudgetGoal = async (req, res, next) => {
  try {
    const result = await budgetService.createBudgetGoal(req.organizationId, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

const updateBudgetGoal = async (req, res, next) => {
  try {
    const result = await budgetService.updateBudgetGoal(req.organizationId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
};

const deleteBudgetGoal = async (req, res, next) => {
  try {
    const result = await budgetService.deleteBudgetGoal(req.organizationId, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const result = await budgetService.getCategories(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getBudgetProgress = async (req, res, next) => {
  try {
    const result = await budgetService.getBudgetProgress(req.organizationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBudgetGoals,
  createBudgetGoal,
  updateBudgetGoal,
  deleteBudgetGoal,
  getCategories,
  getBudgetProgress
};
