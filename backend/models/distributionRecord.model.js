const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const distributionRecordSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'DistributionCampaign',
    required: true,
    index: true
  },
  contributionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true
  },
  contributor: {
    name: { 
      type: String, 
      trim: true 
    },
    metadata: { 
      type: Map, 
      of: Schema.Types.Mixed, 
      default: {} 
    }
  },
  status: {
    type: String,
    enum: ['PENDING', 'DISTRIBUTED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  distributedAt: {
    type: Date,
    default: null
  },
  distributedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure a single contribution cannot create duplicate entitlements in the same campaign
distributionRecordSchema.index({ campaignId: 1, contributionId: 1 }, { unique: true });

// Efficient lookups for campaign-level counter views and status filtering
distributionRecordSchema.index({ organizationId: 1, campaignId: 1, status: 1 });
distributionRecordSchema.index({ organizationId: 1, campaignId: 1, 'contributor.name': 1 });
distributionRecordSchema.index({ organizationId: 1, campaignId: 1, 'contributor.name': 1, status: 1 });

const DistributionRecord = mongoose.model('DistributionRecord', distributionRecordSchema);

module.exports = DistributionRecord;
