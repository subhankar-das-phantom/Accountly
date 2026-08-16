const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ msg: err.message });
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ msg: err.message });
    }
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getUserProfile(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const updateCurrency = async (req, res, next) => {
  try {
    const result = await authService.updateCurrency(req.user, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ msg: err.message });
    }
    next(err);
  }
};

const updateTheme = async (req, res, next) => {
  try {
    const result = await authService.updateTheme(req.user, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ msg: err.message });
    }
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const result = await authService.updateProfile(req.user, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ msg: err.message });
    }
    next(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const result = await authService.updatePassword(req.user, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ msg: err.message });
    }
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const result = await authService.deleteAccount(req.user);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ msg: err.message });
    }
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateCurrency,
  updateTheme,
  updateProfile,
  updatePassword,
  deleteAccount
};
