const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const requireRole = require('../middleware/requireRole');
const requireActive = require('../middleware/requireActive');
const distributionController = require('../controllers/distributionController');

// All distribution endpoints are strictly organization-scoped and ADMIN/OWNER only
router.use(auth, resolveOrganization, requireRole(['OWNER', 'ADMIN']));

// Campaign Management (Read)
router.get('/campaigns', distributionController.getCampaigns);
router.get('/campaigns/:id', distributionController.getCampaignById);
router.get('/campaigns/:id/export/excel', distributionController.exportCampaignExcel);

// Distribution Records (Read / Search)
router.get('/campaigns/:id/records', distributionController.getRecords);

// Mutating operations require ACTIVE organization status
router.use(requireActive);

// Campaign Management (Mutating)
router.post('/campaigns', distributionController.createCampaign);
router.put('/campaigns/:id', distributionController.updateCampaign);
router.delete('/campaigns/:id', distributionController.deleteCampaign);
router.post('/campaigns/:id/sync', distributionController.syncEligibleContributors);

// Distribution Actions
router.post('/campaigns/:id/records/:recordId/distribute', distributionController.distributeRecord);
router.post('/campaigns/:id/records/:recordId/undo', distributionController.undoDistribution);

module.exports = router;
