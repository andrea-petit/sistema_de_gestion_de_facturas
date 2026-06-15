require('dotenv').config();
const facturaModel = require('../models/factura_model');
const historialModel = require('../models/historial_model');
const proveedoresModel = require('../models/proveedores_model');
const categoriasModel = require('../models/categorias_model');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const util = require('util');
const cloudinary = require('cloudinary').v2;
const { extraerDatosFactura } = require('../services/ocrService');

const unlinkAsync = util.promisify(fs.unlink);

const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.Cloud_Name || '').trim();
const cloudApiKey = (process.env.CLOUDINARY_API_KEY || process.env.API_Key || '').trim();
const cloudApiSecret = (process.env.CLOUDINARY_API_SECRET || process.env.API_Secret || '').trim();
cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudApiKey,
  api_secret: cloudApiSecret
});

// Configuración básica de multer para guardar temporalmente la imagen
const upload = multer({ dest: 'uploads/' });

const facturasController = {
    
    // =================================================================
    // PASO 1: RECIBIR IMAGEN Y EXTRAER DATOS CON IA (No persiste en BD)
    // =================================================================
    async procesarOcr(req, res) {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Por favor, sube una imagen de factura' });
        }

        // 1. Ejecutar servicio OCR con LlamaCloud
        const datosExtraidos = await extraerDatosFactura(req.file.path);

        // 2. Validar credenciales de Cloudinary
        if (!cloudName || !cloudApiKey || !cloudApiSecret) {
          return res.status(500).json({ error: 'Cloudinary no está configurado correctamente en .env' });
        }

        // 3. Subir imagen de respaldo a Cloudinary
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'facturas',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false
        });

        // 4. Eliminar archivo temporal local
        await unlinkAsync(req.file.path).catch(() => {});

        // 5. Adjuntar la URL de la imagen a los datos extraídos para que el cliente la tenga
        datosExtraidos.img_url = uploadResult.secure_url;

        // Devolvemos el resultado al frontend para que lo pinte en los inputs editables
        return res.status(200).json({
          mensaje: "Análisis OCR completado. Requiere verificación del usuario.",
          data: datosExtraidos
        });

      } catch (error) {
        // Limpieza de emergencia del archivo temporal si ocurre un fallo intermedio
        if (req.file && req.file.path) {
          await unlinkAsync(req.file.path).catch(() => {});
        }
        return res.status(500).json({ error: error.message });
      }
    },

    // =================================================================
    // PASO 2: CONFIRMACIÓN HUMANA Y GUARDADO DEFINITIVO EN BD
    // =================================================================
    async confirmarYGuardar(req, res) {
      try {
        // Los datos ya no vienen del OCR, vienen limpios desde los inputs del req.body
        const {
          proveedor,
          direccion,
          rifEmisor,
          nroFactura,
          nroControl,
          fechaEmision,
          montoTotal,
          categoria,
          img_url // Recuperamos la URL que guardamos en el paso 1
        } = req.body;

        if (!proveedor || !rifEmisor || !nroFactura) {
          return res.status(400).json({ error: 'Proveedor, RIF y Número de Factura son obligatorios para el Libro de Compras.' });
        }

        // 1. Gestión Automática de Proveedores
        let proveedorDb = await proveedoresModel.getProveedorByNameOrRif(proveedor, rifEmisor);

        if (!proveedorDb) {
          const tipo_documento = rifEmisor ? rifEmisor[0].toUpperCase() : 'J';
          proveedorDb = await proveedoresModel.createProveedor({
            tipo_documento,
            rif: rifEmisor,
            razon_social: proveedor,
            direccion: direccion || null,
            telefono: null,
            tipo_contribuyente: 'Ordinario'
          });
        }

        // 2. Gestión de Categoría con el NLP Manager
        const categoriaId = await categoriasModel.getOrCreateCategoryId(categoria || 'Sin categoría');

        // 3. Preparación del objeto estructurado para la base de datos
        // Nota: El desglose exacto de IVA se calcula en el servicio de OCR o puedes recalcularlo aquí
        const facturaData = {
          proveedor_id: proveedorDb.id,
          fecha_emision: fechaEmision,
          numero_factura: nroFactura,
          numero_control: nroControl || nroFactura,
          monto_total: montoTotal || 0.00,
          monto_exento: req.body.montoExento || 0.00, 
          monto_afecto_iva: req.body.montoAfectoIva || 0.00,
          monto_iva: req.body.montoIva || 0.00,
          categoria: categoriaId,
          porcentaje_retencion: req.body.porcentaje_retencion || 0.00,
          comprobante_retencion: req.body.comprobante_retencion || null,
          img_url: img_url
        };

        // 4. Protección contra duplicados en el Libro de Compras
        const facturaExistente = await facturaModel.getFacturaByProveedorAndNumero(facturaData.proveedor_id, facturaData.numero_factura);
        if (facturaExistente) {
          return res.status(409).json({ error: 'Ya existe esta factura registrada para el proveedor indicado.' });
        }

        // 5. Inserción final
        const nuevaFactura = await facturaModel.createFactura(facturaData);

        // 6. Registro de Auditoría en el Historial
        try {
          const usuarioId = req.user && req.user.id ? req.user.id : null;
          await historialModel.addHistorial({
            usuario_id: usuarioId,
            tabla_afectada: 'facturas',
            registro_id: nuevaFactura?.id || null,
            accion: 'CREATE',
            valor_anterior: null,
            valor_nuevo: JSON.stringify(facturaData)
          });
        } catch (histError) {
          console.error('Error guardando historial:', histError);
        }

        return res.status(200).json({
          mensaje: "Factura verificada e insertada en el Libro de Compras con éxito",
          id: nuevaFactura?.id
        });

      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async addRetencionAFactura(req, res) {
      try {
        const facturaId = req.params.id;
        const porcentajeRetencion = Number(req.body.porcentaje_retencion);

        if (!Number.isFinite(porcentajeRetencion) || porcentajeRetencion < 1 || porcentajeRetencion > 5) {
          return res.status(400).json({ error: 'El porcentaje de retención debe ser un número entre 1 y 5' });
        }

        const nuevaRetencion = await facturaModel.createRetencionFromFactura(facturaId, porcentajeRetencion);

        return res.status(200).json({
          mensaje: 'Retención generada con éxito',
          data: nuevaRetencion
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async getFacturasByFechaEmision(req, res) {
      try {
        const fechaEmision = req.query.fecha_emision;
        if (!fechaEmision) {
          return res.status(400).json({ error: 'La fecha de emisión es requerida' });
        }

        const facturas = await facturaModel.getFacturasByFechaEmision(fechaEmision);

        return res.status(200).json({
          mensaje: 'Facturas encontradas',
          data: facturas
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

};

module.exports = facturasController;