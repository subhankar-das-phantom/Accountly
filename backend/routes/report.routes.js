const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const reportController = require('../controllers/reportController');

// Professional Report Routes (NO CACHE - always fresh)
// We add resolveOrganization to inject req.organizationId from user context
router.get('/report', auth, resolveOrganization, (req, res, next) => {
  req.params.id = req.organizationId;
  return reportController.generatePdfReport(req, res, next);
});

router.get('/report/excel', auth, resolveOrganization, (req, res, next) => {
  req.params.id = req.organizationId;
  return reportController.generateExcelReport(req, res, next);
});

module.exports = router;
