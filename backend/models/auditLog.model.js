const mongoose = require('mongoose');

const ActionEnum = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'PUBLIC_SETTINGS_UPDATE',
  'CONTRIBUTOR_FIELD_CREATE',
  'CONTRIBUTOR_FIELD_UPDATE',
  'CONTRIBUTOR_FIELD_DELETE',
  'MEMBER_ADDED',
  'MEMBER_ROLE_UPDATED',
  'MEMBER_REMOVED',
  'DISTRIBUTION_CAMPAIGN_CREATE',
  'DISTRIBUTION_CAMPAIGN_UPDATE',
  'DISTRIBUTION_CAMPAIGN_DELETE',
  'DISTRIBUTION_MARKED',
  'DISTRIBUTION_UNDO'
];

const EntityTypeEnum = [
  'FinancialRecord',
  'Organization',
  'ContributorField',
  'Budget',
  'OrganizationMember',
  'DistributionCampaign',
  'DistributionRecord'
];

const auditLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ActionEnum,
    required: true
  },
  entityType: {
    type: String,
    enum: EntityTypeEnum,
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  previousData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

// Indexes based on query patterns
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
