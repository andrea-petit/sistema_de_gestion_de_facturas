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
        // Normalizamos montos admitiendo tanto strings con separadores ("2.961,45") como números
        function parseMonetary(value) {
          if (value === undefined || value === null) return 0.00;
          if (typeof value === 'number') return Number(Number(value).toFixed(2));
          let v = String(value).trim();
          if (!v) return 0.00;
          v = v.replace(/[^\d.,-]/g, '');
          if (v.includes(',') && v.includes('.')) {
            v = v.replace(/\./g, '').replace(',', '.');
          } else if (v.includes(',')) {
            const parts = v.split(',');
            if (parts[parts.length - 1].length === 2) {
              v = v.replace(',', '.');
            } else {
              v = v.replace(/,/g, '');
            }
          }
          const parsed = parseFloat(v);
          return Number.isNaN(parsed) ? 0.00 : Number(parsed.toFixed(2));
        }

        const monto_total_norm = parseMonetary(montoTotal || req.body.montoTotal);
        const monto_exento_norm = parseMonetary(req.body.montoExento);
        const monto_afecto_norm = parseMonetary(req.body.montoAfectoIva);
        const monto_iva_norm = parseMonetary(req.body.montoIva);
        const porcentaje_alicuota_norm = Number.isFinite(Number(req.body.porcentaje_alicuota)) ? Number(req.body.porcentaje_alicuota) : 0.00;
        const porcentaje_retencion_norm = Number.isFinite(Number(req.body.porcentaje_retencion)) ? Number(req.body.porcentaje_retencion) : 0.00;

        const facturaData = {
          proveedor_id: proveedorDb.id,
          fecha_emision: fechaEmision,
          numero_factura: nroFactura,
          numero_control: nroControl || nroFactura,
          monto_total: monto_total_norm,
          monto_exento: monto_exento_norm,
          monto_afecto_iva: monto_afecto_norm,
          monto_iva: monto_iva_norm,
          porcentaje_alicuota: porcentaje_alicuota_norm,
          categoria: categoriaId,
          porcentaje_retencion: porcentaje_retencion_norm,
          comprobante_retencion: req.body.comprobante_retencion || null,
          img_url: img_url
        };

        // Log de diagnóstico para identificar inconsistencias como las que reportaste
        console.log('[facturasController] Payload normalizado recibido:', {
          monto_total: facturaData.monto_total,
          monto_exento: facturaData.monto_exento,
          monto_afecto_iva: facturaData.monto_afecto_iva,
          monto_iva: facturaData.monto_iva,
          porcentaje_alicuota: facturaData.porcentaje_alicuota,
          porcentaje_retencion: facturaData.porcentaje_retencion
        });

        // Recalcular impuestos en backend para asegurar consistencia
        const impuestoCalc = facturaModel.calculateImpuestos(facturaData);
        console.log('[facturasController] Impuestos calculados en backend:', impuestoCalc);

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

        try {
          const usuarioId = req.user && req.user.id ? req.user.id : null;
          await historialModel.addHistorial({
            usuario_id: usuarioId,
            tabla_afectada: 'compra_impuestos',
            registro_id: nuevaRetencion?.id || null,
            accion: 'CREATE',
            valor_anterior: null,
            valor_nuevo: JSON.stringify(nuevaRetencion)
          });
        } catch (histError) {
          console.error('Error guardando historial de retención:', histError);
        }

        return res.status(200).json({
          mensaje: 'Retención generada con éxito',
          data: nuevaRetencion
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async editarFactura(req, res) {
      try {
        const facturaId = req.params.id;
        const facturaExistente = await facturaModel.getFacturaById(facturaId);

        if (!facturaExistente) {
          return res.status(404).json({ error: 'Factura no encontrada.' });
        }

        const {
          proveedor,
          direccion,
          rifEmisor,
          nroFactura,
          nroControl,
          fechaEmision,
          montoTotal,
          categoria,
          img_url
        } = req.body;

        const updateData = {};

        if (proveedor || rifEmisor) {
          if (!proveedor || !rifEmisor) {
            return res.status(400).json({ error: 'Proveedor y RIF son obligatorios para actualizar el proveedor.' });
          }

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

          updateData.proveedor_id = proveedorDb.id;
        }

        if (categoria) {
          updateData.categoria = await categoriasModel.getOrCreateCategoryId(categoria);
        }

        if (fechaEmision) updateData.fecha_emision = fechaEmision;
        if (nroFactura) updateData.numero_factura = nroFactura;
        if (nroControl) updateData.numero_control = nroControl;
        if (montoTotal !== undefined && montoTotal !== null) updateData.monto_total = Number(montoTotal);
        if (img_url) updateData.img_url = img_url;
        if (req.body.montoExento !== undefined) updateData.monto_exento = Number(req.body.montoExento);
        if (req.body.montoAfectoIva !== undefined) updateData.monto_afecto_iva = Number(req.body.montoAfectoIva);
        if (req.body.montoIva !== undefined) updateData.monto_iva = Number(req.body.montoIva);

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No se envió ningún campo para actualizar.' });
        }

        const facturaActualizada = await facturaModel.updateFacturaById(facturaId, updateData);

        const valorAnterior = {};
        const valorNuevo = {};
        Object.keys(updateData).forEach((campo) => {
          valorAnterior[campo] = facturaExistente[campo];
          valorNuevo[campo] = facturaActualizada[campo];
        });

        try {
          const usuarioId = req.user && req.user.id ? req.user.id : null;
          await historialModel.addHistorial({
            usuario_id: usuarioId,
            tabla_afectada: 'facturas',
            registro_id: facturaId,
            accion: 'UPDATE',
            valor_anterior: JSON.stringify(valorAnterior),
            valor_nuevo: JSON.stringify(valorNuevo)
          });
        } catch (histError) {
          console.error('Error guardando historial de edición de factura:', histError);
        }

        return res.status(200).json({
          mensaje: 'Factura actualizada con éxito.',
          data: facturaActualizada
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    // Agregar este método dentro del objeto facturasController de tu controlador de Express
    async getFacturasByFechaEmision(req, res) {
      try {
        const { fecha } = req.query;
        console.log("-----------------------------------------");
        console.log("-> FECHA ENVIADA DESDE EL FRONTEND:", fecha); 
        console.log("-> TIPO DE DATO:", typeof fecha);
        console.log("-----------------------------------------");

        if (!fecha) {
          return res.status(400).json({ error: 'El parámetro fecha es requerido para realizar la consulta fiscal.' });
        }

        console.log(`[SGAF] Consultando facturas del Libro de Compras para la fecha: ${fecha}`);

        const facturas = await facturaModel.getFacturasByFechaEmision(fecha);
        console.log("-> REGISTROS ENCONTRADOS EN BD:", facturas.length);

        return res.status(200).json({
          mensaje: `Facturas recuperadas con éxito para el día ${fecha}`,
          data: facturas
        });

      } catch (error) {
        console.error('Error en consulta por fecha de emisión:', error);
        return res.status(500).json({ error: error.message });
      }
    },

};

module.exports = facturasController;