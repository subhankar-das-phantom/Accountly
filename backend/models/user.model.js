
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  currency: {
    code: { type: String, default: 'INR' },
    locale: { type: String, default: 'en-IN' }
  },
  theme: {
    color: { type: String, default: 'default' },
    mode: { type: String, default: 'light' }
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

module.exports = User;
