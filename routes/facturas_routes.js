const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('multer')({ dest: 'uploads/' });

router.post('/facturas', upload.single('factura'), facturasController.createFactura);
router.post('/facturas/:id/retencion', facturasController.addRetencionAFactura);

module.exports = router;