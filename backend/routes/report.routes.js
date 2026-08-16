const router = require('express').Router();
const auth = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// Professional PDF Report Route (NO CACHE - always fresh)
router.get('/report', auth, reportController.generateReport);

module.exports = router;
