
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const transactionSchema = new Schema({

  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  type: {
    type: String,
    enum: ['contribution', 'expense'],
    required: true
  },
  contributor: {
    name: { type: String, trim: true },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} }
  },
  recipient: {
    name: { type: String, trim: true }
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'cancelled'],
    default: 'received'
  },
  category: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
  },
}, {
  timestamps: true,
});

transactionSchema.index({ organizationId: 1, date: -1 });
transactionSchema.index({ organizationId: 1, type: 1 });
transactionSchema.index({ organizationId: 1, category: 1 });
transactionSchema.index({ description: 'text', category: 'text' });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
