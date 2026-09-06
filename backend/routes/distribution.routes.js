const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const requireRole = require('../middleware/requireRole');
const requireActive = require('../middleware/requireActive');
const distributionController = require('../controllers/distributionController');

// All distribution endpoints are organization-scoped and require an active membership in the organization
router.use(auth, resolveOrganization);

// --------------------------------------------------------------------------
// 1. Counter & Real-Time Endpoints (Accessible to OPERATOR, ADMIN, OWNER)
// --------------------------------------------------------------------------
const counterRoles = requireRole(['OWNER', 'ADMIN', 'DISTRIBUTION_OPERATOR']);

router.get('/campaigns', counterRoles, distributionController.getCampaigns);
router.get('/campaigns/:id', counterRoles, distributionController.getCampaignById);
router.get('/campaigns/:id/records', counterRoles, distributionController.getRecords);
router.get('/campaigns/:id/events', counterRoles, distributionController.subscribeDistributionEvents);

// Atomic distribution action by operator/admin (requires active organization)
router.post(
  '/campaigns/:id/records/:recordId/distribute',
  requireActive,
  counterRoles,
  distributionController.distributeRecord
);

// --------------------------------------------------------------------------
// 2. Administrative Analytics & Accountability Endpoints (ADMIN & OWNER Only)
// --------------------------------------------------------------------------
const adminRoles = requireRole(['OWNER', 'ADMIN']);

router.get('/analytics/summary', adminRoles, distributionController.getDistributionSummary);
router.get('/analytics/operators', adminRoles, distributionController.getDistributionByOperator);
router.get('/analytics/operators/:operatorId/history', adminRoles, distributionController.getOperatorDistributionHistory);
router.get('/analytics/activity', adminRoles, distributionController.getDistributionActivity);
router.get('/analytics/recipients/history', adminRoles, distributionController.getRecipientDistributionHistory);

// Operator Management (ADMIN & OWNER)
router.get('/operators', adminRoles, distributionController.getDistributionOperators);
router.post('/operators', requireActive, adminRoles, distributionController.addDistributionOperator);
router.patch('/operators/:memberId/status', requireActive, adminRoles, distributionController.setOperatorStatus);

// Excel Export
router.get('/campaigns/:id/export/excel', adminRoles, distributionController.exportCampaignExcel);

// Reversal / Undo Action
router.post('/campaigns/:id/records/:recordId/undo', requireActive, adminRoles, distributionController.undoDistribution);

// Campaign Lifecycle Management (ADMIN & OWNER)
router.post('/campaigns', requireActive, adminRoles, distributionController.createCampaign);
router.put('/campaigns/:id', requireActive, adminRoles, distributionController.updateCampaign);
router.delete('/campaigns/:id', requireActive, adminRoles, distributionController.deleteCampaign);
router.post('/campaigns/:id/sync', requireActive, adminRoles, distributionController.syncEligibleContributors);

module.exports = router;
