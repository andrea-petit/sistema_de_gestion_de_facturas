const pool = require('../config/bd');

const historialModel = {
    getHistorial(pagina = 1, limite = 10) {
        return new Promise((resolve, reject) => {
            // Calculamos cuántos registros saltarnos
            // Página 1: (1 - 1) * 10 = 0 saltos
            // Página 2: (2 - 1) * 10 = 10 saltos
            const offset = (pagina - 1) * limite;

            const query = `
                SELECT 
                    h.id,
                    h.tabla_afectada,
                    h.registro_id,
                    h.accion,
                    h.valor_anterior,
                    h.valor_nuevo,
                    h.fecha_hora AS fecha,
                    COALESCE(u.nombre_completo, u.nombre_usuario) AS usuario_nombre,
                    NULL::text AS usuario_email
                FROM historial_cambios h
                LEFT JOIN usuarios u ON h.usuario_id = u.id
                ORDER BY h.fecha_hora DESC
                LIMIT $1 OFFSET $2
            `;

            pool.query(query, [limite, offset], (error, results) => {
                if (error) {
                    return reject(error);
                }
                // En PostgreSQL con el paquete 'pg', los datos vienen en results.rows
                resolve(results.rows || results); 
            });
        });
    },

    // FUNCIÓN AUXILIAR: Necesaria para saber cuántas páginas totales existen en la interfaz
    getContadorHistorial() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT COUNT(*) AS total FROM historial_cambios', (error, results) => {
                if (error) return reject(error);
                const total = results.rows ? results.rows[0].total : results[0].total;
                resolve(parseInt(total, 10));
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