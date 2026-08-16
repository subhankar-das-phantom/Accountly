const transactionService = require('../services/transactionService');

const getTransactions = async (req, res, next) => {
  try {
    const result = await transactionService.getTransactions(req.organizationId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    // We pass req.user as well temporarily because the model still requires it.
    // We'll update the service to handle both.
    const result = await transactionService.createTransaction(req.organizationId, req.user, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.updateTransaction(req.organizationId, req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.deleteTransaction(req.organizationId, req.params.id, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
