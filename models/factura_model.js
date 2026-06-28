require("dotenv").config();
const pool = require("../config/bd");
const empresaModel = require("./empresa_model");

const facturaModel = {
  // Exportamos el pool por si el controlador lo necesita directamente
  pool,

  calculateImpuestos(facturaData) {
    const montoTotal = Number(facturaData.monto_total || 0.0);
    const montoExento = Number(facturaData.monto_exento || 0.0);
    const montoAfectoIva = Number(facturaData.monto_afecto_iva || 0.0);
    const montoIva = Number(facturaData.monto_iva || 0.0);
    const porcentajeAlicuota = Number.isFinite(
      Number(facturaData.porcentaje_alicuota),
    )
      ? Number(facturaData.porcentaje_alicuota)
      : 16.0;
    const porcentajeRetencion = Number.isFinite(
      Number(facturaData.porcentaje_retencion),
    )
      ? Number(facturaData.porcentaje_retencion)
      : 0.0;

    let baseImponible = montoAfectoIva;
    let ivaCalculado = montoIva;
    const factorIva = porcentajeAlicuota / 100;

    if (baseImponible <= 0 && montoIva > 0 && factorIva > 0) {
      baseImponible = Number((montoIva / factorIva).toFixed(2));
    }

    if (baseImponible <= 0 && montoTotal > 0) {
      if (montoExento >= montoTotal) {
        baseImponible = 0.0;
        ivaCalculado = 0.0;
      } else {
        const taxedTotal = Math.max(0, montoTotal - montoExento);
        baseImponible = Number((taxedTotal / (1 + factorIva)).toFixed(2));
        ivaCalculado = Number((baseImponible * factorIva).toFixed(2));
      }
    }

    if (montoExento >= montoTotal) {
      baseImponible = 0.0;
      ivaCalculado = 0.0;
    }

    let montoRetencion = 0.0;
    if (porcentajeRetencion > 0 && ivaCalculado > 0) {
      montoRetencion = Number(
        ((ivaCalculado * porcentajeRetencion) / 100).toFixed(2),
      );
    }

    return {
      porcentaje_alicuota: Number(porcentajeAlicuota.toFixed(2)),
      base_imponible: baseImponible,
      monto_iva: ivaCalculado,
      percentage_retencion: Number(porcentajeRetencion.toFixed(2)), // Mapeado al uso interno
      monto_retencion: montoRetencion,
    };
  },

  normalizeRetencionPorcentaje(porcentajeRetencion) {
    const valor = Number(porcentajeRetencion || 0);
    return Number.isFinite(valor) ? Number(valor.toFixed(2)) : 0.0;
  },

  isValidRetentionSelection(porcentajeRetencion) {
    return (
      Number.isFinite(porcentajeRetencion) &&
      porcentajeRetencion >= 1 &&
      porcentajeRetencion <= 5
    );
  },

  // =================================================================
  // GUARDADO TRANSACCIONAL UNIFICADO (COMPRA + COMPROBANTE + IMPUESTOS)
  // =================================================================
  async createFacturaCompleta(facturaData) {
    // Obtenemos un cliente exclusivo de la conexión para poder manejar la transacción
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Ejecutar el cálculo exacto de impuestos en backend
      const impuestosCalculados = this.calculateImpuestos(facturaData);

      let comprobanteRetencionId = null;
      let numeroComprobanteGenerado = null;

      // 2. Determinar si requiere generación automática de Comprobante de Retención
      const porcRet = this.normalizeRetencionPorcentaje(
        facturaData.porcentaje_retencion,
      );

      if (porcRet > 0 && impuestosCalculados.monto_retencion > 0) {
        // Estructurar el Período Fiscal (Ej: "202606" para Junio de 2026)
        const fecha = new Date(facturaData.fecha_emision);
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const periodoFiscal = `${anio}${mes}`;

        // Conseguir el correlativo del mes bloqueando la fila para evitar colisiones concurrentes (Race Conditions)
        const resCorrelativo = await client.query(
          "SELECT COUNT(*) as total FROM public.comprobante_retencion WHERE periodo_fiscal = $1",
          [periodoFiscal],
        );
        const secuencia = String(
          parseInt(resCorrelativo.rows[0].total, 10) + 1,
        ).padStart(8, "0");
        numeroComprobanteGenerado = `${periodoFiscal}${secuencia}`;

        // Insertar en 'comprobante_retencion'
        const queryComp = `
          INSERT INTO public.comprobante_retencion (proveedor_id, numero_comprobante, fecha_emision, periodo_fiscal)
          VALUES ($1, $2, $3, $4) RETURNING id;
        `;
        const resComp = await client.query(queryComp, [
          facturaData.proveedor_id,
          numeroComprobanteGenerado,
          facturaData.fecha_emision,
          periodoFiscal,
        ]);
        comprobanteRetencionId = resComp.rows[0].id;
      }

      // 3. Insertar en la tabla principal de 'compras' vinculando el comprobante obtenido
      const queryCompra = `
        INSERT INTO public.compras (
          proveedor_id, comprobante_retencion, tipo_documento, fecha_emision, 
          numero_factura, numero_control, monto_total, categoria, img_url, estatus
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activa') RETURNING *;
      `;
      const valuesCompra = [
        facturaData.proveedor_id,
        comprobanteRetencionId, // uuid o null si no aplica retención
        facturaData.tipo_documento || "factura",
        facturaData.fecha_emision,
        facturaData.numero_factura,
        facturaData.numero_control || facturaData.numero_factura,
        facturaData.monto_total || 0.0,
        facturaData.categoria,
        facturaData.img_url || null,
      ];

      const resCompra = await client.query(queryCompra, valuesCompra);
      const nuevaCompra = resCompra.rows[0];

      // 4. Insertar los desgloses en 'compra_impuestos' usando el id de la compra generada
      const queryImpuestos = `
        INSERT INTO public.compra_impuestos (
          compra_id, porcentaje_alicuota, base_imponible, monto_iva, porcentaje_retencion, monto_retencion
        ) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
      `;
      const valuesImpuestos = [
        nuevaCompra.id,
        impuestosCalculados.porcentaje_alicuota,
        impuestosCalculados.base_imponible,
        impuestosCalculados.monto_iva,
        porcRet,
        impuestosCalculados.monto_retencion,
      ];

      const resImpuestos = await client.query(queryImpuestos, valuesImpuestos);

      // Adjuntamos la información de impuestos y comprobante al objeto final de retorno
      nuevaCompra.impuesto = resImpuestos.rows[0];
      nuevaCompra.numero_comprobante = numeroComprobanteGenerado; // Se pasa al controlador para la respuesta HTTP

      // Todo marchó bien, consolidamos la transacción
      await client.query("COMMIT");
      return nuevaCompra;
    } catch (error) {
      // Si algo falló en cualquiera de los pasos, revertimos los cambios por completo
      await client.query("ROLLBACK");
      throw error;
    } finally {
      // Liberamos el cliente de vuelta al pool de conexiones
      client.release();
    }
  },

  getFacturaByProveedorAndNumero(proveedorId, numeroFactura) {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM compras WHERE proveedor_id = $1 AND numero_factura = $2 LIMIT 1",
        [proveedorId, numeroFactura],
        (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.rows && results.rows[0] ? results.rows[0] : null);
        },
      );
    });
  },

  getFacturas() {
    return new Promise((resolve, reject) => {
      pool.query("SELECT * FROM compras", (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results.rows);
      });
    });
  },

  getFacturaById(id) {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM compras WHERE id = $1",
        [id],
        (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.rows && results.rows[0] ? results.rows[0] : null);
        },
      );
    });
  },

  getFacturasByProveedorId(proveedorId) {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM compras WHERE proveedor_id = $1",
        [proveedorId],
        (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.rows);
        },
      );
    });
  },

  updateFactura(id, datosNuevos) {
    return new Promise((resolve, reject) => {
      const query = `
            UPDATE public.compras
            SET 
            proveedor_id = $1,
            numero_factura = $2,
            numero_control = $3,
            fecha_emision = $4,
            categoria = $5,
            fecha_registro = NOW()
            WHERE id = $6;
        `;

      // Arreglo plano de parámetros ordenados estrictamente del $1 al $6
      const params = [
        datosNuevos.proveedor_id,
        datosNuevos.numero_factura,
        datosNuevos.numero_control,
        datosNuevos.fecha_emision,
        datosNuevos.categoria,
        id,
      ];

      pool.query(query, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  },

  updateFacturaById(id, updateData) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updateData);
      if (fields.length === 0) {
        return resolve(null);
      }

      const setClauses = fields
        .map((campo, index) => `${campo} = $${index + 1}`)
        .join(", ");
      const values = fields.map((campo) => updateData[campo]);
      values.push(id);

      const query = `UPDATE compras SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
      pool.query(query, values, (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results.rows && results.rows[0] ? results.rows[0] : null);
      });
    });
  },

  getFacturasByCategoriayMonth(categoria) {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM compras WHERE categoria = $1 AND EXTRACT(MONTH FROM fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)",
        [categoria],
        (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.rows);
        },
      );
    });
  },

  getFacturasByMonth() {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM compras WHERE EXTRACT(MONTH FROM fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)",
        (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.rows);
        },
      );
    });
  },

  getFacturasByFechaEmision(fechaEmision) {
    return new Promise((resolve, reject) => {
      const query = `
                SELECT c.*, p.razon_social AS proveedor_nombre 
                FROM compras c
                LEFT JOIN proveedores p ON c.proveedor_id = p.id
                WHERE c.fecha_emision::date = $1::date
            `;
      pool.query(query, [fechaEmision], (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results.rows);
      });
    });
  },

  buscarFacturasPaginadas(texto, limite, offset) {
    return new Promise((resolve, reject) => {
      const patron = `%${texto}%`;

      // Query 1: Obtener los registros de la página actual
      const queryRegistros = `
        SELECT co.id, co.numero_factura, co.numero_control, co.fecha_emision, 
               co.monto_total, p.razon_social AS proveedor, co.categoria, co.proveedor_id
        FROM public.compras co
        INNER JOIN public.proveedores p ON co.proveedor_id = p.id
        WHERE co.numero_factura ILIKE $1 OR p.razon_social ILIKE $1
        ORDER BY co.fecha_emision DESC
        LIMIT $2 OFFSET $3;
      `;

      // Query 2: Contar el universo total de coincidencias para calcular las páginas
      const queryConteo = `
        SELECT COUNT(*) AS total
        FROM public.compras co
        INNER JOIN public.proveedores p ON co.proveedor_id = p.id
        WHERE co.numero_factura ILIKE $1 OR p.razon_social ILIKE $1;
      `;

      // Ejecutamos ambas consultas en paralelo para máxima eficiencia
      Promise.all([
        pool.query(queryRegistros, [patron, limite, offset]),
        pool.query(queryConteo, [patron]),
      ])
        .then(([resRegistros, resConteo]) => {
          resolve({
            registros: resRegistros.rows,
            totalAbsoluto: parseInt(resConteo.rows[0].total, 10),
          });
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  async buscarComprobantePorCriterio(criterio) {
    const queryText = `
      SELECT 
        cr.id AS comprobante_id,
        cr.numero_comprobante,
        cr.fecha_emision AS fecha_comprobante,
        cr.periodo_fiscal,
        p.razon_social AS proveedor_nombre,
        p.rif AS proveedor_rif,
        p.direccion AS proveedor_direccion,
        c.id AS compra_id,
        c.numero_factura,
        c.numero_control,
        c.monto_total,
        ci.base_imponible,
        ci.monto_iva,
        ci.porcentaje_alicuota,
        ci.porcentaje_retencion,
        ci.monto_retencion
      FROM public.comprobante_retencion cr
      JOIN public.proveedores p ON cr.proveedor_id = p.id
      JOIN public.compras c ON c.comprobante_retencion = cr.id
      JOIN public.compra_impuestos ci ON ci.compra_id = c.id
      WHERE cr.numero_comprobante = $1 
        OR c.numero_factura = $1 
        OR p.rif = $1;
    `;

    const res = await pool.query(queryText, [criterio.trim()]);
    return res.rows; // Devuelve todos los datos desglosados listos para re-poblar el HTML de impresión
  },

  async getComprobanteDataForReport(facturaId) {
    try {
      const query = `
      SELECT 
        -- Datos de la Compra/Factura
        c.id,
        c.numero_factura AS "nroFactura",
        c.numero_control AS "nroControl",
        c.fecha_emision AS "fechaEmision",
        c.fecha_registro AS "fechaRegistro",
        c.monto_total AS "montoTotal",
        c.img_url AS "imgUrl",
        
        -- Datos del Proveedor (Emisor)
        p.razon_social AS "proveedor",
        p.tipo_documento || '-' || p.rif AS "rifEmisor", -- O la columna RIF si usas p.id como string/RIF
        p.direccion AS "direccion",
        
        -- Impuestos y Retención (Tabla Relacionada)
        ci.porcentaje_alicuota AS "porcentajeAlicuota",
        ci.base_imponible AS "montoAfectoIva",
        ci.monto_iva AS "montoIva",
        ci.porcentaje_retencion AS "porcentajeRetencion",
        ci.monto_retencion AS "montoRetencion",
        
        -- El cálculo contable del Monto Exento (Monto Total - Base Imponible - IVA)
        ROUND((c.monto_total - ci.base_imponible - ci.monto_iva), 2) AS "montoExento",

        -- Datos del Comprobante de Retención Generado
        cr.numero_comprobante AS "comprobante",
        cr.fecha_emision AS "fechaEmisionComprobante",
        cr.periodo_fiscal AS "periodoFiscal",

        -- Datos de tu Empresa (Agente de Retención)
        e.nombre AS "empresaNombre",
        e.tipo_documento || '-' || e.rif AS "empresaRif",
        e.direccion AS "empresaDireccion"
      FROM public.compras c
      INNER JOIN public.proveedores p ON c.proveedor_id = p.id
      INNER JOIN public.compra_impuestos ci ON c.id = ci.compra_id
      LEFT JOIN public.comprobante_retencion cr ON c.comprobante_retencion = cr.id
      CROSS JOIN public.empresa e
      WHERE c.id = $1;
    `;

      // Si estás usando la instancia global o importada del pool de 'pg'
      const resultado = await pool.query(query, [facturaId]);
      return resultado.rows[0] || null;
    } catch (error) {
      console.error(
        "[SGAF Model Error] Error en getComprobanteDataForReport:",
        error,
      );
      throw error;
    }
  },

  // 1. CONSULTA PARA EL LIBRO DE COMPRAS
  async getLibroCompras(mes, anio) {
    try {
      const query = `
              SELECT 
                  c.fecha_emision AS "fechaEmision",
                  c.fecha_registro AS "fechaRegistro",
                  p.tipo_documento || '-' || p.rif AS "rifProveedor",
                  p.razon_social AS "proveedorNombre",
                  c.numero_factura AS "nroFactura",
                  c.numero_control AS "nroControl",
                  c.tipo_documento AS "tipoDocumento",
                  c.factura_afectada AS "facturaAfectada",
                  c.monto_total AS "montoTotal",

                  -- Datos de tu Empresa (Agente de Retención)
                  e.nombre AS "empresaNombre",
                  e.tipo_documento || '-' || e.rif AS "empresaRif",
                  e.direccion AS "empresaDireccion", -- 🌟 Colocada la coma que faltaba
                  
                  COALESCE(ci.base_imponible, c.monto_total) AS "baseImponible",
                  COALESCE(ci.porcentaje_alicuota, 0) AS "porcentajeAlicuota",
                  COALESCE(ci.monto_iva, 0) AS "montoIva",
                  
                  -- FÓRMULA CONTROLADA PARA EL MONTO EXENTO:
                  CASE 
                      WHEN COALESCE(ci.porcentaje_alicuota, 0) = 0 THEN c.monto_total
                      ELSE 
                          GREATEST(0, ROUND((c.monto_total - COALESCE(ci.base_imponible, 0) - COALESCE(ci.monto_iva, 0)), 2))
                  END AS "montoExento",
                  
                  COALESCE(ci.monto_retencion, 0) AS "montoRetencion",
                  cr.numero_comprobante AS "nroComprobante"
              FROM public.compras c
              INNER JOIN public.proveedores p ON c.proveedor_id = p.id
              LEFT JOIN public.compra_impuestos ci ON c.id = ci.compra_id
              LEFT JOIN public.comprobante_retencion cr ON c.comprobante_retencion = cr.id
              CROSS JOIN public.empresa e -- 🌟 Movido aquí arriba junto a los demás JOINs
              WHERE EXTRACT(MONTH FROM c.fecha_emision) = $1 
                AND EXTRACT(YEAR FROM c.fecha_emision) = $2
              ORDER BY c.fecha_emision ASC, c.numero_factura ASC;
          `;
      const resultado = await pool.query(query, [mes, anio]);
      return resultado.rows;
    } catch (error) {
      console.error("[SGAF Model] Error en getLibroCompras:", error);
      throw error;
    }
  },

  // 2. CONSULTA PARA REPORTE DE RETENCIONES POR PERÍODO (QUINCENAL)
  async getRetencionesPorPeriodo(mes, anio, quincena) {
    try {
      // Definimos el rango de días según la quincena
      const diaInicio = quincena == 1 ? 1 : 16;
      const diaFin = quincena == 1 ? 15 : 31; // Postgres maneja el extremo superior bien si el mes tiene menos días

      const query = `
              SELECT 
                  cr.numero_comprobante AS "nroComprobante",
                  cr.fecha_emision AS "fechaComprobante",
                  c.numero_factura AS "nroFactura",
                  c.numero_control AS "nroControl",
                  c.fecha_emision AS "fechaFactura",
                  c.monto_total AS "montoTotal",
                  ci.base_imponible AS "baseImponible",
                  ci.monto_iva AS "montoIva",
                  ci.porcentaje_retencion AS "porcentajeRetencion",
                  ci.monto_retencion AS "montoRetencion",
                  p.razon_social AS "proveedorNombre",
                  p.tipo_documento || '-' || p.id AS "rifProveedor"
              FROM public.comprobante_retencion cr
              INNER JOIN public.compras c ON c.comprobante_retencion = cr.id
              INNER JOIN public.compra_impuestos ci ON c.id = ci.compra_id
              INNER JOIN public.proveedores p ON c.proveedor_id = p.id
              WHERE EXTRACT(MONTH FROM cr.fecha_emision) = $1
                AND EXTRACT(YEAR FROM cr.fecha_emision) = $2
                AND EXTRACT(DAY FROM cr.fecha_emision) BETWEEN $3 AND $4
              ORDER BY cr.numero_comprobante ASC;
          `;
      const resultado = await pool.query(query, [mes, anio, diaInicio, diaFin]);
      return resultado.rows;
    } catch (error) {
      console.error("[SGAF Model] Error en getRetencionesPorPeriodo:", error);
      throw error;
    }
  },

  obtenerRetencionesPorQuincena: async (mes, anio, quincena) => {
    let diaInicio = 1;
    let diaFin = 15;

    if (parseInt(quincena) === 2) {
      diaInicio = 16;
      // Obtiene el último día del mes dinámicamente (28, 29, 30, 31)
      diaFin = new Date(parseInt(anio), parseInt(mes), 0).getDate();
    }

    // Formateamos las fechas en formato ISO puro YYYY-MM-DD para pasarlas de manera segura a la base de datos
    const fechaDesde = `${anio}-${String(mes).padStart(2, "0")}-${String(diaInicio).padStart(2, "0")}`;
    const fechaHasta = `${anio}-${String(mes).padStart(2, "0")}-${String(diaFin).padStart(2, "0")}`;

    const query = `
      SELECT 
        -- Datos de la Compra / Factura
        c.id AS "id",
        c.fecha_emision AS "fechaEmision",
        c.numero_factura AS "nroFactura",
        c.numero_control AS "nroControl",
        c.monto_total AS "montoTotal",
        
        -- Datos del Proveedor
        p.tipo_documento || '-' || p.rif AS "rifProveedor", -- O la columna donde guardes el RIF físico si aplica
        p.razon_social AS "proveedorNombre",
        
        -- Datos de Impuestos y Retenciones (Tabla Relacionada)
        ci.base_imponible AS "baseImponible",
        ci.monto_iva AS "montoIva",
        ci.porcentaje_retencion AS "porcentajeAlicuota", -- Mapeado para calcular el % Ret.
        ci.monto_retencion AS "montoRetencion",
        
        -- Datos del Comprobante de Retención Emitido
        cr.numero_comprobante AS "nroComprobante",
        
        -- Datos de la Empresa (Extraídos dinámicamente vía Cross Join para el encabezado)
        e.nombre AS "empresaNombre",
        e.tipo_documento || '-' || e.rif AS "empresaRif"

      FROM public.compras c
      INNER JOIN public.proveedores p ON c.proveedor_id = p.id
      INNER JOIN public.compra_impuestos ci ON ci.compra_id = c.id
      LEFT JOIN public.comprobante_retencion cr ON c.comprobante_retencion = cr.id
      CROSS JOIN public.empresa e
      
      WHERE c.fecha_emision BETWEEN $1 AND $2
        AND ci.monto_retencion > 0
        AND c.estatus = 'activa'
        
      ORDER BY c.fecha_emision ASC, cr.numero_comprobante ASC;
    `;

    const { rows } = await pool.query(query, [fechaDesde, fechaHasta]);
    return rows;
  },
};

module.exports = facturaModel;
