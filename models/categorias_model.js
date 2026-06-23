const pool = require("../config/bd");

const categoriasModel = {
  getFirstCategoria() {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT id, nombre FROM categorias ORDER BY id LIMIT 1",
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results.rows[0] || null);
          }
        },
      );
    });
  },

  getCategoriaByNombre(nombre) {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT id, nombre FROM categorias WHERE nombre ILIKE $1 LIMIT 1",
        [nombre],
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results.rows[0] || null);
          }
        },
      );
    });
  },

  createCategoria(nombre) {
    return new Promise((resolve, reject) => {
      pool.query(
        "INSERT INTO categorias (nombre) VALUES ($1) RETURNING id, nombre",
        [nombre],
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results.rows[0]);
          }
        },
      );
    });
  },

  getAllCategorias() {
    return new Promise((resolve, reject) => {
      pool.query(
        "SELECT id, nombre FROM categorias ORDER BY id",
        (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results.rows);
          }
        },
      );
    });
  },

  async getOrCreateCategoryId(nombre = 'Sin categoría') {
    const existing = await this.getCategoriaByNombre(nombre);
    if (existing) return existing.id;
    const created = await this.createCategoria(nombre);
    return created.id;
  },


  getResumenGastos() {
    return new Promise((resolve, reject) => {
      // Usamos REPLACE para eliminar cualquier comilla simple del string antes de evaluar el LOWER
      const query = `
        SELECT 
          c.id,
          c.nombre,
          COALESCE(SUM(co.monto_total), 0) AS total_bs
        FROM public.categorias c
        LEFT JOIN public.compras co ON c.id = co.categoria 
          AND (LOWER(REPLACE(co.estatus, '''', '')) = 'activa' OR co.estatus IS NULL)
        GROUP BY c.id, c.nombre
        ORDER BY total_bs DESC;
      `;

      pool.query(query, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  },

  getGastosPorCategoria(categoriaId) {
    return new Promise((resolve, reject) => {
      // Aplicamos el mismo limpiador de comillas aquí por consistencia
      const query = `
        SELECT 
          co.id AS compra_id,
          co.numero_factura,
          co.fecha_emision,
          co.monto_total AS monto_bs,
          p.razon_social AS proveedor,
          co.estatus
        FROM public.compras co
        INNER JOIN public.proveedores p ON co.proveedor_id = p.id
        WHERE co.categoria = $1 
          AND (LOWER(REPLACE(co.estatus, '''', '')) = 'activa' OR co.estatus IS NULL)
        ORDER BY co.fecha_emision DESC;
      `;

      const idLimpio = parseInt(categoriaId, 10);

      pool.query(query, [idLimpio], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  },
};

module.exports = categoriasModel;