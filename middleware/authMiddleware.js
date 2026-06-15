const authMiddleware = (req, res, next) => {
  // Accept either a stored `user` object or a `userId` property
  if (!req.session || (!req.session.user && !req.session.userId)) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  next();
};

module.exports = authMiddleware;