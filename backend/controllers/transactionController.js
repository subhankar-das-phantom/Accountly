const transactionService = require('../services/transactionService');

const getTransactions = async (req, res, next) => {
  try {
    const result = await transactionService.getTransactions(req.user, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.createTransaction(req.user, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.updateTransaction(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const result = await transactionService.deleteTransaction(req.user, req.params.id);
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
