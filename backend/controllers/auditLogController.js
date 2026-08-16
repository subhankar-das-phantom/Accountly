const auditLogService = require('../services/auditLogService');

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogs(req.organizationId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAuditLogById = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogById(req.organizationId, req.params.auditId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById
};
