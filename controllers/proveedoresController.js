const proveedoresModel = require('../models/proveedores_model');
const historialModel = require('../models/historial_model');

// Función interna idéntica a la del modelo para asegurar consistencia en el historial
function normalizeRif(rif) {
    if (!rif) return null;
    let cleaned = rif.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length > 1 && cleaned[0] === cleaned[1] && /[A-Z]/.test(cleaned[0])) {
        cleaned = cleaned.substring(1);
    }
    return cleaned;
}

const proveedoresController = {
    /**
     * Obtiene los proveedores aplicando paginación dinámica si vienen parámetros en la URL,
     * de lo contrario, mantiene la compatibilidad devolviendo la lista completa.
     */
    async getAllProveedores(req, res) {
        try {
            // Capturamos parámetros opcionales de paginación (Ej: ?page=1&limit=10)
            const page = parseInt(req.query.page, 10);
            const limit = parseInt(req.query.limit, 10);

            if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
                const offset = (page - 1) * limit;
                
                // Consumimos el nuevo método preparado en el modelo
                const { registros, totalAbsoluto } = await proveedoresModel.getProveedoresPaginados(limit, offset);
                
                return res.status(200).json({ 
                    ok: true, 
                    data: registros,
                    paginacion: {
                        totalRegistros: totalAbsoluto,
                        paginasTotales: Math.ceil(totalAbsoluto / limit),
                        paginaActual: page,
                        limitePorPagina: limit
                    }
                });
            }

            // Fallback: Si no se envían parámetros, devuelve todo el universo de proveedores (compatibilidad)
            const proveedores = await proveedoresModel.getAllProveedores();
            return res.status(200).json({ ok: true, data: proveedores });

        } catch (error) {
            console.error('Error fetching proveedores:', error);
            return res.status(500).json({ ok: false, msg: 'Error al procesar el listado de proveedores.' });
        }
    },

    async getProveedorById(req, res) {
        const { id } = req.params;
        try {
            const proveedor = await proveedoresModel.getProveedorById(id);
            if (!proveedor) {
                return res.status(404).json({ ok: false, msg: 'Proveedor no encontrado.' });
            }
            return res.status(200).json({ ok: true, data: proveedor });
        } catch (error) {
            console.error('Error fetching proveedor:', error);
            return res.status(500).json({ ok: false, msg: 'Error al obtener el proveedor solicitado.' });
        }
    },

    async createProveedor(req, res) {
        const { tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente } = req.body;
        if (!razon_social || !direccion || !telefono) {
            return res.status(400).json({ ok: false, msg: 'Faltan campos obligatorios para registrar el proveedor.' });
        } 
        try {
            const newProveedor = await proveedoresModel.createProveedor({ tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente });
            return res.status(201).json({ ok: true, data: newProveedor });
        } catch (error) {
            console.error('Error creating proveedor:', error);
            return res.status(500).json({ ok: false, msg: 'Error interno al registrar el nuevo proveedor.' });
        }
    },

    async editProveedor(req, res) {
        const { id } = req.params;
        // Recepción del payload completo
        const { rif, razon_social, direccion, telefono, tipo_contribuyente } = req.body;

        try {
            // 1. Obtener el estado previo para la foto de auditoría
            const proveedorActual = await proveedoresModel.getProveedorById(id);
            if (!proveedorActual) {
                return res.status(404).json({ ok: false, msg: 'El proveedor no existe.' });
            }

            // 2. Ejecutar la actualización masiva de todos los campos en un solo query
            // NOTA: Asegúrate de tener este método masivo en tu modelo o adáptalo.
            const updatedProveedor = await proveedoresModel.updateProveedorCompleto(id, {
                rif, razon_social, direccion, telefono, tipo_contribuyente
            });

            if (!updatedProveedor) {
                return res.status(500).json({ ok: false, msg: 'Error al actualizar las columnas en la base de datos.' });
            }

            // 3. Estructurar auditoría limpia en un único registro JSON
            const estadoAnterior = {
                rif: proveedorActual.rif,
                razon_social: proveedorActual.razon_social,
                direccion: proveedorActual.direccion,
                telefono: proveedorActual.telefono,
                tipo_contribuyente: proveedorActual.tipo_contribuyente
            };

            const estadoNuevo = {
                rif: updatedProveedor.rif,
                razon_social: updatedProveedor.razon_social,
                direccion: updatedProveedor.direccion,
                telefono: updatedProveedor.telefono,
                tipo_contribuyente: updatedProveedor.tipo_contribuyente
            };

            const historialEntry = {
                usuario_id: req && req.session ? (req.session.userId || null) : null,
                tabla_afectada: 'proveedores',
                registro_id: id,
                accion: 'UPDATE',
                valor_anterior: JSON.stringify(estadoAnterior), // JSON estructurado perfecto
                valor_nuevo: JSON.stringify(estadoNuevo)       // JSON estructurado perfecto
            };

            try {
                await historialModel.addHistorial(historialEntry);
            } catch (histError) {
                console.error('Error al registrar bloque único en el historial:', histError);
            }

            return res.status(200).json({ ok: true, data: updatedProveedor });
        } catch (error) {
            console.error('Error editing proveedor:', error);
            return res.status(500).json({ ok: false, msg: 'Error interno en el procesamiento unificado.' });
        }
    }
};

module.exports = proveedoresController;