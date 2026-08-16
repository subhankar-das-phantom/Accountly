const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const requireRole = require('../middleware/requireRole');
const requireActive = require('../middleware/requireActive');
const transactionController = require('../controllers/transactionController');

// All transaction routes require authentication and organization resolution
router.use(auth);
router.use(resolveOrganization);

// Get transactions
router.get('/', requireRole(['OWNER', 'ADMIN']), transactionController.getTransactions);

// Mutating endpoints require ACTIVE status
router.use(requireActive);

// Add new transaction
router.post('/', requireRole(['OWNER', 'ADMIN']), transactionController.createTransaction);

// Update a transaction
router.put('/:id', requireRole(['OWNER', 'ADMIN']), transactionController.updateTransaction);

// Delete a transaction
router.delete('/:id', requireRole(['OWNER', 'ADMIN']), transactionController.deleteTransaction);

module.exports = router;
