const authMiddleware = (req, res, next) => {
  if (!req.session || (!req.session.user && !req.session.userId)) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }

  // Propagar el usuario autenticado a los controladores
  if (req.session.user) {
    req.user = req.session.user;
  } else if (req.session.userId) {
    req.user = {
      id: req.session.userId,
      nombre: req.session.userNombre || null
    };
  }

  next();
};

module.exports = authMiddleware;