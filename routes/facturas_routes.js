const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('multer')({ dest: 'uploads/' });

router.post('/facturas', upload.single('factura'),authMiddleware, facturasController.procesarOcr);
router.post('/facturas/guardar', authMiddleware, facturasController.confirmarYGuardar);
router.post('/facturas/:id/retencion',authMiddleware, facturasController.addRetencionAFactura);
router.get('/facturas', authMiddleware, facturasController.getFacturasByFechaEmision);


module.exports = router;