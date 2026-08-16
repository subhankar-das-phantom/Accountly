const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(403).json({ error: 'Organization membership is required for this action.' });
      }

      if (req.membership.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Active organization membership is required.' });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.membership.role)) {
        return res.status(403).json({ 
          error: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.` 
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = requireRole;
