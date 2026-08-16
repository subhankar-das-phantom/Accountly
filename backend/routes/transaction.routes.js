const router = require('express').Router();
const auth = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');

// Get all transactions
router.get('/', auth, transactionController.getTransactions);

// Add new transaction
router.post('/', auth, transactionController.createTransaction);

// Update transaction
router.put('/:id', auth, transactionController.updateTransaction);

// Delete transaction
router.delete('/:id', auth, transactionController.deleteTransaction);

module.exports = router;
