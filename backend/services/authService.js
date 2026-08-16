const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const BudgetGoal = require('../models/budgetGoal.model');

const registerUser = async ({ username, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('User already exists');
    error.status = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    username,
    email,
    password: hashedPassword,
  });

  const savedUser = await newUser.save();
  const token = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET);

  return {
    token,
    user: {
      id: savedUser._id,
      username: savedUser.username,
    },
  };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ $or: [{ email }, { username: email }] });
  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 400;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.status = 400;
    throw error;
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  return {
    token,
    user: {
      id: user._id,
      username: user.username,
    },
  };
};

const getUserProfile = async (userId) => {
  return await User.findById(userId).select('-password');
};

const updateCurrency = async (userId, { code, locale }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  user.currency = { code, locale };
  await user.save();
  return user.currency;
};

const updateTheme = async (userId, { color, mode }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (color) user.theme.color = color;
  if (mode) user.theme.mode = mode;
  
  await user.save();
  return user.theme;
};

const updateProfile = async (userId, { username, email }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (username) user.username = username;
  if (email) user.email = email;

  await user.save();
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    currency: user.currency,
    theme: user.theme
  };
};

const updatePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    const error = new Error('Invalid current password');
    error.status = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  return { msg: 'Password updated successfully' };
};

const deleteAccount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  // Delete all user data
  await Transaction.deleteMany({ user: userId });
  await BudgetGoal.deleteMany({ user: userId });
  await User.findByIdAndDelete(userId);

  return { msg: 'Account deleted successfully' };
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateCurrency,
  updateTheme,
  updateProfile,
  updatePassword,
  deleteAccount
};
