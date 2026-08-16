const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const organizationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  currency: {
    code: { type: String, default: 'INR' },
    locale: { type: String, default: 'en-IN' }
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  settings: {
    publicAccess: { type: Boolean, default: false },
    publicContributorNames: { 
      type: String, 
      enum: ['full', 'anonymized', 'anonymous'], 
      default: 'anonymized' 
    }
  },
  contributorFields: [{
    key: { type: String, match: /^[a-zA-Z][a-zA-Z0-9_]*$/ },
    label: { type: String, maxlength: 50 },
    type: { type: String, enum: ['text', 'select', 'number'] },
    required: { type: Boolean, default: false },
    publicVisibility: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
    options: [{ type: String, maxlength: 100 }], // for 'select' type
    order: { type: Number, default: 0 }
  }]
}, {
  timestamps: true
});

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
