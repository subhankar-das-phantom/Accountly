const router = require('express').Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Get user data
router.get('/me', auth, authController.getMe);

// Update user currency preferences
router.put('/me/currency', auth, authController.updateCurrency);

// Update user theme preferences
router.put('/me/theme', auth, authController.updateTheme);

// Update user profile
router.put('/me', auth, authController.updateProfile);

// Change password
router.put('/me/password', auth, authController.updatePassword);

// Delete account
router.delete('/me', auth, authController.deleteAccount);

module.exports = router;
