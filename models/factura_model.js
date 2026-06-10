const pool = require('../config/bd');
const empresaModel = require('./empresa_model');

const facturaModel = {
    calculateImpuestos(facturaData) {
        const montoTotal = Number(facturaData.monto_total || 0.00);
        const montoExento = Number(facturaData.monto_exento || 0.00);
        const montoAfectoIva = Number(facturaData.monto_afecto_iva || 0.00);
        const montoIva = Number(facturaData.monto_iva || 0.00);

        let baseImponible = montoAfectoIva;
        let ivaCalculado = montoIva;

        if (baseImponible <= 0 && montoIva > 0) {
            baseImponible = Number((montoIva / 0.16).toFixed(2));
        }

        if (baseImponible <= 0 && montoTotal > 0) {
            if (montoExento >= montoTotal) {
                baseImponible = 0.00;
                ivaCalculado = 0.00;
            } else {
                baseImponible = Number(Math.max(0, montoTotal - montoExento).toFixed(2));
                ivaCalculado = Number((baseImponible * 0.16).toFixed(2));
            }
        }

        if (montoExento >= montoTotal) {
            baseImponible = 0.00;
            ivaCalculado = 0.00;
        }

        return {
            porcentaje_alicuota: 16.00,
            base_imponible: baseImponible,
            monto_iva: ivaCalculado,
            porcentaje_retencion: Number(facturaData.porcentaje_retencion || 0.00),
            monto_retencion: Number(facturaData.monto_retencion || 0.00)
        };
    },

    createCompraImpuesto(compraId, impuestoData) {
        return new Promise((resolve, reject) => {
            const queryText = 'INSERT INTO compra_impuestos (compra_id, porcentaje_alicuota, base_imponible, monto_iva, porcentaje_retencion, monto_retencion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
            const queryValues = [
                compraId,
                impuestoData.porcentaje_alicuota,
                impuestoData.base_imponible,
                impuestoData.monto_iva,
                impuestoData.porcentaje_retencion,
                impuestoData.monto_retencion
            ];

            pool.query(queryText, queryValues, (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows && results.rows[0] ? results.rows[0] : null);
            });
        });
    },

    createFactura(facturaData) {
        return new Promise((resolve, reject) => {
            const self = this;
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
                                const compraCreada = results.rows && results.rows[0] ? results.rows[0] : null;
                                if (!compraCreada) {
                                    return reject(new Error('No se pudo crear la compra')); 
                                }

                                const impuestoData = self.calculateImpuestos(facturaData);
                                self.createCompraImpuesto(compraCreada.id, impuestoData)
                                    .then(() => resolve(compraCreada))
                                    .catch((impuestoError) => reject(impuestoError));
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

    getFacturaByProveedorAndNumero(proveedorId, numeroFactura) {
        return new Promise((resolve, reject) => {
            pool.query(
                'SELECT * FROM compras WHERE proveedor_id = $1 AND numero_factura = $2 LIMIT 1',
                [proveedorId, numeroFactura],
                (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(results.rows && results.rows[0] ? results.rows[0] : null);
                }
            );
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
