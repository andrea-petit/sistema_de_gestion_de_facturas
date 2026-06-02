const express = require('express');
const router = express.Router();
const multer = require('multer');
const { extraerDatosFactura } = require('./ocrService');

// Configuración básica de multer para guardar temporalmente la imagen
const upload = multer({ dest: 'uploads/' });

router.post('/procesar-factura', upload.single('factura'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Por favor, sube una imagen de factura' });
    }

    // Llamamos al servicio pasando la ruta del archivo temporal
    const datosExtraidos = await extraerDatosFactura(req.file.path);

    // Aquí ya tendrías los datos listos para:
    // 1. Enviarlos al frontend para que el usuario los valide/corrija.
    // 2. O guardarlos directamente en Supabase mediante tu cliente de PostgreSQL.

    return res.status(200).json({
      mensaje: "Factura procesada con éxito",
      data: datosExtraidos
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;