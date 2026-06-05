const session = require('express-session');

const authMiddleware = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  next();
};

module.exports = authMiddleware;