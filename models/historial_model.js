const pool = require('../config/bd');

const historialModel = {
    getHistorial() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM historial_cambios LIMIT 20 ORDER BY fecha DESC', (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results);
            });
        });
    },

    addHistorial(historialData) {
        return new Promise((resolve, reject) => {
            try {
                pool.query('INSERT INTO historial_cambios (usuario_id, tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo) VALUES ($1, $2, $3, $4, $5, $6)', [historialData.usuario_id, historialData.tabla_afectada, historialData.registro_id, historialData.accion, historialData.valor_anterior, historialData.valor_nuevo], (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(results);
                });
            } catch (error) {
                reject(error);
            }
        });
    }
};

module.exports = historialModel;