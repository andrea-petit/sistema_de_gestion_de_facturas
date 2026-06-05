const pool = require('../config/bd');
const empresaModel = require('./empresa_model');

const facturaModel = {
    createFactura(facturaData) {
        return new Promise((resolve, reject) => {
            try {
                empresaModel.getTipoContribuyente()
                    .then((tipoContribuyente) => {
                        try {
                            const queryText = tipoContribuyente === 'Ordinario'
                                ? 'INSERT INTO compras (proveedor_id, fecha_emision, numero_factura, numero_control, monto_total, categoria, img_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *'
                                : 'INSERT INTO compras (proveedor_id, comprobante_retencion, fecha_emision, numero_factura, numero_control, monto_total, categoria, img_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';

                            const queryValues = tipoContribuyente === 'Ordinario'
                                ? [facturaData.proveedor_id, facturaData.fecha_emision, facturaData.numero_factura, facturaData.numero_control, facturaData.monto_total, facturaData.categoria, facturaData.img_url]
                                : [facturaData.proveedor_id, facturaData.comprobante_retencion, facturaData.fecha_emision, facturaData.numero_factura, facturaData.numero_control, facturaData.monto_total, facturaData.categoria, facturaData.img_url];

                            pool.query(queryText, queryValues, (error, results) => {
                                if (error) {
                                    return reject(error);
                                }
                                // Return the inserted row (Postgres returns rows in results.rows)
                                return resolve(results.rows && results.rows[0] ? results.rows[0] : results);
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } catch (error) {
                reject(error);
            }
        });
    },

    getFacturas() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compras', (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    },

    getFacturaById(id) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compras WHERE id = $1', [id], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows && results.rows[0] ? results.rows[0] : null);
            });
        });
    },

    getFacturasByProveedorId(proveedorId) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compras WHERE proveedor_id = $1', [proveedorId], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    },

    updateFactura(id, campo, valor) {
        return new Promise((resolve, reject) => {
            pool.query(`UPDATE compras SET ${campo} = $1 WHERE id = $2 RETURNING *`, [valor, id], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows && results.rows[0] ? results.rows[0] : results);
            });
        });
    },

    getFacturasByCategoriayMonth(categoria) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compras WHERE categoria = $1 AND EXTRACT(MONTH FROM fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)', [categoria], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    },

    getFacturasByMonth() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compras WHERE EXTRACT(MONTH FROM fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)', (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    }
        

};

module.exports = facturaModel;
