const express = require('express');
const os = require('os');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const authMiddleware = require('../middleware/authMiddleware');
const { sanitizarPeticion } = require('../middleware/sanitizer');
const upload = require('multer')({ dest: os.tmpdir() });


router.post('/facturas', upload.single('factura'), authMiddleware, facturasController.procesarOcr);
router.post('/facturas/guardar', authMiddleware, sanitizarPeticion, facturasController.confirmarYGuardar);
router.get('/facturas/buscar/coincidencia', facturasController.buscarFacturaPorTexto);
router.put('/facturas/:id', authMiddleware, sanitizarPeticion, facturasController.editarFactura);
router.post('/facturas/:id/retencion', authMiddleware, sanitizarPeticion, facturasController.addRetencionAFactura);
router.get('/facturas', authMiddleware, facturasController.getFacturasByFechaEmision);
router.get("/facturas/comprobante/:id", facturasController.renderComprobante);
router.get("/facturas/reporte-libro", facturasController.renderLibroCompras);
router.get('/facturas/reporte-retenciones', facturasController.renderRelacionRetenciones);
router.get('/facturas/comprobantes/:id/render', facturasController.renderComprobanteIndividual);


module.exports = router;