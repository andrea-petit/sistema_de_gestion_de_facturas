const pool = require('../config/bd');

const categoriasModel = {
  getFirstCategoria() {
    return new Promise((resolve, reject) => {
      pool.query('SELECT id, nombre FROM categorias ORDER BY id LIMIT 1', (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results.rows[0] || null);
        }
      });
    });
  },

  getCategoriaByNombre(nombre) {
    return new Promise((resolve, reject) => {
      pool.query('SELECT id, nombre FROM categorias WHERE nombre ILIKE $1 LIMIT 1', [nombre], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results.rows[0] || null);
        }
      });
    });
  },

  createCategoria(nombre) {
    return new Promise((resolve, reject) => {
      pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id, nombre', [nombre], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results.rows[0]);
        }
      });
    });
  },

  async getOrCreateCategoryId(nombre = 'Sin categoría') {
    const existing = await this.getCategoriaByNombre(nombre);
    if (existing) return existing.id;
    const created = await this.createCategoria(nombre);
    return created.id;
  }
};

module.exports = categoriasModel;
