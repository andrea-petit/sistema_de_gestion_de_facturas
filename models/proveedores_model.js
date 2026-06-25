const pool = require('../config/bd');

// Función mejorada para limpiar y evitar la duplicación de letras de control (RIF/Cédula)
function normalizeRif(rif) {
    if (!rif) return null;
    
    // 1. Limpiar caracteres especiales y pasar a mayúsculas
    let cleaned = rif.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // 2. Corregir duplicaciones comunes como "JJ506" o "VV907"
    if (cleaned.length > 1 && cleaned[0] === cleaned[1] && /[A-Z]/.test(cleaned[0])) {
        cleaned = cleaned.substring(1); // Nos quedamos solo con una letra
    }
    
    return cleaned;
}

const proveedoresModel = {
    /**
     * Obtiene la lista de proveedores aplicando paginación estricta
     * @param {number} limite - Cantidad de registros por página
     * @param {number} offset - Cantidad de registros a saltar
     */
    getProveedoresPaginados(limite, offset) {
        return new Promise((resolve, reject) => {
            // 🛠️ Aquí ya NO existe 'creado_en', ordenamos alfabéticamente
            const queryRegistros = `
                SELECT id, tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente
                FROM proveedores
                ORDER BY razon_social ASC
                LIMIT $1 OFFSET $2;
            `;

            const queryConteo = `SELECT COUNT(*) AS total FROM proveedores;`;

            pool.query(queryRegistros, [limite, offset], (errReg, resReg) => {
                if (errReg) return reject(errReg);

                pool.query(queryConteo, [], (errCont, resCont) => {
                    if (errCont) return reject(errCont);

                    const totalRows = resCont.rows[0] && resCont.rows[0].total 
                        ? parseInt(resCont.rows[0].total, 10) 
                        : 0;

                    resolve({
                        registros: resReg.rows,
                        totalAbsoluto: totalRows
                    });
                });
            });
        });
    },

    getAllProveedores() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores ORDER BY razon_social ASC', (error, results) => {
                if (error) reject(error);
                else resolve(results.rows);
            });
        });
    },

    getProveedorById(id) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores WHERE id = $1', [id], (error, results) => {
                if (error) reject(error);
                else resolve(results.rows[0] || null);
            });
        });
    },

    createProveedor(proveedorData) {
        return new Promise((resolve, reject) => {
            const rawRif = proveedorData.rif || 'S/RIF';
            const rifValue = normalizeRif(rawRif) || 'S/RIF';
            const tipoContribuyente = proveedorData.tipo_contribuyente || 'Ordinario';
            
            // Extraer de forma segura el tipo de documento (J, V, G, E)
            const tipoDocumento = proveedorData.tipo_documento || (rifValue ? rifValue[0] : 'J');

            pool.query(
                'INSERT INTO proveedores (tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tipoDocumento.toUpperCase(), rifValue, proveedorData.razon_social, proveedorData.direccion, proveedorData.telefono, tipoContribuyente],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results.rows[0]);
                }
            );
        });
    },

    updateProveedorCompleto(id, datos) {
        return new Promise((resolve, reject) => {
            // Pasamos primero el RIF por la función de limpieza interna del modelo
            const rifLimpio = this.normalizeRif ? this.normalizeRif(datos.rif) : datos.rif;

            const query = `
                UPDATE proveedores 
                SET rif = $1, razon_social = $2, direccion = $3, telefono = $4, tipo_contribuyente = $5
                WHERE id = $6
                RETURNING id, tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente;
            `;

            pool.query(query, [rifLimpio, datos.razon_social, datos.direccion, datos.telefono, datos.tipo_contribuyente, id], (err, res) => {
                if (err) return reject(err);
                resolve(res.rows[0] || null);
            });
        });
    },

    getProveedorByName(razon_social) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error, results) => {
                if (error) reject(error);
                else resolve(results.rows[0] || null);
            });
        });
    },

    getProveedorByRif(rif) {
        return new Promise((resolve, reject) => {
            const normalizedRif = normalizeRif(rif);
            if (!normalizedRif) return resolve(null);

            const queryText = `
                SELECT * FROM proveedores
                WHERE REGEXP_REPLACE(UPPER(rif), '[^A-Z0-9]', '', 'g') = $1
                LIMIT 1
            `;

            pool.query(queryText, [normalizedRif], (error, results) => {
                if (error) return reject(error);
                resolve(results.rows[0] || null);
            });
        });
    },

    getProveedorByNameOrRif(razon_social, rif) {
        return new Promise((resolve, reject) => {
            if (rif) {
                this.getProveedorByRif(rif)
                    .then((proveedor) => {
                        if (proveedor) return resolve(proveedor);

                        pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error2, results2) => {
                            if (error2) reject(error2);
                            else resolve(results2.rows[0] || null);
                        });
                    })
                    .catch((error) => reject(error));
            } else {
                pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error, results) => {
                    if (error) reject(error);
                    else resolve(results.rows[0] || null);
                });
            }
        });
    }
};

module.exports = proveedoresModel;