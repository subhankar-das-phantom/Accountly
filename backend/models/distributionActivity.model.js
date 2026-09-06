const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * DistributionActivity
 * Non-destructive historical & accountability projection for distributions.
 * Authoritative current state resides in DistributionRecord.
 * Historical distribution events must never be deleted; on undo, status transitions to REVERSED
 * while the original distribution timestamp, operator, recipient, item, and quantity remain permanently immutable.
 */
const distributionActivitySchema = new Schema({
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
  recordId: {
    type: Schema.Types.ObjectId,
    ref: 'DistributionRecord',
    required: true,
    index: true
  },
  contributionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  recipient: {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },
    contributionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    }
  },
  item: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  operator: {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['DISTRIBUTED', 'REVERSED'],
    default: 'DISTRIBUTED',
    index: true
  },
  action: {
    type: String,
    enum: ['DISTRIBUTED', 'REVERSED'],
    default: 'DISTRIBUTED'
  },
  distributedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  reversal: {
    reversedAt: {
      type: Date,
      default: null
    },
    reversedBy: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      username: {
        type: String,
        default: null
      }
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for high-speed accountability queries and operator aggregation
distributionActivitySchema.index({ organizationId: 1, distributedAt: -1 });
distributionActivitySchema.index({ organizationId: 1, campaignId: 1, distributedAt: -1 });
distributionActivitySchema.index({ organizationId: 1, 'operator._id': 1, distributedAt: -1 });
distributionActivitySchema.index({ organizationId: 1, 'recipient.name': 1 });
distributionActivitySchema.index({ organizationId: 1, status: 1 });
distributionActivitySchema.index({ recordId: 1, status: 1 });

const DistributionActivity = mongoose.model('DistributionActivity', distributionActivitySchema);

module.exports = DistributionActivity;
