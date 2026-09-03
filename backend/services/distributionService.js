const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const DistributionCampaign = require('../models/distributionCampaign.model');
const DistributionRecord = require('../models/distributionRecord.model');
const Transaction = require('../models/transaction.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const auditLogService = require('./auditLogService');

// Helper to escape regex search query safely
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Creates a distribution campaign and auto-enrolls eligible contributors
 */
const createCampaign = async (organizationId, actorId, data) => {
  const { name, description, itemName, eligibility, status } = data;

  if (!name || !itemName) {
    const error = new Error('Campaign name and item name are required.');
    error.status = 400;
    throw error;
  }

  const campaign = new DistributionCampaign({
    organizationId,
    name: name.trim(),
    description: description ? description.trim() : '',
    itemName: itemName.trim(),
    eligibility: {
      contributionRequired: eligibility?.contributionRequired ?? true,
      minAmount: eligibility?.minAmount ? Number(eligibility.minAmount) : 0,
      category: eligibility?.category ? eligibility.category.trim() : null,
      startDate: eligibility?.startDate ? new Date(eligibility.startDate) : null,
      endDate: eligibility?.endDate ? new Date(eligibility.endDate) : null
    },
    status: status || 'ACTIVE',
    createdBy: actorId
  });

  await campaign.save();

  // Audit log campaign creation
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_CAMPAIGN_CREATE',
    entityType: 'DistributionCampaign',
    entityId: campaign._id,
    newData: campaign.toObject()
  });

  // Automatically enroll eligible contributors
  const enrolledCount = await enrollEligibleContributions(campaign);

  return {
    ...campaign.toObject(),
    stats: {
      eligibleCount: enrolledCount,
      distributedCount: 0,
      remainingCount: enrolledCount,
      progressPercentage: 0
    }
  };
};

/**
 * Enrolls all eligible contribution records for an organization into the campaign
 */
const enrollEligibleContributions = async (campaign) => {
  const { organizationId, _id: campaignId, eligibility } = campaign;

  // Build eligibility query on transactions
  // CRITICAL RULE: type must strictly be 'contribution'. Expenses are NEVER eligible.
  const query = {
    organizationId,
    type: 'contribution',
    status: { $ne: 'cancelled' }
  };

  if (eligibility?.minAmount > 0) {
    query.amount = { $gte: eligibility.minAmount };
  }

  if (eligibility?.category) {
    query.category = eligibility.category;
  }

  if (eligibility?.startDate || eligibility?.endDate) {
    query.date = {};
    if (eligibility.startDate) query.date.$gte = eligibility.startDate;
    if (eligibility.endDate) query.date.$lte = eligibility.endDate;
  }

  const contributions = await Transaction.find(query).lean();
  if (!contributions || contributions.length === 0) {
    return 0;
  }

  // Get existing records for this campaign to avoid duplicate inserts
  const existingRecords = await DistributionRecord.find(
    { campaignId },
    { contributionId: 1 }
  ).lean();

  const existingContributionIds = new Set(
    existingRecords.map(r => r.contributionId.toString())
  );

  const newRecords = [];
  for (const contrib of contributions) {
    if (!existingContributionIds.has(contrib._id.toString())) {
      const name = (contrib.contributor?.name && contrib.contributor.name.trim()) 
        || (contrib.description && contrib.description.trim()) 
        || 'Anonymous Contributor';

      let metadataObj = {};
      if (contrib.contributor?.metadata) {
        metadataObj = contrib.contributor.metadata instanceof Map 
          ? Object.fromEntries(contrib.contributor.metadata) 
          : contrib.contributor.metadata;
      }

      newRecords.push({
        organizationId,
        campaignId,
        contributionId: contrib._id,
        contributor: {
          name,
          metadata: metadataObj
        },
        status: 'PENDING'
      });
    }
  }

  if (newRecords.length > 0) {
    await DistributionRecord.insertMany(newRecords, { ordered: false });
  }

  const totalCount = await DistributionRecord.countDocuments({
    campaignId,
    status: { $ne: 'CANCELLED' }
  });

  return totalCount;
};

/**
 * Get all campaigns for an organization with aggregated statistics
 */
const getCampaigns = async (organizationId) => {
  const campaigns = await DistributionCampaign.find({ organizationId })
    .sort({ createdAt: -1 });

  if (campaigns.length === 0) {
    return [];
  }

  // Auto-sync active campaigns so newly created contributions always appear
  for (const c of campaigns) {
    if (c.status === 'ACTIVE') {
      await enrollEligibleContributions(c);
    }
  }

  const campaignIds = campaigns.map(c => c._id);

  // Aggregate stats in a single database query for top performance
  const statsAggregation = await DistributionRecord.aggregate([
    {
      $match: {
        campaignId: { $in: campaignIds },
        status: { $ne: 'CANCELLED' }
      }
    },
    {
      $group: {
        _id: '$campaignId',
        eligibleCount: { $sum: 1 },
        distributedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, 1, 0]
          }
        }
      }
    }
  ]);

  const statsMap = new Map();
  statsAggregation.forEach(stat => {
    const eligible = stat.eligibleCount || 0;
    const distributed = stat.distributedCount || 0;
    const remaining = Math.max(0, eligible - distributed);
    const progress = eligible > 0 ? Number(((distributed / eligible) * 100).toFixed(1)) : 0;
    statsMap.set(stat._id.toString(), {
      eligibleCount: eligible,
      distributedCount: distributed,
      remainingCount: remaining,
      progressPercentage: progress
    });
  });

  return campaigns.map(c => {
    const plain = c.toObject ? c.toObject() : c;
    const defaultStats = {
      eligibleCount: 0,
      distributedCount: 0,
      remainingCount: 0,
      progressPercentage: 0
    };
    return {
      ...plain,
      stats: statsMap.get(plain._id.toString()) || defaultStats
    };
  });
};

/**
 * Get a single campaign by ID with current stats
 */
const getCampaignById = async (organizationId, campaignId) => {
  const campaign = await DistributionCampaign.findOne({
    _id: campaignId,
    organizationId
  });

  if (!campaign) {
    const error = new Error('Distribution campaign not found');
    error.status = 404;
    throw error;
  }

  // Auto-sync newly added contributions
  if (campaign.status === 'ACTIVE') {
    await enrollEligibleContributions(campaign);
  }

  const [eligibleCount, distributedCount] = await Promise.all([
    DistributionRecord.countDocuments({ campaignId, status: { $ne: 'CANCELLED' } }),
    DistributionRecord.countDocuments({ campaignId, status: 'DISTRIBUTED' })
  ]);

  const remainingCount = Math.max(0, eligibleCount - distributedCount);
  const progressPercentage = eligibleCount > 0 ? Number(((distributedCount / eligibleCount) * 100).toFixed(1)) : 0;

  const plain = campaign.toObject ? campaign.toObject() : campaign;

  return {
    ...plain,
    stats: {
      eligibleCount,
      distributedCount,
      remainingCount,
      progressPercentage
    }
  };
};

/**
 * Updates a distribution campaign
 */
const updateCampaign = async (organizationId, actorId, campaignId, updateData) => {
  const campaign = await DistributionCampaign.findOne({
    _id: campaignId,
    organizationId
  });

  if (!campaign) {
    const error = new Error('Distribution campaign not found');
    error.status = 404;
    throw error;
  }

  const previousData = campaign.toObject();

  if (updateData.name !== undefined) campaign.name = updateData.name.trim();
  if (updateData.description !== undefined) campaign.description = updateData.description.trim();
  if (updateData.itemName !== undefined) campaign.itemName = updateData.itemName.trim();
  
  if (updateData.status !== undefined) {
    const validStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(updateData.status)) {
      const error = new Error('Invalid campaign status.');
      error.status = 400;
      throw error;
    }

    if (updateData.status === 'COMPLETED' && campaign.status !== 'COMPLETED') {
      campaign.completedAt = new Date();
    } else if (updateData.status !== 'COMPLETED') {
      campaign.completedAt = null;
    }
    campaign.status = updateData.status;
  }

  await campaign.save();

  // Audit log campaign update
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_CAMPAIGN_UPDATE',
    entityType: 'DistributionCampaign',
    entityId: campaign._id,
    previousData,
    newData: campaign.toObject()
  });

  return getCampaignById(organizationId, campaign._id);
};

/**
 * Deletes a campaign and cascades associated distribution records
 */
const deleteCampaign = async (organizationId, actorId, campaignId) => {
  const campaign = await DistributionCampaign.findOne({
    _id: campaignId,
    organizationId
  });

  if (!campaign) {
    const error = new Error('Distribution campaign not found');
    error.status = 404;
    throw error;
  }

  const previousData = campaign.toObject();

  // Delete records and campaign
  await DistributionRecord.deleteMany({ campaignId, organizationId });
  await DistributionCampaign.deleteOne({ _id: campaignId, organizationId });

  // Audit log campaign deletion
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_CAMPAIGN_DELETE',
    entityType: 'DistributionCampaign',
    entityId: campaignId,
    previousData
  });

  return { success: true, message: 'Campaign and associated distribution records deleted successfully.' };
};

/**
 * Sync newly added contributions for a campaign
 */
const syncEligibleContributors = async (organizationId, campaignId) => {
  const campaign = await DistributionCampaign.findOne({
    _id: campaignId,
    organizationId
  });

  if (!campaign) {
    const error = new Error('Distribution campaign not found');
    error.status = 404;
    throw error;
  }

  const initialCount = await DistributionRecord.countDocuments({
    campaignId,
    status: { $ne: 'CANCELLED' }
  });

  const totalCount = await enrollEligibleContributions(campaign);
  const newlyAdded = Math.max(0, totalCount - initialCount);

  return {
    enrolledCount: newlyAdded,
    totalCount
  };
};

/**
 * Get distribution records for a campaign with search & dynamic metadata filtering
 */
const getRecords = async (organizationId, campaignId, queryParams = {}) => {
  // Auto-sync any newly added contributions for active campaigns
  const campaign = await DistributionCampaign.findOne({ _id: campaignId, organizationId });
  if (campaign && campaign.status === 'ACTIVE') {
    await enrollEligibleContributions(campaign);
  }

  const {
    search,
    status,
    page = 1,
    pageSize = 25
  } = queryParams;

  const filter = {
    organizationId,
    campaignId
  };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (search && search.trim().length > 0) {
    const trimmed = search.trim();
    const escaped = escapeRegex(trimmed);

    // Fetch org contributorFields to build authorized metadata search paths
    const org = await Organization.findById(organizationId).lean();
    const configuredFields = org?.contributorFields || [];

    const orConditions = [
      { 'contributor.name': { $regex: escaped, $options: 'i' } }
    ];

    // If search is a valid ObjectId, allow matching on contributionId or recordId
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      const objId = new mongoose.Types.ObjectId(trimmed);
      orConditions.push({ contributionId: objId });
      orConditions.push({ _id: objId });
    }

    // Secure search matching ONLY configured contributorFields keys
    for (const field of configuredFields) {
      if (field.key) {
        orConditions.push({
          [`contributor.metadata.${field.key}`]: { $regex: escaped, $options: 'i' }
        });
      }
    }

    filter.$or = orConditions;
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const skip = (p - 1) * ps;

  const [records, totalCount] = await Promise.all([
    DistributionRecord.find(filter)
      .sort({ status: 1, 'contributor.name': 1 }) // PENDING first, then by name
      .skip(skip)
      .limit(ps)
      .populate('distributedBy', 'username')
      .populate('contributionId', 'amount category date status')
      .lean(),
    DistributionRecord.countDocuments(filter)
  ]);

  // Clean metadata map if needed
  const formattedRecords = records.map(r => {
    let metadataObj = {};
    if (r.contributor?.metadata) {
      metadataObj = r.contributor.metadata instanceof Map 
        ? Object.fromEntries(r.contributor.metadata) 
        : r.contributor.metadata;
    }

    return {
      _id: r._id,
      campaignId: r.campaignId,
      contributionId: r.contributionId,
      contributor: {
        name: r.contributor?.name || 'Anonymous Contributor',
        metadata: metadataObj
      },
      status: r.status,
      distributedAt: r.distributedAt,
      distributedBy: r.distributedBy ? { _id: r.distributedBy._id, username: r.distributedBy.username } : null,
      notes: r.notes,
      createdAt: r.createdAt
    };
  });

  return {
    records: formattedRecords,
    pagination: {
      page: p,
      pageSize: ps,
      totalCount,
      totalPages: Math.ceil(totalCount / ps),
      hasMore: skip + records.length < totalCount
    }
  };
};

/**
 * Mark a pending distribution record as DISTRIBUTED.
 * Implements strict atomic concurrency protection.
 */
const distributeRecord = async (organizationId, campaignId, recordId, actorId, notes) => {
  // ATOMIC OPERATION: findOneAndUpdate with status === 'PENDING'
  // Guarantees only ONE admin can succeed even during simultaneous clicks
  const updated = await DistributionRecord.findOneAndUpdate(
    {
      _id: recordId,
      organizationId,
      campaignId,
      status: 'PENDING'
    },
    {
      $set: {
        status: 'DISTRIBUTED',
        distributedAt: new Date(),
        distributedBy: actorId,
        notes: notes ? notes.trim() : ''
      }
    },
    { new: true }
  ).populate('distributedBy', 'username')
   .populate('contributionId', 'amount category date');

  if (!updated) {
    // Determine the exact conflict reason
    const existing = await DistributionRecord.findOne({
      _id: recordId,
      organizationId,
      campaignId
    }).populate('distributedBy', 'username');

    if (!existing) {
      const error = new Error('Distribution record not found');
      error.status = 404;
      throw error;
    }

    if (existing.status === 'DISTRIBUTED') {
      const error = new Error('This item has already been distributed.');
      error.status = 409;
      error.code = 'ALREADY_DISTRIBUTED';
      error.distributedAt = existing.distributedAt;
      error.distributedBy = existing.distributedBy ? existing.distributedBy.username : 'Unknown Admin';
      throw error;
    }

    if (existing.status === 'CANCELLED') {
      const error = new Error('This contributor entitlement has been cancelled.');
      error.status = 400;
      throw error;
    }

    const error = new Error('Record cannot be distributed in its current state.');
    error.status = 400;
    throw error;
  }

  // Audit log distribution
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_MARKED',
    entityType: 'DistributionRecord',
    entityId: updated._id,
    previousData: { status: 'PENDING' },
    newData: {
      status: 'DISTRIBUTED',
      distributedAt: updated.distributedAt,
      distributedBy: actorId,
      notes: updated.notes
    },
    metadata: {
      campaignId,
      contributorName: updated.contributor?.name
    }
  });

  return {
    _id: updated._id,
    campaignId: updated.campaignId,
    contributionId: updated.contributionId,
    contributor: {
      name: updated.contributor?.name,
      metadata: updated.contributor?.metadata instanceof Map
        ? Object.fromEntries(updated.contributor.metadata)
        : updated.contributor?.metadata
    },
    status: updated.status,
    distributedAt: updated.distributedAt,
    distributedBy: updated.distributedBy ? { _id: updated.distributedBy._id, username: updated.distributedBy.username } : null,
    notes: updated.notes
  };
};

/**
 * Undo distribution of a record, returning it to PENDING.
 * Requires OWNER or ADMIN role.
 */
const undoDistribution = async (organizationId, campaignId, recordId, actorId, reason) => {
  const existing = await DistributionRecord.findOne({
    _id: recordId,
    organizationId,
    campaignId
  }).populate('distributedBy', 'username');

  if (!existing) {
    const error = new Error('Distribution record not found');
    error.status = 404;
    throw error;
  }

  if (existing.status !== 'DISTRIBUTED') {
    const error = new Error('Only distributed records can be undone.');
    error.status = 400;
    throw error;
  }

  const previousData = {
    status: 'DISTRIBUTED',
    distributedAt: existing.distributedAt,
    distributedBy: existing.distributedBy ? existing.distributedBy._id : null,
    notes: existing.notes
  };

  existing.status = 'PENDING';
  existing.distributedAt = null;
  existing.distributedBy = null;
  if (reason) {
    existing.notes = existing.notes 
      ? `${existing.notes} | Undo: ${reason}` 
      : `Undo: ${reason}`;
  }

  await existing.save();

  // Audit log undo
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_UNDO',
    entityType: 'DistributionRecord',
    entityId: existing._id,
    previousData,
    newData: {
      status: 'PENDING',
      distributedAt: null,
      distributedBy: null,
      notes: existing.notes
    },
    metadata: {
      campaignId,
      contributorName: existing.contributor?.name,
      reason: reason || 'Admin correction'
    }
  });

  return {
    _id: existing._id,
    campaignId: existing.campaignId,
    contributionId: existing.contributionId,
    contributor: {
      name: existing.contributor?.name,
      metadata: existing.contributor?.metadata instanceof Map
        ? Object.fromEntries(existing.contributor.metadata)
        : existing.contributor?.metadata
    },
    status: existing.status,
    distributedAt: null,
    distributedBy: null,
    notes: existing.notes
  };
};

/**
 * Export campaign distribution roster to Excel
 */
const exportCampaignExcel = async (organizationId, campaignId) => {
  const [campaign, org, records] = await Promise.all([
    DistributionCampaign.findOne({ _id: campaignId, organizationId }).lean(),
    Organization.findById(organizationId).lean(),
    DistributionRecord.find({ campaignId, organizationId })
      .sort({ 'contributor.name': 1 })
      .populate('distributedBy', 'username')
      .populate('contributionId', 'amount category date')
      .lean()
  ]);

  if (!campaign) {
    const error = new Error('Distribution campaign not found');
    error.status = 404;
    throw error;
  }

  const configuredFields = org?.contributorFields || [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Accountly';
  workbook.created = new Date();

  // 1. Summary Sheet
  const summarySheet = workbook.addWorksheet('Campaign Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 30 }
  ];
  summarySheet.getRow(1).font = { bold: true };

  const eligibleCount = records.filter(r => r.status !== 'CANCELLED').length;
  const distributedCount = records.filter(r => r.status === 'DISTRIBUTED').length;
  const remainingCount = Math.max(0, eligibleCount - distributedCount);
  const progressPct = eligibleCount > 0 ? ((distributedCount / eligibleCount) * 100).toFixed(1) : 0;

  summarySheet.addRows([
    { metric: 'Campaign Name', value: campaign.name },
    { metric: 'Allocated Item', value: campaign.itemName },
    { metric: 'Status', value: campaign.status },
    { metric: 'Description', value: campaign.description || 'N/A' },
    { metric: 'Report Generated At', value: new Date().toLocaleString() },
    { metric: '' },
    { metric: 'Total Eligible Contributors', value: eligibleCount },
    { metric: 'Distributed Items', value: distributedCount },
    { metric: 'Remaining to Distribute', value: remainingCount },
    { metric: 'Distribution Progress', value: `${progressPct}%` }
  ]);

  // 2. Distribution Roster Sheet
  const rosterSheet = workbook.addWorksheet('Distribution Roster');
  
  // Base columns
  const rosterColumns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Contributor Name', key: 'name', width: 25 }
  ];

  // Dynamic contributor fields from org configuration
  configuredFields.forEach(field => {
    rosterColumns.push({
      header: field.label || field.key,
      key: `meta_${field.key}`,
      width: 18
    });
  });

  rosterColumns.push(
    { header: 'Contribution Amount', key: 'amount', width: 20 },
    { header: 'Contribution Date', key: 'contribDate', width: 18 },
    { header: 'Distribution Status', key: 'status', width: 20 },
    { header: 'Distributed At', key: 'distributedAt', width: 22 },
    { header: 'Distributed By', key: 'distributedBy', width: 20 },
    { header: 'Notes', key: 'notes', width: 25 }
  );

  rosterSheet.columns = rosterColumns;
  rosterSheet.getRow(1).font = { bold: true };

  records.forEach((r, index) => {
    const meta = r.contributor?.metadata || {};
    const rowData = {
      sno: index + 1,
      name: r.contributor?.name || 'Anonymous',
      amount: r.contributionId?.amount != null ? r.contributionId.amount : 'N/A',
      contribDate: r.contributionId?.date ? new Date(r.contributionId.date).toLocaleDateString() : 'N/A',
      status: r.status,
      distributedAt: r.distributedAt ? new Date(r.distributedAt).toLocaleString() : '—',
      distributedBy: r.distributedBy?.username || '—',
      notes: r.notes || ''
    };

    configuredFields.forEach(field => {
      rowData[`meta_${field.key}`] = meta[field.key] || '—';
    });

    rosterSheet.addRow(rowData);
  });

  return workbook.xlsx.writeBuffer();
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
  exportCampaignExcel
};
