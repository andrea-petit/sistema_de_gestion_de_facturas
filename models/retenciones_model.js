const pool = require('../config/bd');

const retencionesModel = {
    getAllRetenciones() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM comprobante_retencion', (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    createRetencion(retencionData) {
        return new Promise((resolve, reject) => {
            pool.query('INSERT INTO comprobante_retencion (proveedor_id, numero_comprobante, fecha_emision, periodo_fiscal) VALUES ($1, $2, $3, $4) RETURNING *', [retencionData.proveedor_id, retencionData.numero_comprobante, retencionData.fecha_emision, retencionData.periodo_fiscal], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    getRetencionById(id) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM comprobante_retencion WHERE id = $1', [id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    getRetencionByComprobante(numero_comprobante) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM comprobante_retencion WHERE numero_comprobante = $1', [numero_comprobante], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    }

};

module.exports = retencionesModel;