const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const requireRole = require('../middleware/requireRole');
const requireActive = require('../middleware/requireActive');
const budgetController = require('../controllers/budgetController');

// All budget routes are organization-scoped
router.use(auth, resolveOrganization, requireRole(['OWNER', 'ADMIN']));

// Get all budget goals for the organization
router.get('/', budgetController.getBudgetGoals);

// Get available categories (from existing transactions)
router.get('/categories', budgetController.getCategories);

// Get budget progress for current month
router.get('/progress', budgetController.getBudgetProgress);

// Mutating endpoints require ACTIVE status
router.use(requireActive);

// Add a new budget goal
router.post('/', budgetController.createBudgetGoal);

// Update an existing budget goal
router.put('/:id', budgetController.updateBudgetGoal);

// Delete a budget goal
router.delete('/:id', budgetController.deleteBudgetGoal);



module.exports = router;
