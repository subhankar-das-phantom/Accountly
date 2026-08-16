const router = require('express').Router();
const auth = require('../middleware/auth');
const budgetController = require('../controllers/budgetController');

// Get all budget goals for the authenticated user
router.get('/', auth, budgetController.getBudgetGoals);

// Add a new budget goal
router.post('/', auth, budgetController.createBudgetGoal);

// Update an existing budget goal
router.put('/:id', auth, budgetController.updateBudgetGoal);

// Delete a budget goal
router.delete('/:id', auth, budgetController.deleteBudgetGoal);

// Get available categories (from existing transactions)
router.get('/categories', auth, budgetController.getCategories);

// Get budget progress for current month
router.get('/progress', auth, budgetController.getBudgetProgress);

module.exports = router;
