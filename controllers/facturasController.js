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
    async createFactura(req, res) {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Por favor, sube una imagen de factura' });
        }

        const datosExtraidos = await extraerDatosFactura(req.file.path);

        if (!cloudName || !cloudApiKey || !cloudApiSecret) {
          return res.status(500).json({ error: 'Cloudinary no está configurado correctamente en .env' });
        }

        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'facturas',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false
        });

        await unlinkAsync(req.file.path).catch(() => {});

        const proveedorNombre = datosExtraidos.proveedor || 'Proveedor desconocido';
        let proveedor = await proveedoresModel.getProveedorByNameOrRif(proveedorNombre, datosExtraidos.rifEmisor);

        if (!proveedor) {
          const tipo_documento = datosExtraidos.rifEmisor ? datosExtraidos.rifEmisor[0].toUpperCase() : 'J';
          proveedor = await proveedoresModel.createProveedor({
            tipo_documento,
            rif: datosExtraidos.rifEmisor || 'S/RIF',
            razon_social: proveedorNombre,
            direccion: datosExtraidos.direccionProveedor || null,
            telefono: null,
            tipo_contribuyente: 'Ordinario'
          });
        }

        const categoriaId = datosExtraidos.categoria || await categoriasModel.getOrCreateCategoryId('Sin categoría');
        const facturaData = {
          proveedor_id: proveedor.id,
          fecha_emision: datosExtraidos.fechaEmision,
          numero_factura: datosExtraidos.nroFactura || 'N/A',
          numero_control: datosExtraidos.nroControl || datosExtraidos.nroFactura || 'N/A',
          monto_total: datosExtraidos.montoTotal || 0.00,
          monto_exento: datosExtraidos.montoExento || 0.00,
          monto_afecto_iva: datosExtraidos.montoAfectoIva || 0.00,
          monto_iva: datosExtraidos.montoIva || 0.00,
          categoria: categoriaId,
          porcentaje_retencion: req.body.porcentaje_retencion || 0.00,
          comprobante_retencion: req.body.comprobante_retencion || null,
          img_url: uploadResult.secure_url
        };

        const facturaExistente = await facturaModel.getFacturaByProveedorAndNumero(facturaData.proveedor_id, facturaData.numero_factura);
        if (facturaExistente) {
          return res.status(409).json({ error: 'Ya existe una factura con ese número para este proveedor' });
        }

        const nuevaFactura = await facturaModel.createFactura(facturaData);

        // Add historial entry only if user info and historialModel are available
        try {
          const usuarioId = req.user && req.user.id ? req.user.id : null;
          await historialModel.addHistorial({
            usuario_id: usuarioId,
            tabla_afectada: 'facturas',
            registro_id: nuevaFactura && nuevaFactura.id ? nuevaFactura.id : null,
            accion: 'CREATE',
            valor_anterior: null,
            valor_nuevo: JSON.stringify(facturaData)
          });
        } catch (histError) {
          console.error('Error guardando historial:', histError);
        }

        return res.status(200).json({
          mensaje: "Factura procesada y guardada con éxito",
          data: datosExtraidos
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




};

module.exports = facturasController;