const facturaModel = require('../models/factura_model');
const historialModel = require('../models/historial_model');
const proveedoresModel = require('../models/proveedores_model');
const categoriasModel = require('../models/categorias_model');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { extraerDatosFactura } = require('../services/ocrService');

// Configuración básica de multer para guardar temporalmente la imagen
const upload = multer({ dest: 'uploads/' });

const facturasController = {
    async createFactura(req, res) {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Por favor, sube una imagen de factura' });
        }

        const datosExtraidos = await extraerDatosFactura(req.file.path);

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
          numero_control: datosExtraidos.numero_control || datosExtraidos.nroFactura || 'N/A',
          monto_total: datosExtraidos.montoTotal || 0.00,
          categoria: categoriaId,
          img_url: req.file.path
        };

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




};

module.exports = facturasController;