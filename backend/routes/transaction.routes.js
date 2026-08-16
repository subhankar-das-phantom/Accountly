const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const transactionController = require('../controllers/transactionController');

// Get all transactions
router.get('/', auth, resolveOrganization, transactionController.getTransactions);

// Add new transaction
router.post('/', auth, resolveOrganization, transactionController.createTransaction);

// Update transaction
router.put('/:id', auth, resolveOrganization, transactionController.updateTransaction);

// Delete transaction
router.delete('/:id', auth, resolveOrganization, transactionController.deleteTransaction);

module.exports = router;
