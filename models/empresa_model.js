const pool = require('../config/bd');

const empresaModel = {
    getEmpresa() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM empresa LIMIT 1', (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    updateEmpresa(campo, valor) {
        return new Promise((resolve, reject) => {
            pool.query(`UPDATE empresa SET ${campo} = $1 RETURNING *`, [valor], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    createEmpresa(empresaData) {
        return new Promise((resolve, reject) => {
            pool.query('INSERT INTO empresa (nombre, tipo_documento, rif, tipo_contribuyente, direccion, porcentaje_retencion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [empresaData.nombre, empresaData.tipo_documento, empresaData.rif, empresaData.tipo_contribuyente, empresaData.direccion, empresaData.porcentaje_retencion], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    getTipoContribuyente() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT tipo_contribuyente FROM empresa LIMIT 1', (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    const tipo = results.rows && results.rows[0] ? results.rows[0].tipo_contribuyente : null;
                    resolve(tipo);
                }
            });
        });
    }

};

module.exports = empresaModel;