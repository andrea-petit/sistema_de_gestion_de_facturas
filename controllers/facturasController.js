require("dotenv").config();
const facturaModel = require("../models/factura_model");
const historialModel = require("../models/historial_model");
const proveedoresModel = require("../models/proveedores_model");
const categoriasModel = require("../models/categorias_model");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const util = require("util");
const cloudinary = require("cloudinary").v2;
const { extraerDatosFactura } = require("../services/ocrService");
const path = require("path");

const unlinkAsync = util.promisify(fs.unlink);

const cloudName = (
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.Cloud_Name ||
  ""
).trim();
const cloudApiKey = (
  process.env.CLOUDINARY_API_KEY ||
  process.env.API_Key ||
  ""
).trim();
const cloudApiSecret = (
  process.env.CLOUDINARY_API_SECRET ||
  process.env.API_Secret ||
  ""
).trim();
cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudApiKey,
  api_secret: cloudApiSecret,
});

// Configuración básica de multer para guardar temporalmente la imagen
const upload = multer({ dest: "uploads/" });

const facturasController = {
  // =================================================================
  // PASO 1: RECIBIR IMAGEN Y EXTRAER DATOS CON IA (No persiste en BD)
  // =================================================================
  async procesarOcr(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "Por favor, sube una imagen de factura" });
      }

      // 1. Ejecutar servicio OCR con LlamaCloud
      const datosExtraidos = await extraerDatosFactura(req.file.path);

      // 2. Validar credenciales de Cloudinary
      if (!cloudName || !cloudApiKey || !cloudApiSecret) {
        return res.status(500).json({
          error: "Cloudinary no está configurado correctamente en .env",
        });
      }

      // 3. Subir imagen de respaldo a Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "facturas",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      });

      // 4. Eliminar archivo temporal local
      await unlinkAsync(req.file.path).catch(() => {});

      // 5. Adjuntar la URL de la imagen a los datos extraídos para que el cliente la tenga
      datosExtraidos.img_url = uploadResult.secure_url;

      // Devolvemos el resultado al frontend para que lo pinte en los inputs editables
      return res.status(200).json({
        mensaje: "Análisis OCR completado. Requiere verificación del usuario.",
        data: datosExtraidos,
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
      // 1. Desestructuración de los inputs limpios enviados por el frontend desde los inputs editables
      const {
        proveedor,
        direccion,
        rifEmisor,
        nroFactura,
        nroControl,
        fechaEmision,
        montoTotal,
        categoria,
        img_url,
        porcentaje_alicuota,
        montoExento,
        montoAfectoIva,
        montoIva,
        porcentaje_retencion,
      } = req.body;

      // Validaciones obligatorias de negocio a nivel de transporte/petición
      if (!proveedor || !rifEmisor || !nroFactura) {
        return res.status(400).json({
          error:
            "Proveedor, RIF y Número de Factura son obligatorios para el Libro de Compras.",
        });
      }

      // 2. Normalización Monetaria de los strings/números provenientes del cliente
      function parseMonetary(value) {
        if (value === undefined || value === null) return 0.0;
        if (typeof value === "number") return Number(Number(value).toFixed(2));
        let v = String(value).trim();
        if (!v) return 0.0;
        v = v.replace(/[^\d.,-]/g, "");
        if (v.includes(",") && v.includes(".")) {
          v = v.replace(/\./g, "").replace(",", ".");
        } else if (v.includes(",")) {
          const parts = v.split(",");
          if (parts[parts.length - 1].length === 2) {
            v = v.replace(",", ".");
          } else {
            v = v.replace(/,/g, "");
          }
        }
        const parsed = parseFloat(v);
        return Number.isNaN(parsed) ? 0.0 : Number(parsed.toFixed(2));
      }

      const monto_total_norm = parseMonetary(montoTotal);
      const monto_exento_norm = parseMonetary(montoExento);
      const monto_afecto_norm = parseMonetary(montoAfectoIva);
      const monto_iva_norm = parseMonetary(montoIva);
      const porcentaje_alicuota_norm = Number.isFinite(
        Number(porcentaje_alicuota),
      )
        ? Number(porcentaje_alicuota)
        : 16.0;
      const porcentaje_retencion_norm = Number.isFinite(
        Number(porcentaje_retencion),
      )
        ? Number(porcentaje_retencion)
        : 0.0;

      // 3. Gestión Automática de Proveedores (Servicio intermedio)
      let proveedorDb = await proveedoresModel.getProveedorByNameOrRif(
        proveedor,
        rifEmisor,
      );

      if (!proveedorDb) {
        const tipo_documento = rifEmisor ? rifEmisor[0].toUpperCase() : "J";
        proveedorDb = await proveedoresModel.createProveedor({
          tipo_documento,
          rif: rifEmisor,
          razon_social: proveedor,
          direccion: direccion || null,
          telefono: null,
          tipo_contribuyente: "Ordinario",
        });
      }

      // 4. Protección contra duplicados en el Libro de Compras usando el método del modelo
      const facturaExistente =
        await facturaModel.getFacturaByProveedorAndNumero(
          proveedorDb.id,
          nroFactura,
        );
      if (facturaExistente) {
        return res.status(409).json({
          error:
            "Ya existe esta factura registrada para el proveedor indicado.",
        });
      }

      // 5. Gestión de Categoría con el NLP Manager
      const categoriaId = await categoriasModel.getOrCreateCategoryId(
        categoria || "Sin categoría",
      );

      // 6. Preparar el DTO (Data Transfer Object) unificado estructurado para el modelo
      const facturaPayload = {
        proveedor_id: proveedorDb.id,
        fecha_emision: fechaEmision,
        numero_factura: nroFactura,
        numero_control: nroControl || nroFactura,
        monto_total: monto_total_norm,
        monto_exento: monto_exento_norm,
        monto_afecto_iva: monto_afecto_norm,
        monto_iva: monto_iva_norm,
        porcentaje_alicuota: porcentaje_alicuota_norm,
        porcentaje_retencion: porcentaje_retencion_norm,
        categoria: categoriaId,
        img_url: img_url || null,
        tipo_documento: "factura",
      };

      console.log(
        "[SGAF Controller] Delegando transacción atómica al Modelo:",
        {
          numero_factura: facturaPayload.numero_factura,
          monto_total: facturaPayload.monto_total,
        },
      );

      // ====================================================================
      // DELEGACIÓN ABSOLUTA AL MODELO TRANSACCIONAL
      // ====================================================================
      const nuevaCompra =
        await facturaModel.createFacturaCompleta(facturaPayload);

      // 7. Registro de Auditoría en el Historial (Post-guardado exitoso)
      try {
        const usuarioId = req.user && req.user.id ? req.user.id : null;
        const direccionIp =
          req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

        await historialModel.addHistorial({
          usuario_id: usuarioId,
          tabla_afectada: "compras",
          registro_id: nuevaCompra?.id || null,
          accion: "CREATE",
          valor_anterior: null,
          valor_nuevo: JSON.stringify({
            proveedor_id: facturaPayload.proveedor_id,
            numero_factura: facturaPayload.numero_factura,
            monto_total: facturaPayload.monto_total,
            comprobante_emitido: nuevaCompra.numero_comprobante || "Ninguno",
          }),
          direccion_ip: direccionIp,
        });
      } catch (histError) {
        console.error(
          "[SGAF Historial Warning] Error guardando log de auditoría:",
          histError,
        );
        // No bloqueamos la respuesta HTTP si el registro secundario de auditoría falla
      }

      // 8. Respuesta Exitosa al Frontend
      return res.status(200).json({
        mensaje:
          "Factura verificada e insertada en el Libro de Compras con éxito",
        id: nuevaCompra?.id,
        comprobante: nuevaCompra.numero_comprobante, // Retorna el string legal ("20260600000001") o null si no hubo retención
      });
    } catch (error) {
      console.error(
        "[SGAF Controller Error] Falló el flujo de confirmación:",
        error,
      );
      return res.status(500).json({ error: error.message });
    }
  },

  async addRetencionAFactura(req, res) {
    try {
      const facturaId = req.params.id;
      const porcentajeRetencion = Number(req.body.porcentaje_retencion);

      if (
        !Number.isFinite(porcentajeRetencion) ||
        porcentajeRetencion < 1 ||
        porcentajeRetencion > 5
      ) {
        return res.status(400).json({
          error: "El porcentaje de retención debe ser un número entre 1 y 5",
        });
      }

      const nuevaRetencion = await facturaModel.createRetencionFromFactura(
        facturaId,
        porcentajeRetencion,
      );

      try {
        const usuarioId = req.user && req.user.id ? req.user.id : null;
        await historialModel.addHistorial({
          usuario_id: usuarioId,
          tabla_afectada: "compra_impuestos",
          registro_id: nuevaRetencion?.id || null,
          accion: "CREATE",
          valor_anterior: null,
          valor_nuevo: JSON.stringify(nuevaRetencion),
        });
      } catch (histError) {
        console.error("Error guardando historial de retención:", histError);
      }

      return res.status(200).json({
        mensaje: "Retención generada con éxito",
        data: nuevaRetencion,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  async editarFactura(req, res) {
    try {
      const facturaId = req.params.id;

      // 1. Verificar la existencia de la factura y traer sus valores actuales
      const facturaExistente = await facturaModel.getFacturaById(facturaId);
      if (!facturaExistente) {
        return res.status(404).json({ error: "Factura no encontrada." });
      }

      // 2. Extraer datos del body EXCLUYENDO el monto_total por regla de negocio
      const {
        proveedor_id, // ID del proveedor asociado
        numero_factura,
        numero_control,
        fecha_emision,
        categoria, // ID de la categoría (bigint)
        factura_afectada,
        tipo_documento,
      } = req.body;

      // 3. Construir los objetos para el historial de auditoría (JSONB)
      // Guardamos solo los estados de los campos que permitimos editar
      const valorAnterior = {
        proveedor_id: facturaExistente.proveedor_id,
        numero_factura: facturaExistente.numero_factura,
        numero_control: facturaExistente.numero_control,
        fecha_emision: facturaExistente.fecha_emision,
        categoria: facturaExistente.categoria,
        factura_afectada: facturaExistente.factura_afectada,
        tipo_documento: facturaExistente.tipo_documento,
      };

      const valorNuevo = {
        proveedor_id: proveedor_id || facturaExistente.proveedor_id,
        numero_factura: numero_factura || facturaExistente.numero_factura,
        numero_control: numero_control || facturaExistente.numero_control,
        fecha_emision: fecha_emision || facturaExistente.fecha_emision,
        categoria: categoria || facturaExistente.categoria,
        factura_afectada: factura_afectada || facturaExistente.factura_afectada,
        tipo_documento: tipo_documento || facturaExistente.tipo_documento,
      };

      // 4. Ejecutar la actualización en la base de datos
      await facturaModel.updateFactura(facturaId, valorNuevo);

      // 5. REGISTRO EN EL HISTORIAL DE CAMBIOS
      // Capturamos el usuario desde la sesión activa (se asume que cuentas con req.session.userId o similar)
      const usuarioId =
        req.session && req.session.userId ? req.session.userId : null;
      const direccionIp =
        req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

      await historialModel.addHistorial({
        usuario_id: usuarioId,
        tabla_afectada: "compras",
        registro_id: facturaId,
        accion: "UPDATE",
        valor_anterior: JSON.stringify(valorAnterior),
        valor_nuevo: JSON.stringify(valorNuevo),
        direccion_ip: direccionIp,
      });

      return res.status(200).json({
        mensaje:
          "Factura actualizada con éxito y registrada en el historial de auditoría",
        data: valorNuevo,
      });
    } catch (error) {
      console.error("Error en controlador al editar factura:", error);
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
        return res.status(400).json({
          error:
            "El parámetro fecha es requerido para realizar la consulta fiscal.",
        });
      }

      console.log(
        `[SGAF] Consultando facturas del Libro de Compras para la fecha: ${fecha}`,
      );

      const facturas = await facturaModel.getFacturasByFechaEmision(fecha);
      console.log("-> REGISTROS ENCONTRADOS EN BD:", facturas.length);

      return res.status(200).json({
        mensaje: `Facturas recuperadas con éxito para el día ${fecha}`,
        data: facturas,
      });
    } catch (error) {
      console.error("Error en consulta por fecha de emisión:", error);
      return res.status(500).json({ error: error.message });
    }
  },

  async buscarFacturaPorTexto(req, res) {
    try {
      const { criterio, page = 1, limit = 5 } = req.query;

      // 1. Validación de Entrada
      if (!criterio || criterio.trim() === "") {
        return res.status(400).json({
          error:
            "Debe ingresar un número de factura o nombre de proveedor para realizar la búsqueda.",
        });
      }

      // 2. Preparación de variables de paginación
      const textoBusqueda = criterio.trim();
      const pagina = parseInt(page, 10) || 1;
      const cantidad = parseInt(limit, 10) || 5;
      const offset = (pagina - 1) * cantidad;

      console.log(
        `[SGAF Controller] Delegando búsqueda paginada al Modelo para: "${textoBusqueda}"`,
      );

      // 3. Consumo del Modelo (El controlador NO sabe nada de SQL ni de 'pool')
      const { registros, totalAbsoluto } =
        await facturaModel.buscarFacturasPaginadas(
          textoBusqueda,
          cantidad,
          offset,
        );

      // 4. Cálculo de la metadata de paginación
      const totalPaginas = Math.ceil(totalAbsoluto / cantidad);

      // 5. Respuesta al Cliente Frontend
      return res.status(200).json({
        ok: true,
        data: registros,
        pagination: {
          totalRegistros: totalAbsoluto,
          totalPaginas: totalPaginas,
          paginaActual: pagina,
          limitePorPagina: cantidad,
        },
      });
    } catch (error) {
      console.error(
        "[SGAF Controller Error] Falló el flujo de búsqueda:",
        error,
      );
      return res.status(500).json({ error: error.message });
    }
  },

  async renderComprobante(req, res) {
    try {
      const { id } = req.params;

      // 1. Buscar la información completa cruzando las tablas
      // Cambiamos el nombre a 'factura' para que haga match perfecto con los .replace() de abajo
      const factura = await facturaModel.getComprobanteDataForReport(id);

      if (!factura) {
        return res.status(404).send("Comprobante no encontrado.");
      }

      // 2. Leer de forma asíncrona el archivo HTML desde tu carpeta de plantillas
      const templatePath = path.join(
        __dirname,
        "../templates/comprobante_iva.html",
      );
      let htmlContent = await fs.promises.readFile(templatePath, "utf8");

      // 3. Reemplazar los marcadores por los datos reales de la Base de Datos
      htmlContent = htmlContent
        // Encabezado y Metadatos
        .replace(/{{numero_comprobante}}/g, factura.comprobante || "---")
        .replace(
          /{{fecha_emision}}/g,
          factura.fechaEmision
            ? new Date(factura.fechaEmision).toLocaleDateString("es-VE")
            : "---",
        )
        .replace(/{{periodo_fiscal}}/g, factura.periodoFiscal || "---")

        // Datos de la Empresa (Agente de Retención) dinámicos
        .replace(
          /ECHO SYSTEMS, C.A./g,
          factura.empresaNombre || "ECHO SYSTEMS, C.A.",
        )
        .replace(/J-50478291-0/g, factura.empresaRif || "---")
        .replace(
          /Av. Ollarvazu, Edif. Echo Systems, Piso 1.<br>\s*Punto Fijo, Estado Falcón, Zona Postal 4102./g,
          factura.empresaDireccion || "---",
        )

        // Datos del Proveedor (Retenido)
        .replace(/{{proveedor_nombre}}/g, factura.proveedor || "---")
        .replace(/{{proveedor_rif}}/g, factura.rifEmisor || "---")
        .replace(
          /{{proveedor_direccion}}/g,
          factura.direccion || "No registrada",
        )
        .replace(/{{proveedor_firma}}/g, factura.proveedor || "Proveedor")

        // Datos Específicos de la Factura y Tabla Fiscal
        .replace(/{{numero_factura}}/g, factura.nroFactura || "---")
        .replace(/{{numero_control}}/g, factura.nroControl || "---")

        // Formateo de los montos numéricos (Bs.) utilizando convención local de comas y puntos
        .replace(
          /{{monto_total}}/g,
          factura.montoTotal
            ? parseFloat(factura.montoTotal).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00",
        )
        .replace(
          /{{monto_exento}}/g,
          factura.montoExento
            ? parseFloat(factura.montoExento).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00",
        )
        .replace(
          /{{base_imponible}}/g,
          factura.montoAfectoIva
            ? parseFloat(factura.montoAfectoIva).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00",
        )
        .replace(
          /{{porcentaje_alicuota}}/g,
          parseInt(factura.porcentajeAlicuota) || "0",
        )
        .replace(
          /{{monto_iva}}/g,
          factura.montoIva
            ? parseFloat(factura.montoIva).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00",
        )
        .replace(
          /{{porcentaje_retencion}}/g,
          parseInt(factura.porcentajeRetencion) || "0",
        )
        .replace(
          /{{monto_retencion}}/g,
          factura.montoRetencion
            ? parseFloat(factura.montoRetencion).toLocaleString("es-VE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "0.00",
        );

      // 4. Enviar el HTML procesado directamente al navegador
      return res.status(200).send(htmlContent);
    } catch (error) {
      console.error("Error al renderizar el reporte:", error);
      return res
        .status(500)
        .send("Error interno al generar la vista de impresión.");
    }
  },
};

module.exports = facturasController;
