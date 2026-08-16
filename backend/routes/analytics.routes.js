const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const analyticsController = require('../controllers/analyticsController');

// Get transaction summary
router.get('/summary', auth, resolveOrganization, analyticsController.getSummary);

// Get statistics
router.get('/stats', auth, resolveOrganization, analyticsController.getStats);

// Get chart data
router.get('/chart-data', auth, resolveOrganization, analyticsController.getChartData);

// Get comprehensive analytics data
router.get('/analytics', auth, resolveOrganization, analyticsController.getAnalytics);

// Get budget vs actual
router.get('/budget-vs-actual', auth, resolveOrganization, analyticsController.getBudgetVsActual);

module.exports = router;
