const router = require('express').Router();
const auth = require('../middleware/auth');
const organizationController = require('../controllers/organizationController');
const fieldController = require('../controllers/contributorFieldController');

router.post('/', auth, organizationController.createOrganization);
router.get('/', auth, organizationController.getOrganizations);
router.get('/:id', auth, organizationController.getOrganization);
router.put('/:id', auth, organizationController.updateOrganization);
router.patch('/:id/public-settings', auth, organizationController.patchPublicSettings);
router.delete('/:id', auth, organizationController.deleteOrganization);

// Contributor Fields
router.get('/:id/contributor-fields', auth, fieldController.getFields);
router.post('/:id/contributor-fields', auth, fieldController.addField);
router.put('/:id/contributor-fields/:key', auth, fieldController.updateField);
router.delete('/:id/contributor-fields/:key', auth, fieldController.deleteField);

// Reports
const reportController = require('../controllers/reportController');
router.get('/:id/reports/pdf', auth, reportController.generatePdfReport);
router.get('/:id/reports/excel', auth, reportController.generateExcelReport);

module.exports = router;
