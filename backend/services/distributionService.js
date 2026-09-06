const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const DistributionCampaign = require('../models/distributionCampaign.model');
const DistributionRecord = require('../models/distributionRecord.model');
const DistributionActivity = require('../models/distributionActivity.model');
const Transaction = require('../models/transaction.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const auditLogService = require('./auditLogService');
const distributionEventHub = require('./distributionEventHub');
const { invalidateUserCache } = require('../utils/cache');

// Helper to escape regex search query safely
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Build a phonetic pattern accommodating common transliteration variations:
// s/sh, b/bh, ee/i/y, oo/u, v/w/b, c/k/kh, ch/c, th/t, dh/d, a/o
const buildPhoneticPattern = (str) => {
  const tokens = [];
  let i = 0;
  const s = str.trim().toLowerCase();
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === 'sh') {
      tokens.push('s(h)?');
      i += 2;
    } else if (two === 'ch') {
      tokens.push('c(h)?');
      i += 2;
    } else if (two === 'th') {
      tokens.push('t(h)?');
      i += 2;
    } else if (two === 'dh') {
      tokens.push('d(h)?');
      i += 2;
    } else if (two === 'bh') {
      tokens.push('b(h)?');
      i += 2;
    } else if (two === 'kh') {
      tokens.push('k(h)?');
      i += 2;
    } else if (two === 'ee') {
      tokens.push('(ee|i)');
      i += 2;
    } else if (two === 'oo') {
      tokens.push('(oo|u)');
      i += 2;
    } else if (s[i] === 's') {
      tokens.push('s(h)?');
      i += 1;
    } else if (s[i] === 'b') {
      tokens.push('b(h)?');
      i += 1;
    } else if (s[i] === 'k') {
      tokens.push('(k(h)?|c)');
      i += 1;
    } else if (s[i] === 'c') {
      tokens.push('(c(h)?|k)');
      i += 1;
    } else if (s[i] === 'i') {
      tokens.push('(i|ee|y)');
      i += 1;
    } else if (s[i] === 'u') {
      tokens.push('(u|oo)');
      i += 1;
    } else if (s[i] === 'v' || s[i] === 'w') {
      tokens.push('[vwb]');
      i += 1;
    } else if (s[i] === 'a') {
      tokens.push('(a|o)');
      i += 1;
    } else if (s[i] === 'o') {
      tokens.push('(o|a)');
      i += 1;
    } else {
      tokens.push(s[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      i += 1;
    }
  }
  return tokens.join('');
};

// Fast Levenshtein distance calculation for typo tolerance fallback
const levenshteinDistance = (s1, s2) => {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
};

const matchesFuzzy = (search, target) => {
  if (!search || !target) return false;
  const s = search.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (t === s || t.includes(s)) return true;

  // Check word-by-word (e.g. searching first name or last name)
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(s) || w.includes(s)) return true;
    const dist = levenshteinDistance(s, w);
    const maxAllowedDist = s.length >= 6 ? 2 : (s.length >= 4 ? 1 : 0);
    if (dist <= maxAllowedDist) return true;
  }

  const dist = levenshteinDistance(s, t);
  const maxAllowed = s.length >= 6 ? 2 : (s.length >= 4 ? 1 : 0);
  return dist <= maxAllowed;
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
        item: campaign.itemName,
        quantity: 1,
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
  const {
    search,
    status,
    page = 1,
    pageSize = 25
  } = queryParams;

  const isSearch = search && search.trim().length > 0;

  const filter = {
    organizationId,
    campaignId
  };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (isSearch) {
    const trimmed = search.trim();
    const escaped = escapeRegex(trimmed);
    const phoneticPattern = buildPhoneticPattern(trimmed);

    // Contributor name is the primary search field with smart phonetic variation support
    // (e.g. subhankar matches Shubhankar, rohit matches Roheet, vikram matches Bikram)
    const orConditions = [
      { 'contributor.name': { $regex: phoneticPattern, $options: 'i' } }
    ];

    // If search is a valid ObjectId, allow matching on contributionId or recordId
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      const objId = new mongoose.Types.ObjectId(trimmed);
      orConditions.push({ contributionId: objId });
      orConditions.push({ _id: objId });
    }

    // Also match on notes
    orConditions.push({ notes: { $regex: escaped, $options: 'i' } });

    filter.$or = orConditions;
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const skip = (p - 1) * ps;

  // Optimized fetch: query with index-assisted sort
  let records = await DistributionRecord.find(filter)
    .sort({ status: 1, 'contributor.name': 1 }) // PENDING first, then alphabetically
    .skip(skip)
    .limit(ps)
    .populate('distributedBy', 'username')
    .populate('contributionId', 'amount category date status')
    .lean();

  let totalCount = 0;

  // Single-pass optimization: skip countDocuments if first page returned fewer than pageSize
  if (p === 1 && records.length < ps) {
    totalCount = records.length;
  } else {
    totalCount = await DistributionRecord.countDocuments(filter);
  }

  // Tier 2 Ultra-Fast Typo Fallback: only if 0 results found with phonetic regex
  if (isSearch && records.length === 0) {
    const trimmed = search.trim();
    const baseFilter = { organizationId, campaignId };
    if (status && status !== 'ALL') {
      baseFilter.status = status;
    }

    // Ultra-lean scan: only select _id, contributor.name and status (< 10ms)
    const candidates = await DistributionRecord.find(baseFilter)
      .select('_id contributor.name status')
      .lean();

    const fuzzyMatches = candidates.filter(r => matchesFuzzy(trimmed, r.contributor?.name));

    if (fuzzyMatches.length > 0) {
      // Sort: Pending first, then by closest Levenshtein distance
      fuzzyMatches.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'PENDING' ? -1 : 1;
        }
        const distA = levenshteinDistance(trimmed, a.contributor?.name || '');
        const distB = levenshteinDistance(trimmed, b.contributor?.name || '');
        return distA - distB;
      });

      totalCount = fuzzyMatches.length;
      const pageSlice = fuzzyMatches.slice(skip, skip + ps);
      const matchedIds = pageSlice.map(m => m._id);

      // Populate ONLY the sliced records to be displayed
      const populated = await DistributionRecord.find({ _id: { $in: matchedIds } })
        .populate('distributedBy', 'username')
        .populate('contributionId', 'amount category date status')
        .lean();

      // Preserve the ranked fuzzy order
      const popMap = new Map(populated.map(p => [p._id.toString(), p]));
      records = pageSlice.map(m => popMap.get(m._id.toString())).filter(Boolean);
    }
  }

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
 * Computes authoritative aggregate campaign statistics
 */
const getCampaignStats = async (campaignId) => {
  const [eligibleCount, distributedCount] = await Promise.all([
    DistributionRecord.countDocuments({ campaignId, status: { $ne: 'CANCELLED' } }),
    DistributionRecord.countDocuments({ campaignId, status: 'DISTRIBUTED' })
  ]);
  const remainingCount = Math.max(0, eligibleCount - distributedCount);
  const progressPercentage = eligibleCount > 0 ? Number(((distributedCount / eligibleCount) * 100).toFixed(1)) : 0;
  return {
    eligibleCount,
    distributedCount,
    remainingCount,
    progressPercentage
  };
};

/**
 * Mark a pending distribution record as DISTRIBUTED.
 * Implements strict atomic concurrency protection.
 * Authoritative mutation occurs on DistributionRecord.
 * Companion DistributionActivity projection is created as part of the same operation.
 */
const distributeRecord = async (organizationId, campaignId, recordId, actorId, notes) => {
  const campaign = await DistributionCampaign.findById(campaignId);
  const itemName = campaign ? campaign.itemName : 'Entitlement';

  // ATOMIC OPERATION: findOneAndUpdate with status === 'PENDING'
  // Guarantees only ONE operator can succeed even during simultaneous clicks
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
        item: itemName,
        quantity: 1,
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

  // Create immutable historical distribution activity projection
  let metadataObj = {};
  if (updated.contributor?.metadata) {
    metadataObj = updated.contributor.metadata instanceof Map
      ? Object.fromEntries(updated.contributor.metadata)
      : updated.contributor.metadata;
  }

  const activity = new DistributionActivity({
    organizationId,
    campaignId,
    recordId: updated._id,
    contributionId: updated.contributionId?._id || updated.contributionId,
    recipient: {
      name: updated.contributor?.name || 'Anonymous Contributor',
      metadata: metadataObj,
      contributionId: updated.contributionId?._id || updated.contributionId
    },
    item: updated.item || itemName,
    quantity: updated.quantity || 1,
    operator: {
      _id: updated.distributedBy?._id || actorId,
      username: updated.distributedBy?.username || 'Operator'
    },
    status: 'DISTRIBUTED',
    action: 'DISTRIBUTED',
    distributedAt: updated.distributedAt,
    notes: updated.notes
  });

  await activity.save();

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

  // Calculate authoritative live campaign stats after mutation
  const stats = await getCampaignStats(campaignId);

  // Invalidate relevant server-side caches
  invalidateUserCache(organizationId).catch(err => {
    console.error('Failed to invalidate organization cache after distribution:', err);
  });

  // Broadcast real-time distribution event to all connected admin and operator devices in this campaign
  distributionEventHub.publish(organizationId, campaignId, {
    type: 'DISTRIBUTION_UPDATED',
    organizationId: organizationId.toString(),
    campaignId: campaignId.toString(),
    recordId: updated._id.toString(),
    distributionId: activity._id.toString(),
    recipient: {
      name: updated.contributor?.name,
      metadata: metadataObj
    },
    operator: {
      _id: activity.operator._id.toString(),
      username: activity.operator.username
    },
    item: activity.item,
    quantity: activity.quantity,
    status: 'DISTRIBUTED',
    distributedAt: updated.distributedAt,
    distributedBy: updated.distributedBy ? { _id: updated.distributedBy._id, username: updated.distributedBy.username } : null,
    notes: updated.notes,
    stats,
    timestamp: new Date().toISOString(),
    version: Date.now()
  });

  return {
    _id: updated._id,
    distributionId: activity._id,
    campaignId: updated.campaignId,
    contributionId: updated.contributionId,
    contributor: {
      name: updated.contributor?.name,
      metadata: metadataObj
    },
    item: updated.item || itemName,
    quantity: updated.quantity || 1,
    status: updated.status,
    distributedAt: updated.distributedAt,
    distributedBy: updated.distributedBy ? { _id: updated.distributedBy._id, username: updated.distributedBy.username } : null,
    notes: updated.notes,
    stats
  };
};

/**
 * Undo distribution of a record, returning it to PENDING.
 * Requires OWNER or ADMIN role.
 * Implements strict atomic concurrency protection.
 * Authoritative mutation on DistributionRecord; historical DistributionActivity status transitions to REVERSED.
 */
const undoDistribution = async (organizationId, campaignId, recordId, actorId, reason) => {
  const undoNotes = reason ? (reason.trim() ? `Undo: ${reason.trim()}` : '') : '';

  // ATOMIC OPERATION: findOneAndUpdate with status === 'DISTRIBUTED'
  // Guarantees only a distributed record can be undone, preventing concurrent undo collisions
  const updated = await DistributionRecord.findOneAndUpdate(
    {
      _id: recordId,
      organizationId,
      campaignId,
      status: 'DISTRIBUTED'
    },
    {
      $set: {
        status: 'PENDING',
        distributedAt: null,
        distributedBy: null,
        reversedAt: new Date(),
        reversedBy: actorId,
        reversalReason: reason ? reason.trim() : 'Admin correction',
        notes: undoNotes
      }
    },
    { new: true }
  ).populate('contributionId', 'amount category date');

  if (!updated) {
    const existing = await DistributionRecord.findOne({
      _id: recordId,
      organizationId,
      campaignId
    });

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

    const error = new Error('Record cannot be undone in its current state.');
    error.status = 400;
    throw error;
  }

  // Update companion DistributionActivity projection non-destructively:
  // Transition status to REVERSED while original distribution timestamp, operator, and recipient remain immutable
  const actorUser = await User.findById(actorId).select('username');
  await DistributionActivity.updateMany(
    {
      recordId: updated._id,
      organizationId,
      status: 'DISTRIBUTED'
    },
    {
      $set: {
        status: 'REVERSED',
        action: 'REVERSED',
        'reversal.reversedAt': new Date(),
        'reversal.reversedBy': {
          _id: actorId,
          username: actorUser ? actorUser.username : 'Admin'
        },
        'reversal.reason': reason ? reason.trim() : 'Admin correction'
      }
    }
  );

  // Audit log undo
  await auditLogService.createAuditLog({
    organizationId,
    actorId,
    action: 'DISTRIBUTION_UNDO',
    entityType: 'DistributionRecord',
    entityId: updated._id,
    previousData: { status: 'DISTRIBUTED' },
    newData: {
      status: 'PENDING',
      distributedAt: null,
      distributedBy: null,
      reversedAt: updated.reversedAt,
      reversedBy: actorId,
      reversalReason: updated.reversalReason,
      notes: updated.notes
    },
    metadata: {
      campaignId,
      contributorName: updated.contributor?.name,
      reason: reason || 'Admin correction'
    }
  });

  // Calculate authoritative live campaign stats after undo
  const stats = await getCampaignStats(campaignId);

  // Invalidate relevant server-side caches
  invalidateUserCache(organizationId).catch(err => {
    console.error('Failed to invalidate organization cache after undo:', err);
  });

  // Broadcast real-time undo event to all connected admin devices in this campaign
  distributionEventHub.publish(organizationId, campaignId, {
    type: 'DISTRIBUTION_UPDATED',
    organizationId: organizationId.toString(),
    campaignId: campaignId.toString(),
    recordId: updated._id.toString(),
    status: 'PENDING',
    action: 'REVERSED',
    distributedAt: null,
    distributedBy: null,
    notes: updated.notes,
    stats,
    timestamp: new Date().toISOString(),
    version: Date.now()
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
    item: updated.item,
    quantity: updated.quantity,
    status: updated.status,
    distributedAt: null,
    distributedBy: null,
    reversedAt: updated.reversedAt,
    notes: updated.notes,
    stats
  };
};

/**
 * Authoritative Administrative Analytics Summary
 */
const getDistributionSummary = async (organizationId, campaignId) => {
  const matchRecord = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString()),
    status: { $ne: 'CANCELLED' }
  };
  const matchActivity = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString())
  };

  if (campaignId && campaignId !== 'ALL' && mongoose.Types.ObjectId.isValid(campaignId)) {
    matchRecord.campaignId = new mongoose.Types.ObjectId(campaignId.toString());
    matchActivity.campaignId = new mongoose.Types.ObjectId(campaignId.toString());
  }

  const [eligibleCount, distributedCount, quantityAggregation, reversedCount] = await Promise.all([
    DistributionRecord.countDocuments(matchRecord),
    DistributionRecord.countDocuments({ ...matchRecord, status: 'DISTRIBUTED' }),
    DistributionRecord.aggregate([
      { $match: { ...matchRecord, status: 'DISTRIBUTED' } },
      { $group: { _id: null, totalQty: { $sum: { $ifNull: ['$quantity', 1] } } } }
    ]),
    DistributionActivity.countDocuments({ ...matchActivity, status: 'REVERSED' })
  ]);

  const remainingCount = Math.max(0, eligibleCount - distributedCount);
  const distributionRate = eligibleCount > 0 ? Number(((distributedCount / eligibleCount) * 100).toFixed(1)) : 0;
  const totalQuantityDistributed = quantityAggregation[0]?.totalQty || distributedCount;

  return {
    eligibleCount,
    distributedCount,
    pendingCount: remainingCount,
    remainingCount,
    distributionRate,
    totalQuantityDistributed,
    reversedCount
  };
};

/**
 * Distribution by Operator Breakdown (Authoritative Aggregation)
 */
const getDistributionByOperator = async (organizationId, campaignId) => {
  const match = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString())
  };

  if (campaignId && campaignId !== 'ALL' && mongoose.Types.ObjectId.isValid(campaignId)) {
    match.campaignId = new mongoose.Types.ObjectId(campaignId.toString());
  }

  const operatorAggregation = await DistributionActivity.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$operator._id',
        username: { $first: '$operator.username' },
        distributedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, 1, 0] }
        },
        totalQuantity: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, { $ifNull: ['$quantity', 1] }, 0]
          }
        },
        reversedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 1, 0] }
        },
        lastActivity: { $max: '$distributedAt' }
      }
    },
    { $sort: { distributedCount: -1, lastActivity: -1 } }
  ]);

  return operatorAggregation.map(s => ({
    _id: s._id,
    username: s.username,
    operator: {
      _id: s._id,
      username: s.username
    },
    distributedCount: s.distributedCount,
    totalQuantity: s.totalQuantity,
    reversedCount: s.reversedCount,
    lastActivity: s.lastActivity
  }));
};

/**
 * Detailed Operator History (Drilldown: Rahul -> 34 distributions -> 34 recipients)
 */
const getOperatorDistributionHistory = async (organizationId, operatorId, queryParams = {}) => {
  const { campaignId, status, search, page = 1, pageSize = 25 } = queryParams;

  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString()),
    'operator._id': new mongoose.Types.ObjectId(operatorId.toString())
  };

  if (campaignId && campaignId !== 'ALL' && mongoose.Types.ObjectId.isValid(campaignId)) {
    filter.campaignId = new mongoose.Types.ObjectId(campaignId.toString());
  }

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (search && search.trim().length > 0) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { 'recipient.name': { $regex: escaped, $options: 'i' } },
      { item: { $regex: escaped, $options: 'i' } }
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const skip = (p - 1) * ps;

  const [records, totalCount, statsAgg, operatorUser] = await Promise.all([
    DistributionActivity.find(filter)
      .sort({ distributedAt: -1 })
      .skip(skip)
      .limit(ps)
      .populate('campaignId', 'name itemName')
      .lean(),
    DistributionActivity.countDocuments(filter),
    DistributionActivity.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId.toString()),
          'operator._id': new mongoose.Types.ObjectId(operatorId.toString())
        }
      },
      {
        $group: {
          _id: '$operator._id',
          distributedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, 1, 0] }
          },
          totalQuantity: {
            $sum: {
              $cond: [{ $eq: ['$status', 'DISTRIBUTED'] }, { $ifNull: ['$quantity', 1] }, 0]
            }
          },
          reversedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 1, 0] }
          }
        }
      }
    ]),
    User.findById(operatorId).select('username email').lean()
  ]);

  const stat = statsAgg[0] || { distributedCount: 0, totalQuantity: 0, reversedCount: 0 };

  const formattedRecords = records.map(r => {
    let meta = {};
    if (r.recipient?.metadata) {
      meta = r.recipient.metadata instanceof Map
        ? Object.fromEntries(r.recipient.metadata)
        : r.recipient.metadata;
    }
    return {
      _id: r._id,
      recordId: r.recordId,
      campaign: r.campaignId ? {
        _id: r.campaignId._id,
        name: r.campaignId.name,
        itemName: r.campaignId.itemName
      } : null,
      recipient: {
        name: r.recipient?.name || 'Anonymous',
        metadata: meta
      },
      item: r.item,
      quantity: r.quantity || 1,
      status: r.status,
      distributedAt: r.distributedAt,
      reversal: r.reversal,
      notes: r.notes
    };
  });

  return {
    operator: {
      _id: operatorId,
      username: operatorUser?.username || 'Operator',
      email: operatorUser?.email || ''
    },
    stats: {
      distributedCount: stat.distributedCount,
      totalQuantity: stat.totalQuantity,
      reversedCount: stat.reversedCount
    },
    records: formattedRecords,
    recipients: formattedRecords,
    total: totalCount,
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
 * Filtered Distribution Activity Feed with Server-Side Pagination
 */
const getDistributionActivity = async (organizationId, queryParams = {}) => {
  const {
    campaignId,
    operatorId,
    status,
    item,
    dateFrom,
    dateTo,
    search,
    page = 1,
    pageSize = 25
  } = queryParams;

  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString())
  };

  if (campaignId && campaignId !== 'ALL' && mongoose.Types.ObjectId.isValid(campaignId)) {
    filter.campaignId = new mongoose.Types.ObjectId(campaignId.toString());
  }

  if (operatorId && operatorId !== 'ALL' && mongoose.Types.ObjectId.isValid(operatorId)) {
    filter['operator._id'] = new mongoose.Types.ObjectId(operatorId.toString());
  }

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (item && item !== 'ALL') {
    filter.item = item;
  }

  if (dateFrom || dateTo) {
    filter.distributedAt = {};
    if (dateFrom) filter.distributedAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.distributedAt.$lte = end;
    }
  }

  if (search && search.trim().length > 0) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { 'recipient.name': { $regex: escaped, $options: 'i' } },
      { 'operator.username': { $regex: escaped, $options: 'i' } },
      { item: { $regex: escaped, $options: 'i' } },
      { notes: { $regex: escaped, $options: 'i' } }
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
  const skip = (p - 1) * ps;

  const [records, totalCount] = await Promise.all([
    DistributionActivity.find(filter)
      .sort({ distributedAt: -1 })
      .skip(skip)
      .limit(ps)
      .populate('campaignId', 'name itemName')
      .lean(),
    DistributionActivity.countDocuments(filter)
  ]);

  const formattedRecords = records.map(r => {
    let meta = {};
    if (r.recipient?.metadata) {
      meta = r.recipient.metadata instanceof Map
        ? Object.fromEntries(r.recipient.metadata)
        : r.recipient.metadata;
    }
    return {
      _id: r._id,
      recordId: r.recordId,
      campaign: r.campaignId ? {
        _id: r.campaignId._id,
        name: r.campaignId.name,
        itemName: r.campaignId.itemName
      } : null,
      recipient: {
        name: r.recipient?.name || 'Anonymous',
        metadata: meta
      },
      item: r.item,
      quantity: r.quantity || 1,
      operator: r.operator,
      status: r.status,
      distributedAt: r.distributedAt,
      reversal: r.reversal,
      notes: r.notes
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
 * Inspect an Individual Recipient's Complete Distribution History
 */
const getRecipientDistributionHistory = async (organizationId, queryParams = {}) => {
  const { search, recipientName, contributionId } = queryParams;

  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId.toString())
  };

  if (contributionId && mongoose.Types.ObjectId.isValid(contributionId)) {
    filter['recipient.contributionId'] = new mongoose.Types.ObjectId(contributionId.toString());
  } else if (recipientName && recipientName.trim().length > 0) {
    filter['recipient.name'] = recipientName.trim();
  } else if (search && search.trim().length > 0) {
    const escaped = escapeRegex(search.trim());
    filter['recipient.name'] = { $regex: escaped, $options: 'i' };
  } else {
    return { recipient: null, history: [] };
  }

  const activities = await DistributionActivity.find(filter)
    .sort({ distributedAt: -1 })
    .populate('campaignId', 'name itemName')
    .lean();

  if (activities.length === 0) {
    return { recipient: null, history: [] };
  }

  const first = activities[0];
  let meta = {};
  if (first.recipient?.metadata) {
    meta = first.recipient.metadata instanceof Map
      ? Object.fromEntries(first.recipient.metadata)
      : first.recipient.metadata;
  }

  const history = activities.map(r => ({
    _id: r._id,
    recordId: r.recordId,
    campaignName: r.campaignId?.name || 'Campaign',
    item: r.item,
    quantity: r.quantity || 1,
    status: r.status,
    distributedAt: r.distributedAt,
    operator: r.operator,
    reversal: r.reversal,
    notes: r.notes
  }));

  return {
    recipient: {
      name: first.recipient?.name,
      metadata: meta,
      contributionId: first.recipient?.contributionId
    },
    history
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
  exportCampaignExcel,
  getDistributionSummary,
  getDistributionByOperator,
  getOperatorDistributionHistory,
  getDistributionActivity,
  getRecipientDistributionHistory
};
