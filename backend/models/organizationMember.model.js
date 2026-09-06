const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const organizationMemberSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['OWNER', 'ADMIN', 'DISTRIBUTION_OPERATOR'],
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    required: true
  },
  removedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Partial Compound Index to ensure a user has only one ACTIVE membership per organization
organizationMemberSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

const OrganizationMember = mongoose.model('OrganizationMember', organizationMemberSchema);

module.exports = OrganizationMember;
