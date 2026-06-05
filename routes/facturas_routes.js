const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('multer')({ dest: 'uploads/' });
// Ruta para crear una factura (con autenticación y manejo de archivos)
// Use 'factura' as the multipart field name to match the front-end form
router.post('/facturas', upload.single('factura'), facturasController.createFactura);

module.exports = router;