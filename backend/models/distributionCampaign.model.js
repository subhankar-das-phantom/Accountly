const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const distributionCampaignSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  itemName: {
    type: String,
    required: true,
    trim: true // e.g., 'Tiffin Packet', 'Gift Kit', 'Certificate', 'Prasad'
  },
  eligibility: {
    contributionRequired: {
      type: Boolean,
      default: true
    },
    minAmount: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      default: null // null means all contribution categories qualify
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

distributionCampaignSchema.index({ organizationId: 1, status: 1 });
distributionCampaignSchema.index({ organizationId: 1, createdAt: -1 });

const DistributionCampaign = mongoose.model('DistributionCampaign', distributionCampaignSchema);

module.exports = DistributionCampaign;
