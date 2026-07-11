require("dotenv").config();
const facturaModel = require("../models/factura_model");
const historialModel = require("../models/historial_model");
const proveedoresModel = require("../models/proveedores_model");
const categoriasModel = require("../models/categorias_model");
const express = require("express");
const router = express.Router();
const fs = require("fs");
const util = require("util");
const cloudinary = require("cloudinary").v2;
const { extraerDatosFactura } = require("../services/ocrService");
const path = require("path");
const ExcelJS = require("exceljs");

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

      // 1. Ejecutar servicio OCR con LlamaCloud (Tarda aprox. 15s)
      const { extraerDatosFactura } = require("../services/ocrService");
      const datosExtraidos = await extraerDatosFactura(req.file.path);

      // =========================================================================
      // ⚡ FILTRO FISCAL ESTRICTO (Frena logos, paisajes o imágenes borrosas)
      // =========================================================================

      // Convertimos todos los valores extraídos a una sola cadena en minúsculas para buscar patrones
      const valoresCrudos = Object.values(datosExtraidos || {})
        .map((v) => String(v).toLowerCase().trim())
        .join(" ");

      // 1. Verificación Rigurosa de RIF Venezolano
      // Valida si existe una letra fiscal (J, V, G, E, P) seguida de números, o si el campo está lleno
      const rifLimpio = String(
        datosExtraidos.rifEmisor || datosExtraidos.rif || "",
      ).trim();
      const tieneRifValido =
        /^[jvgep]-?[0-9]+/i.test(rifLimpio) ||
        /^[jvgep]-?[0-9]+/i.test(valoresCrudos);

      // 2. Verificación de Fecha de Emisión (Indispensable para el período del Libro de Compras)
      const fechaLimpia = String(
        datosExtraidos.fechaEmision || datosExtraidos.fecha || "",
      ).trim();
      // Revisa si hay una fecha estructurada o texto que parezca una fecha (ej: 2026, /06/, /202)
      const tieneFecha =
        fechaLimpia.length > 4 || /\d{2}[-/]\d{2}[-/]\d{4}/.test(valoresCrudos);

      // 3. Verificación de Montos Contables
      const montoTotal = parseFloat(
        datosExtraidos.montoTotal || datosExtraidos.total || 0,
      );
      const baseImponible = parseFloat(
        datosExtraidos.baseImponible || datosExtraidos.base_imponible || 0,
      );
      const tieneMontos = montoTotal > 0 || baseImponible > 0;

      // 🌟 REGLA DE ORO DE EXCLUSIÓN:
      // Una factura para el Libro de Compras DEBE tener obligatoriamente un RIF identificable
      // Y al menos una Fecha o Montos asociados. Si no cumple esto (como el caso del logo), se rechaza.
      if (!tieneRifValido || (!tieneFecha && !tieneMontos)) {
        // Borramos el archivo temporal local de inmediato
        await unlinkAsync(req.file.path).catch(() => {});

        return res.status(422).json({
          error:
            "El archivo cargado no contiene los datos mínimos de una factura fiscal (RIF, Fecha o Montos). Verifique que la imagen corresponda a un documento comercial legible.",
        });
      }
      // =========================================================================

      // 2. Validar credenciales de Cloudinary
      if (!cloudName || !cloudApiKey || !cloudApiSecret) {
        return res.status(500).json({
          error: "Cloudinary no está configurado correctamente en .env",
        });
      }

      // 3. Subir imagen de respaldo a Cloudinary (Solo si superó el filtro superior)
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

      const textoDeValidacion = String(
        req.body.textoPlano || req.body.texto || req.body.rawText || "",
      ).trim();
      const pareceFactura = Boolean(
        proveedor &&
        rifEmisor &&
        nroFactura &&
        (textoDeValidacion.toLowerCase().includes("factura") ||
          textoDeValidacion.toLowerCase().includes("rif") ||
          textoDeValidacion.toLowerCase().includes("iva") ||
          textoDeValidacion.toLowerCase().includes("control") ||
          textoDeValidacion.toLowerCase().includes("seniat")),
      );

      // Validaciones obligatorias de negocio a nivel de transporte/petición
      if (!proveedor || !rifEmisor || !nroFactura) {
        return res.status(400).json({
          error:
            "Proveedor, RIF y Número de Factura son obligatorios para el Libro de Compras.",
        });
      }

      if (!pareceFactura) {
        return res.status(422).json({
          error:
            "El documento no parece ser una factura fiscal válida. No se puede guardar.",
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

  async renderLibroCompras(req, res) {
    try {
      const { mes, anio, format } = req.query;
      if (!mes || !anio)
        return res.status(400).send("Faltan parámetros: mes y anio.");

      // 1. Obtener los datos de la base de datos
      const registros = await facturaModel.getLibroCompras(
        parseInt(mes),
        parseInt(anio),
      );

      // Extraemos la información de la empresa de la primera fila para ambos flujos
      const datosEmpresa = registros.length > 0 ? registros[0] : {};
      const nombreEmpresa = datosEmpresa.empresaNombre || "ECHO SYSTEMS, C.A.";
      const rifEmpresa = datosEmpresa.empresaRif || "J-50478291-0";

      // ==========================================
      // 🟢 FLUJO A: EXCEL CORREGIDO Y ESTILIZADO
      // ==========================================
      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Libro Compras ${mes}-${anio}`);

        // 1. Configurar los anchos y llaves de las columnas (SIN meter headers automáticos que dañen el diseño)
        worksheet.columns = [
          { key: "idx", width: 6 },
          { key: "fecha", width: 14 },
          { key: "rif", width: 16 },
          { key: "nombre", width: 38 },
          { key: "factura", width: 15 },
          { key: "control", width: 15 },
          { key: "total", width: 20 },
          { key: "exento", width: 18 },
          { key: "base", width: 20 },
          { key: "alicuota", width: 10 },
          { key: "iva", width: 18 },
          { key: "comprobante", width: 20 },
          { key: "retenido", width: 20 },
        ];

        // 2. Encabezado Corporativo (Filas 1 y 2)
        worksheet.mergeCells("A1:D1");
        const cellEmpresa = worksheet.getCell("A1");
        cellEmpresa.value = `EMPRESA: ${nombreEmpresa}`;
        cellEmpresa.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "1A365D" },
        };

        worksheet.mergeCells("A2:D2");
        const cellRif = worksheet.getCell("A2");
        cellRif.value = `RIF: ${rifEmpresa}`;
        cellRif.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "1A365D" },
        };

        // 3. Título Central del Reporte (Fila 4)
        worksheet.mergeCells("A4:M4");
        const cellTitulo = worksheet.getCell("A4");
        cellTitulo.value = `LIBRO DE COMPRAS - PERÍODO: ${String(mes).padStart(2, "0")}/${anio}`;
        cellTitulo.font = {
          name: "Arial",
          size: 14,
          bold: true,
          color: { argb: "1A365D" },
        };
        cellTitulo.alignment = { horizontal: "center", vertical: "middle" };
        worksheet.getRow(4).height = 25;

        // 4. Inyección Manual de Cabeceras (Fila 6) para evitar conflictos de sobreescritura
        const headers = [
          "N°",
          "Fecha Emisión",
          "RIF Proveedor",
          "Razón Social",
          "N° Factura",
          "N° Control",
          "Total Compra (Bs.)",
          "Monto Exento (Bs.)",
          "Base Imponible (Bs.)",
          "% Alíc.",
          "Impuesto IVA (Bs.)",
          "N° Comprobante",
          "IVA Retenido (Bs.)",
        ];

        const headerRow = worksheet.getRow(6);
        headerRow.height = 24;

        headers.forEach((texto, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = texto;
          cell.font = {
            name: "Arial",
            bold: true,
            color: { argb: "FFFFFF" },
            size: 10,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "1A365D" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "FFFFFF" } },
            right: { style: "thin", color: { argb: "FFFFFF" } },
          };
        });

        let totalGeneralExcel = 0;
        let totalExentoExcel = 0;
        let totalBaseExcel = 0;
        let totalIvaExcel = 0;
        let totalRetenidoExcel = 0;

        // 5. Añadir los registros (Empiezan en la Fila 7)
        registros.forEach((reg, index) => {
          totalGeneralExcel += parseFloat(reg.montoTotal);
          totalExentoExcel += parseFloat(reg.montoExento);
          totalBaseExcel += parseFloat(reg.baseImponible);
          totalIvaExcel += parseFloat(reg.montoIva);
          totalRetenidoExcel += parseFloat(reg.montoRetencion || 0);

          const row = worksheet.addRow({
            idx: index + 1,
            fecha: new Date(reg.fechaEmision).toLocaleDateString("es-VE"),
            rif: reg.rifProveedor,
            nombre: reg.proveedorNombre,
            factura: reg.nroFactura,
            control: reg.nroControl,
            total: parseFloat(reg.montoTotal),
            exento: parseFloat(reg.montoExento),
            base: parseFloat(reg.baseImponible),
            alicuota: parseFloat(reg.porcentajeAlicuota) / 100, // Mandamos como número decimal real para Excel
            iva: parseFloat(reg.montoIva),
            comprobante: reg.nroComprobante || "---",
            retenido: parseFloat(reg.montoRetencion || 0),
          });

          row.height = 20;

          // Alineaciones estéticas
          row.getCell("A").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("B").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("C").alignment = {
            horizontal: "left",
            vertical: "middle",
          };
          row.getCell("D").alignment = {
            horizontal: "left",
            vertical: "middle",
          };
          row.getCell("E").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("F").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("J").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("L").alignment = {
            horizontal: "center",
            vertical: "middle",
          };

          // Formateo Numérico Puro (Evita las esquinas verdes de error)
          ["G", "H", "I", "K", "M"].forEach((col) => {
            const cell = row.getCell(col);
            cell.numFormat = '#,##0.00;[Red](#,##0.00);"-"';
            cell.alignment = { horizontal: "right", vertical: "middle" };
          });

          // Formato porcentual nativo para la columna J
          row.getCell("J").numFormat = "0%";
        });

        // 6. Fila de Totales Generales Estilizada
        const totalRow = worksheet.addRow([]);
        totalRow.height = 22;

        // Colocamos los textos y valores en las celdas precisas
        totalRow.getCell("D").value = "TOTALES GENERALES:";
        totalRow.getCell("G").value = totalGeneralExcel;
        totalRow.getCell("H").value = totalExentoExcel;
        totalRow.getCell("I").value = totalBaseExcel;
        totalRow.getCell("K").value = totalIvaExcel;
        totalRow.getCell("M").value = totalRetenidoExcel;

        totalRow.font = { name: "Arial", bold: true, size: 10 };
        totalRow.getCell("D").alignment = {
          horizontal: "right",
          vertical: "middle",
        };

        // Aplicar doble línea contable a las celdas de totales
        ["G", "H", "I", "K", "M"].forEach((col) => {
          const cell = totalRow.getCell(col);
          cell.numFormat = '#,##0.00;[Red](#,##0.00);"-"';
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "double", color: { argb: "000000" } }, // Doble línea inferior contable
          };
        });

        // Configurar las cabeceras de respuesta de Node.js
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=Libro_Compras_${mes}_${anio}.xlsx`,
        );

        await workbook.xlsx.write(res);
        return res.end();
      }

      // ==========================================
      // 🔴 FLUJO B: PDF / HTML PREVIEW
      // ==========================================
      const templatePath = path.join(
        __dirname,
        "../templates/libro_compras.html",
      );
      let htmlContent = await fs.promises.readFile(templatePath, "utf8");

      let filasHtml = "";
      let totalGeneral = 0,
        totalBase = 0,
        totalIva = 0,
        totalRetenido = 0;

      registros.forEach((reg, index) => {
        totalGeneral += parseFloat(reg.montoTotal);
        totalBase += parseFloat(reg.baseImponible);
        totalIva += parseFloat(reg.montoIva);
        totalRetenido += parseFloat(reg.montoRetencion || 0);

        filasHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(reg.fechaEmision).toLocaleDateString("es-VE")}</td>
                    <td>${reg.rifProveedor}</td>
                    <td>${reg.proveedorNombre}</td>
                    <td style="font-family: monospace;">${reg.nroFactura}</td>
                    <td style="font-family: monospace;">${reg.nroControl}</td>
                    <td style="text-align:right;">${parseFloat(reg.montoTotal).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                    <td style="text-align:right;">${parseFloat(reg.montoExento).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                    <td style="text-align:right;">${parseFloat(reg.baseImponible).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                    <td>${parseInt(reg.porcentajeAlicuota)}%</td>
                    <td style="text-align:right;">${parseFloat(reg.montoIva).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                    <td style="font-family: monospace; text-align:center;">${reg.nroComprobante || "---"}</td>
                    <td style="text-align:right; font-weight:bold;">${parseFloat(reg.montoRetencion || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
      });

      htmlContent = htmlContent
        .replace(/{{mes}}/g, String(mes).padStart(2, "0"))
        .replace(/{{anio}}/g, anio)
        .replace(/{{empresaNombre}}/g, nombreEmpresa)
        .replace(/{{empresaRif}}/g, rifEmpresa)
        .replace(/{{empresaDireccion}}/g, rifEmpresa)
        .replace(/{{filasCompras}}/g, filasHtml)
        .replace(
          /{{totalGeneral}}/g,
          totalGeneral.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalBase}}/g,
          totalBase.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalIva}}/g,
          totalIva.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalRetenido}}/g,
          totalRetenido.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        );

      return res.status(200).send(htmlContent);
    } catch (error) {
      console.error("Error al generar Libro de Compras:", error);
      return res
        .status(500)
        .send("Error interno al procesar el libro de compras.");
    }
  },

  async renderRelacionRetenciones(req, res) {
    try {
      const { mes, anio, quincena, format } = req.query;
      if (!mes || !anio || !quincena)
        return res.status(400).send("Faltan parámetros: mes, anio y quincena.");

      // 1. Obtener los datos desde el modelo (Abstracción PostgreSQL)
      const registros = await facturaModel.obtenerRetencionesPorQuincena(
        parseInt(mes),
        parseInt(anio),
        parseInt(quincena),
      );

      // Extraemos la información de la empresa de la primera fila
      const datosEmpresa = registros.length > 0 ? registros[0] : {};
      const nombreEmpresa = datosEmpresa.empresaNombre || "ECHO SYSTEMS, C.A.";
      const rifEmpresa = datosEmpresa.empresaRif || "J-50478291-0";

      // ==========================================
      // 🟢 FLUJO A: EXCEL ESTILIZADO (ECHO SYSTEMS)
      // ==========================================
      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(
          `Retenciones Q${quincena} ${mes}-${anio}`,
        );

        // Configurar los anchos y llaves de las columnas
        worksheet.columns = [
          { key: "idx", width: 6 },
          { key: "fecha", width: 14 },
          { key: "rif", width: 16 },
          { key: "nombre", width: 38 },
          { key: "factura", width: 15 },
          { key: "control", width: 15 },
          { key: "comprobante", width: 22 },
          { key: "total", width: 20 },
          { key: "base", width: 20 },
          { key: "iva", width: 18 },
          { key: "porcentaje", width: 10 },
          { key: "retenido", width: 20 },
        ];

        // Encabezado Corporativo (Filas 1 y 2)
        worksheet.mergeCells("A1:D1");
        const cellEmpresa = worksheet.getCell("A1");
        cellEmpresa.value = `EMPRESA: ${nombreEmpresa}`;
        cellEmpresa.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "1A365D" },
        };

        worksheet.mergeCells("A2:D2");
        const cellRif = worksheet.getCell("A2");
        cellRif.value = `RIF: ${rifEmpresa}`;
        cellRif.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "1A365D" },
        };

        // Título Central del Reporte (Fila 4)
        worksheet.mergeCells("A4:L4");
        const cellTitulo = worksheet.getCell("A4");
        cellTitulo.value = `RELACIÓN DE RETENCIONES DE IVA - ${quincena}° QUINCENA DE ${String(mes).padStart(2, "0")}/${anio}`;
        cellTitulo.font = {
          name: "Arial",
          size: 14,
          bold: true,
          color: { argb: "1A365D" },
        };
        cellTitulo.alignment = { horizontal: "center", vertical: "middle" };
        worksheet.getRow(4).height = 25;

        // Cabeceras de la Tabla (Fila 6)
        const headers = [
          "N°",
          "Fecha Emisión",
          "RIF Proveedor",
          "Razón Social",
          "N° Factura",
          "N° Control",
          "N° Comprobante",
          "Total Factura (Bs.)",
          "Base Imponible (Bs.)",
          "Impuesto IVA (Bs.)",
          "% Ret.",
          "IVA Retenido (Bs.)",
        ];

        const headerRow = worksheet.getRow(6);
        headerRow.height = 24;

        headers.forEach((texto, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = texto;
          cell.font = {
            name: "Arial",
            bold: true,
            color: { argb: "FFFFFF" },
            size: 10,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "1A365D" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "medium", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "FFFFFF" } },
            right: { style: "thin", color: { argb: "FFFFFF" } },
          };
        });

        let totalGeneralExcel = 0;
        let totalBaseExcel = 0;
        let totalIvaExcel = 0;
        let totalRetenidoExcel = 0;

        // Añadir los registros (Fila 7+)
        registros.forEach((reg, index) => {
          totalGeneralExcel += parseFloat(reg.montoTotal);
          totalBaseExcel += parseFloat(reg.baseImponible);
          totalIvaExcel += parseFloat(reg.montoIva);
          totalRetenidoExcel += parseFloat(reg.montoRetencion || 0);

          const factorRetencion =
            parseFloat(reg.montoIva) > 0
              ? parseFloat(reg.montoRetencion) / parseFloat(reg.montoIva)
              : 0;

          const row = worksheet.addRow({
            idx: index + 1,
            fecha: new Date(reg.fechaEmision).toLocaleDateString("es-VE"),
            rif: reg.rifProveedor,
            nombre: reg.proveedorNombre,
            factura: reg.nroFactura,
            control: reg.nroControl,
            comprobante: reg.nroComprobante || "---",
            total: parseFloat(reg.montoTotal),
            base: parseFloat(reg.baseImponible),
            iva: parseFloat(reg.montoIva),
            porcentaje: factorRetencion,
            retenido: parseFloat(reg.montoRetencion || 0),
          });

          row.height = 20;

          // Alineaciones estéticas
          ["A", "B", "E", "F", "G", "K"].forEach((col) => {
            row.getCell(col).alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          });
          row.getCell("C").alignment = {
            horizontal: "left",
            vertical: "middle",
          };
          row.getCell("D").alignment = {
            horizontal: "left",
            vertical: "middle",
          };

          // Formateo Numérico Puro
          ["H", "I", "J", "L"].forEach((col) => {
            const cell = row.getCell(col);
            cell.numFormat = '#,##0.00;[Red](#,##0.00);"-"';
            cell.alignment = { horizontal: "right", vertical: "middle" };
          });

          row.getCell("K").numFormat = "0%";
        });

        // Fila de Totales Generales Estilizada
        const totalRow = worksheet.addRow([]);
        totalRow.height = 22;

        totalRow.getCell("D").value = `TOTALES RETENIDOS Q${quincena}:`;
        totalRow.getCell("H").value = totalGeneralExcel;
        totalRow.getCell("I").value = totalBaseExcel;
        totalRow.getCell("J").value = totalIvaExcel;
        totalRow.getCell("L").value = totalRetenidoExcel;

        totalRow.font = { name: "Arial", bold: true, size: 10 };
        totalRow.getCell("D").alignment = {
          horizontal: "right",
          vertical: "middle",
        };

        ["G", "H", "I", "L"].forEach((col) => {
          const cell = totalRow.getCell(col);
          cell.numFormat = '#,##0.00;[Red](#,##0.00);"-"';
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "double", color: { argb: "000000" } },
          };
        });

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=Relacion_Retenciones_Q${quincena}_${mes}_${anio}.xlsx`,
        );

        await workbook.xlsx.write(res);
        return res.end();
      }

      // ==========================================
      // 🔴 FLUJO B: PDF / HTML DESDE CARPETA TEMPLATES
      // ==========================================
      const templatePath = path.join(
        __dirname,
        "../templates/relacion_retenciones.html",
      );
      let htmlContent = await fs.promises.readFile(templatePath, "utf8");

      let filasHtml = "";
      let totalGeneral = 0,
        totalBase = 0,
        totalIva = 0,
        totalRetenido = 0;

      registros.forEach((reg, index) => {
        totalGeneral += parseFloat(reg.montoTotal);
        totalBase += parseFloat(reg.baseImponible);
        totalIva += parseFloat(reg.montoIva);
        totalRetenido += parseFloat(reg.montoRetencion || 0);

        const factor =
          parseFloat(reg.montoIva) > 0
            ? Math.round(
                (parseFloat(reg.montoRetencion) / parseFloat(reg.montoIva)) *
                  100,
              )
            : 0;

        filasHtml += `
          <tr>
            <td>${index + 1}</td>
            <td>${new Date(reg.fechaEmision).toLocaleDateString("es-VE")}</td>
            <td>${reg.rifProveedor}</td>
            <td>${reg.proveedorNombre}</td>
            <td style="font-family: monospace;">${reg.nroFactura}</td>
            <td style="font-family: monospace;">${reg.nroControl}</td>
            <td style="font-family: monospace; text-align:center;">${reg.nroComprobante || "---"}</td>
            <td style="text-align:right;">${parseFloat(reg.montoTotal).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
            <td style="text-align:right;">${parseFloat(reg.baseImponible).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
            <td style="text-align:right;">${parseFloat(reg.montoIva).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
            <td style="text-align:center;">${factor}%</td>
            <td style="text-align:right; font-weight:bold;">${parseFloat(reg.montoRetencion || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      });

      // Si no hay datos, mostrar aviso contable limpio
      if (registros.length === 0) {
        filasHtml =
          '<tr><td colspan="12" style="text-align:center; padding: 20px;">No se encontraron retenciones aplicadas en este período.</td></tr>';
      }

      htmlContent = htmlContent
        .replace(/{{quincena}}/g, quincena)
        .replace(/{{mes}}/g, String(mes).padStart(2, "0"))
        .replace(/{{anio}}/g, anio)
        .replace(/{{empresaNombre}}/g, nombreEmpresa)
        .replace(/{{empresaRif}}/g, rifEmpresa)
        .replace(/{{filasRetenciones}}/g, filasHtml)
        .replace(
          /{{totalGeneral}}/g,
          totalGeneral.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalBase}}/g,
          totalBase.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalIva}}/g,
          totalIva.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        )
        .replace(
          /{{totalRetenido}}/g,
          totalRetenido.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
        );

      return res.status(200).send(htmlContent);
    } catch (error) {
      console.error("Error al generar Relación de Retenciones:", error);
      return res
        .status(500)
        .send("Error interno al procesar la relación de retenciones.");
    }
  },

  async renderComprobanteIndividual(req, res) {
    try {
      const { id } = req.params;

      if (!id)
        return res.status(400).send("Falta el identificador del comprobante.");

      const lineas = await facturaModel.getComprobanteIndividual(id);

      // Si el array viene vacío, detenemos la ejecución
      if (!lineas || lineas.length === 0) {
        return res
          .status(404)
          .send(
            "El comprobante de retención no existe o no tiene facturas activas asociadas.",
          );
      }

      // 🌟 CLAVE 1: Extraer los datos maestros del primer registro del array [0]
      const maestro = lineas[0];

      // 2. Leer de forma asíncrona el archivo HTML desde tu carpeta de plantillas
      const templatePath = path.join(
        __dirname,
        "../templates/comprobante_iva.html",
      );
      let htmlContent = await fs.promises.readFile(templatePath, "utf8");

      // 🌟 CLAVE 2: Construir dinámicamente las filas de la tabla si hay más de una factura
      let filasHtml = "";
      let acumuladoTotal = 0,
        acumuladoBase = 0,
        acumuladoIva = 0,
        acumuladoRetenido = 0;

      lineas.forEach((item, index) => {
        acumuladoTotal += parseFloat(item.montoTotal || 0);
        acumuladoBase += parseFloat(item.baseImponible || 0);
        acumuladoIva += parseFloat(item.montoIva || 0);
        acumuladoRetenido += parseFloat(item.montoRetencion || 0);

        // Si tu plantilla usa marcadores dentro de un bucle de JS, creamos el renglón.
        // Si tu plantilla es estática y solo espera un bloque, usaremos los totales acumulados abajo.
      });

      // 3. Reemplazar los marcadores utilizando los datos extraídos del 'maestro' o del acumulado
      htmlContent = htmlContent
        // Encabezado y Metadatos (Usando nombres reales devueltos por el Modelo en CamelCase)
        .replace(/{{numero_comprobante}}/g, maestro.numeroComprobante || "---")
        .replace(
          /{{fecha_emision}}/g,
          maestro.fechaEmisionComprobante
            ? new Date(maestro.fechaEmisionComprobante).toLocaleDateString(
                "es-VE",
              )
            : "---",
        )
        .replace(/{{periodo_fiscal}}/g, maestro.periodoFiscal || "---")

        // Datos de la Empresa (Agente de Retención) dinámicos
        .replace(
          /ECHO SYSTEMS, C.A./g,
          maestro.empresaNombre || "ECHO SYSTEMS, C.A.",
        )
        .replace(/J-50478291-0/g, maestro.empresaRif || "---")
        .replace(
          /Av. Ollarvazu, Edif. Echo Systems, Piso 1.<br>\s*Punto Fijo, Estado Falcón, Zona Postal 4102./g,
          maestro.empresaDireccion || "---",
        )

        // Datos del Proveedor (Retenido)
        .replace(/{{proveedor_nombre}}/g, maestro.proveedorNombre || "---")
        .replace(/{{proveedor_rif}}/g, maestro.proveedorRif || "---")
        .replace(
          /{{proveedor_direccion}}/g,
          maestro.proveedorDireccion || "No registrada",
        )
        .replace(/{{proveedor_firma}}/g, maestro.proveedorNombre || "Proveedor")

        // Datos Específicos de las Facturas (Si la plantilla maneja una sola o los totales del comprobante)
        .replace(/{{numero_factura}}/g, maestro.nroFactura || "---")
        .replace(/{{numero_control}}/g, maestro.nroControl || "---")

        // Formateo de los montos numéricos (Bs.) utilizando convención local
        .replace(
          /{{monto_total}}/g,
          acumuladoTotal.toLocaleString("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
        .replace(
          /{{monto_exento}}/g,
          "0.00", // Si no se maneja en el query, dejamos por defecto el formato fiscal
        )
        .replace(
          /{{base_imponible}}/g,
          acumuladoBase.toLocaleString("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
        .replace(
          /{{porcentaje_alicuota}}/g,
          parseInt(maestro.porcentajeAlicuota) || "0",
        )
        .replace(
          /{{monto_iva}}/g,
          acumuladoIva.toLocaleString("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        )
        .replace(
          /{{porcentaje_retencion}}/g,
          parseInt(maestro.porcentajeRetencion) || "0",
        )
        .replace(
          /{{monto_retencion}}/g,
          acumuladoRetenido.toLocaleString("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
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
