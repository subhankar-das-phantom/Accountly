const requireActive = (req, res, next) => {
  if (req.organization && req.organization.status === 'ARCHIVED') {
    const error = new Error('This organization is archived and is currently read-only.');
    error.status = 403;
    return next(error);
  }
  next();
};

module.exports = requireActive;
