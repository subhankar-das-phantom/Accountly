const distributionService = require('../services/distributionService');

const createCampaign = async (req, res, next) => {
  try {
    const campaign = await distributionService.createCampaign(
      req.organizationId,
      req.user,
      req.body
    );
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
};

const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await distributionService.getCampaigns(req.organizationId);
    res.status(200).json(campaigns);
  } catch (err) {
    next(err);
  }
};

const getCampaignById = async (req, res, next) => {
  try {
    const campaign = await distributionService.getCampaignById(
      req.organizationId,
      req.params.id
    );
    res.status(200).json(campaign);
  } catch (err) {
    next(err);
  }
};

const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await distributionService.updateCampaign(
      req.organizationId,
      req.user,
      req.params.id,
      req.body
    );
    res.status(200).json(campaign);
  } catch (err) {
    next(err);
  }
};

const deleteCampaign = async (req, res, next) => {
  try {
    const result = await distributionService.deleteCampaign(
      req.organizationId,
      req.user,
      req.params.id
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const syncEligibleContributors = async (req, res, next) => {
  try {
    const result = await distributionService.syncEligibleContributors(
      req.organizationId,
      req.params.id
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getRecords = async (req, res, next) => {
  try {
    const result = await distributionService.getRecords(
      req.organizationId,
      req.params.id,
      req.query
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const distributeRecord = async (req, res, next) => {
  try {
    const record = await distributionService.distributeRecord(
      req.organizationId,
      req.params.id,
      req.params.recordId,
      req.user,
      req.body?.notes
    );
    res.status(200).json(record);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        code: err.code || 'ALREADY_DISTRIBUTED',
        message: err.message,
        distributedAt: err.distributedAt,
        distributedBy: err.distributedBy
      });
    }
    next(err);
  }
};

const undoDistribution = async (req, res, next) => {
  try {
    const record = await distributionService.undoDistribution(
      req.organizationId,
      req.params.id,
      req.params.recordId,
      req.user,
      req.body?.reason
    );
    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
};

const exportCampaignExcel = async (req, res, next) => {
  try {
    const buffer = await distributionService.exportCampaignExcel(
      req.organizationId,
      req.params.id
    );

    const filename = `Distribution_Roster_${req.params.id}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

const subscribeDistributionEvents = async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const organizationId = req.organizationId;

    // Verify campaign belongs to the organization
    await distributionService.getCampaignById(organizationId, campaignId);

    // Set Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const clientId = `${req.user}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // Acknowledge connection
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, campaignId })}\n\n`);
    if (typeof res.flush === 'function') res.flush();

    const distributionEventHub = require('../services/distributionEventHub');
    const client = {
      id: clientId,
      res,
      userId: req.user,
      organizationId,
      campaignId
    };

    distributionEventHub.subscribe(organizationId, campaignId, client);

    req.on('close', () => {
      distributionEventHub.unsubscribe(organizationId, campaignId, clientId);
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  syncEligibleContributors,
  getRecords,
  distributeRecord,
  undoDistribution,
  exportCampaignExcel,
  subscribeDistributionEvents
};
