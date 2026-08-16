
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let User = require('../models/user.model');

// Register
router.post('/register', async (req, res) => {
  try { 
    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    const savedUser = await newUser.save();
    console.log('User saved:', savedUser);

    // Create and assign token
    const token = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET);
    res.json({
      token,
      user: {
        id: savedUser._id,
        username: savedUser.username,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ $or: [{ email }, { username: email }] });
    console.log('User found:', user);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create and assign token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    console.log('Token generated:', token);
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

const auth = require('../middleware/auth');

// Get user data
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user currency preferences
router.put('/me/currency', auth, async (req, res) => {
  try {
    const { code, locale } = req.body;
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.currency = { code, locale };
    await user.save();
    res.json(user.currency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user theme preferences
router.put('/me/theme', auth, async (req, res) => {
  try {
    const { color, mode } = req.body;
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (color) user.theme.color = color;
    if (mode) user.theme.mode = mode;
    
    await user.save();
    res.json(user.theme);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/me', auth, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (username) user.username = username;
    if (email) user.email = email;

    await user.save();
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      currency: user.currency,
      theme: user.theme
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.put('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid current password' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete account
const Transaction = require('../models/transaction.model');
const BudgetGoal = require('../models/budgetGoal.model');

router.delete('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Delete all user data
    await Transaction.deleteMany({ user: user._id });
    await BudgetGoal.deleteMany({ user: user._id });
    await User.findByIdAndDelete(req.user);

    res.json({ msg: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
