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

        const porcentajeRetencion = Number.isFinite(Number(facturaData.porcentaje_retencion))
            ? Number(facturaData.porcentaje_retencion)
            : 0.00;

        let montoRetencion = 0.00;
        if (porcentajeRetencion > 0 && ivaCalculado > 0) {
            montoRetencion = Number((ivaCalculado * porcentajeRetencion / 100).toFixed(2));
        }

        return {
            porcentaje_alicuota: 16.00,
            base_imponible: baseImponible,
            monto_iva: ivaCalculado,
            porcentaje_retencion: Number(porcentajeRetencion.toFixed(2)),
            monto_retencion: montoRetencion
        };
    },

    normalizeRetencionPorcentaje(porcentajeRetencion) {
        const valor = Number(porcentajeRetencion || 0);
        return Number.isFinite(valor) ? Number(valor.toFixed(2)) : 0.00;
    },

    isValidRetentionSelection(porcentajeRetencion) {
        return Number.isFinite(porcentajeRetencion) && porcentajeRetencion >= 1 && porcentajeRetencion <= 5;
    },

    getCompraImpuestosByCompraId(compraId) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM compra_impuestos WHERE compra_id = $1', [compraId], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    },

    createRetencionFromFactura(compraId, porcentajeRetencion) {
        return new Promise(async (resolve, reject) => {
            try {
                const porcentaje = Number(porcentajeRetencion);
                if (!this.isValidRetentionSelection(porcentaje)) {
                    return reject(new Error('El porcentaje de retención debe ser un valor entre 1 y 5')); 
                }

                const impuestos = await this.getCompraImpuestosByCompraId(compraId);
                if (!impuestos || impuestos.length === 0) {
                    return reject(new Error('No se encontró información de impuestos para esta factura')); 
                }

                const impuestoBase = impuestos.find((item) => Number(item.porcentaje_retencion) === 0) || impuestos[0];
                const montoIva = Number(impuestoBase.monto_iva || 0.00);
                if (montoIva <= 0) {
                    return reject(new Error('No hay monto de IVA disponible para generar retención')); 
                }

                const montoRetencion = Number((montoIva * porcentaje / 100).toFixed(2));
                const queryText = 'INSERT INTO compra_impuestos (compra_id, porcentaje_alicuota, base_imponible, monto_iva, porcentaje_retencion, monto_retencion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
                const queryValues = [
                    compraId,
                    impuestoBase.porcentaje_alicuota,
                    impuestoBase.base_imponible,
                    impuestoBase.monto_iva,
                    porcentaje,
                    montoRetencion
                ];

                pool.query(queryText, queryValues, (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(results.rows && results.rows[0] ? results.rows[0] : null);
                });
            } catch (error) {
                reject(error);
            }
        });
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

                            const porcentajeRetencionUsuario = self.normalizeRetencionPorcentaje(facturaData.porcentaje_retencion);
                            if (tipoContribuyente === 'Ordinario') {
                                facturaData.porcentaje_retencion = self.isValidRetentionSelection(porcentajeRetencionUsuario)
                                    ? porcentajeRetencionUsuario
                                    : 0.00;
                            } else {
                                facturaData.porcentaje_retencion = 75.00;
                            }

                            const queryValues = tipoContribuyente === 'Ordinario'
                                ? [facturaData.proveedor_id, facturaData.fecha_emision, facturaData.numero_factura, facturaData.numero_control, facturaData.monto_total, facturaData.categoria, facturaData.img_url]
                                : [facturaData.proveedor_id, facturaData.comprobante_retencion || null, facturaData.fecha_emision, facturaData.numero_factura, facturaData.numero_control, facturaData.monto_total, facturaData.categoria, facturaData.img_url];

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

    updateFacturaById(id, updateData) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updateData);
            if (fields.length === 0) {
                return resolve(null);
            }

            const setClauses = fields.map((campo, index) => `${campo} = $${index + 1}`).join(', ');
            const values = fields.map(campo => updateData[campo]);
            values.push(id);

            const query = `UPDATE compras SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
            pool.query(query, values, (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows && results.rows[0] ? results.rows[0] : null);
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
    },

    getFacturasByFechaEmision(fechaEmision) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT c.*, p.razon_social AS proveedor_nombre 
                FROM compras c
                LEFT JOIN proveedores p ON c.proveedor_id = p.id
                WHERE c.fecha_emision::date = $1::date
            `;
            pool.query(query, [fechaEmision], (error, results) => {
                if (error) {
                    return reject(error);
                }
                resolve(results.rows);
            });
        });
    }
        

};

module.exports = facturaModel;
