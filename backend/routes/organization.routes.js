const router = require('express').Router();
const auth = require('../middleware/auth');
const resolveOrganization = require('../middleware/resolveOrganization');
const requireRole = require('../middleware/requireRole');
const requireActive = require('../middleware/requireActive');

const organizationController = require('../controllers/organizationController');
const fieldController = require('../controllers/contributorFieldController');
const memberController = require('../controllers/organizationMemberController');
const reportController = require('../controllers/reportController');
const auditLogController = require('../controllers/auditLogController');
const analyticsController = require('../controllers/analyticsController');

// Creation/Listing (No specific org resolved yet)
router.post('/', auth, organizationController.createOrganization);
router.get('/', auth, organizationController.getOrganizations);

// Member endpoints for user across all orgs
router.get('/memberships', auth, memberController.getUserMemberships);

// All routes below require resolving the organization and checking membership
router.use('/:id', auth, resolveOrganization);

// Organization Details & Settings
router.get('/:id', requireRole(['OWNER', 'ADMIN']), organizationController.getOrganization);

// Mutating endpoints require ACTIVE status (except archive/restore)
router.put('/:id', requireRole(['OWNER', 'ADMIN']), requireActive, organizationController.updateOrganization);
router.patch('/:id/public-settings', requireRole(['OWNER', 'ADMIN']), requireActive, organizationController.patchPublicSettings);
router.delete('/:id', requireRole(['OWNER']), requireActive, organizationController.deleteOrganization);

// Lifecycle Management
router.post('/:id/archive', requireRole(['OWNER']), organizationController.archiveOrganization);
router.post('/:id/restore', requireRole(['OWNER']), organizationController.restoreOrganization);

// Member Management
router.get('/:id/members', requireRole(['OWNER', 'ADMIN']), memberController.getOrganizationMembers);
router.post('/:id/members', requireRole(['OWNER']), requireActive, memberController.createMembership);
router.put('/:id/members/:memberId', requireRole(['OWNER']), requireActive, memberController.updateMembershipRole);
router.delete('/:id/members/:memberId', requireRole(['OWNER']), requireActive, memberController.removeMembership);

// Contributor Fields
router.get('/:id/contributor-fields', requireRole(['OWNER', 'ADMIN']), fieldController.getFields);
router.post('/:id/contributor-fields', requireRole(['OWNER', 'ADMIN']), requireActive, fieldController.addField);
router.put('/:id/contributor-fields/:key', requireRole(['OWNER', 'ADMIN']), requireActive, fieldController.updateField);
router.delete('/:id/contributor-fields/:key', requireRole(['OWNER', 'ADMIN']), requireActive, fieldController.deleteField);

// Reports
router.get('/:id/reports/pdf', requireRole(['OWNER', 'ADMIN']), reportController.generatePdfReport);
router.get('/:id/reports/excel', requireRole(['OWNER', 'ADMIN']), reportController.generateExcelReport);

// Audit & Integrity
router.get('/:id/audit-logs', requireRole(['OWNER', 'ADMIN']), auditLogController.getAuditLogs);
router.get('/:id/audit-logs/:auditId', requireRole(['OWNER', 'ADMIN']), auditLogController.getAuditLogById);
router.get('/:id/integrity-check', requireRole(['OWNER', 'ADMIN']), analyticsController.checkIntegrity);

module.exports = router;
