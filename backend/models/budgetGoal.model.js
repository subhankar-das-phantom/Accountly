const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const budgetGoalSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    minlength: 1
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  month: {
    type: Number,
    required: true,
    min: 0,
    max: 11 // 0 for January, 11 for December
  },
  year: {
    type: Number,
    required: true,
    min: 2000 // Assuming budgets won't be set before 2000
  }
}, {
  timestamps: true,
});


budgetGoalSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

const BudgetGoal = mongoose.model('BudgetGoal', budgetGoalSchema);

module.exports = BudgetGoal;
