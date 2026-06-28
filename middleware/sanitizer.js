const sanitizeHtml = require('sanitize-html');

const limpiarInputs = (req, bodyOrQuery) => {
  const target = req[bodyOrQuery];
  for (let key in target) {
    if (typeof target[key] === 'string') {
      target[key] = sanitizeHtml(target[key], {
        allowedTags: [], 
        allowedAttributes: {} 
      });
    }
  }
};

const sanitizarPeticion = (req, res, next) => {
  if (req.body) limpiarInputs(req, 'body');
  if (req.query) limpiarInputs(req, 'query');
  next();
};

module.exports = {
  sanitizarPeticion
};