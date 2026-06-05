const pool = require('../config/bd');

const proveedoresModel = {
    getAllProveedores() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores', (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.rows);
                }
            });
        });
    },

    getProveedorById(id) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores WHERE id = $1', [id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.rows[0] || null);
                }
            });
        });
    },

    createProveedor(proveedorData) {
        return new Promise((resolve, reject) => {
            const rifValue = proveedorData.rif || 'S/RIF';
            const tipoContribuyente = proveedorData.tipo_contribuyente || 'Ordinario';
            const tipoDocumento = proveedorData.tipo_documento || (rifValue ? rifValue[0].toUpperCase() : 'J');

            pool.query(
                'INSERT INTO proveedores (tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [tipoDocumento, rifValue, proveedorData.razon_social, proveedorData.direccion, proveedorData.telefono, tipoContribuyente],
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results.rows[0]);
                    }
                }
            );
        });
    },

    editProveedor(id, campo, valor) {
        return new Promise((resolve, reject) => {
            pool.query(`UPDATE proveedores SET ${campo} = $1 WHERE id = $2 RETURNING *`, [valor, id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.rows[0] || null);
                }
            });
        });
    },

    getProveedorByName(razon_social) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.rows[0] || null);
                }
            });
        });
    },

    getProveedorByNameOrRif(razon_social, rif) {
        return new Promise((resolve, reject) => {
            if (rif) {
                pool.query('SELECT * FROM proveedores WHERE rif = $1 LIMIT 1', [rif], (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    if (results.rows && results.rows[0]) {
                        return resolve(results.rows[0]);
                    }

                    pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error2, results2) => {
                        if (error2) {
                            reject(error2);
                        } else {
                            resolve(results2.rows[0] || null);
                        }
                    });
                });
            } else {
                pool.query('SELECT * FROM proveedores WHERE razon_social ILIKE $1 LIMIT 1', [razon_social], (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results.rows[0] || null);
                    }
                });
            }
        });
    }
};

module.exports = proveedoresModel;
