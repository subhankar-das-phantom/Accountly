const router = require('express').Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// Get transaction summary
router.get('/summary', auth, analyticsController.getSummary);

// Get statistics
router.get('/stats', auth, analyticsController.getStats);

// Get chart data
router.get('/chart-data', auth, analyticsController.getChartData);

// Get comprehensive analytics data
router.get('/analytics', auth, analyticsController.getAnalytics);

module.exports = router;
