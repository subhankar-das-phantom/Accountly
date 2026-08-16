const router = require('express').Router();
const auth = require('../middleware/auth');
const organizationController = require('../controllers/organizationController');

router.post('/', auth, organizationController.createOrganization);
router.get('/', auth, organizationController.getOrganizations);
router.get('/:id', auth, organizationController.getOrganization);
router.put('/:id', auth, organizationController.updateOrganization);
router.delete('/:id', auth, organizationController.deleteOrganization);

module.exports = router;
