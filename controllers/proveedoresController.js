const proveedoresModel = require('../models/proveedores_model');
const historialModel = require('../models/historial_model');

const proveedoresController = {
    async getAllProveedores(req, res) {
        try {
            const proveedores = await proveedoresModel.getAllProveedores();
            res.status(200).json({ ok: true, data: proveedores });
        } catch (error) {
            console.error('Error fetching proveedores:', error);
            res.status(500).json({ ok: false, msg: 'Error fetching proveedores.' });
        }
    },

    async getProveedorById(req, res) {
        const { id } = req.params;
        try {
            const proveedor = await proveedoresModel.getProveedorById(id);
            if (!proveedor) {
                return res.status(404).json({ ok: false, msg: 'Proveedor not found.' });
            }
            res.status(200).json({ ok: true, data: proveedor });
        } catch (error) {
            console.error('Error fetching proveedor:', error);
            res.status(500).json({ ok: false, msg: 'Error fetching proveedor.' });
        }
    },

    async createProveedor(req, res) {
        const { tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente } = req.body;
        if (!razon_social || !direccion || !telefono) {
            return res.status(400).json({ ok: false, msg: 'Missing required fields.' });
        } 
        try {
            const newProveedor = await proveedoresModel.createProveedor({ tipo_documento, rif, razon_social, direccion, telefono, tipo_contribuyente });
            res.status(201).json({ ok: true, data: newProveedor });
        } catch (error) {
            console.error('Error creating proveedor:', error);
            res.status(500).json({ ok: false, msg: 'Error creating proveedor.' });
        }
    },

    async editProveedor(req, res) {
        const { id } = req.params;
        const { campo, valor } = req.body;
        if (!campo || !valor) {
            return res.status(400).json({ ok: false, msg: 'Missing required fields.' });
        }
        try {
            // Obtener el proveedor actual para registrar el valor anterior
            const proveedorActual = await proveedoresModel.getProveedorById(id);
            if (!proveedorActual) {
                return res.status(404).json({ ok: false, msg: 'Proveedor not found.' });
            }

            const valorAnterior = proveedorActual[campo] !== undefined && proveedorActual[campo] !== null
                ? String(proveedorActual[campo])
                : null;

            const updatedProveedor = await proveedoresModel.editProveedor(id, campo, valor);
            if (!updatedProveedor) {
                return res.status(500).json({ ok: false, msg: 'Error updating proveedor.' });
            }

            // Agregar registro al historial
            const historialEntry = {
                usuario_id: req && req.session ? (req.session.userId || null) : null,
                tabla_afectada: 'proveedores',
                registro_id: id,
                accion: 'update',
                valor_anterior: valorAnterior,
                valor_nuevo: valor !== undefined && valor !== null ? String(valor) : null
            };

            try {
                await historialModel.addHistorial(historialEntry);
            } catch (histError) {
                console.error('Error saving historial:', histError);
                // No bloquear la respuesta principal si falla el historial
            }

            res.status(200).json({ ok: true, data: updatedProveedor });
        } catch (error) {
            console.error('Error editing proveedor:', error);
            res.status(500).json({ ok: false, msg: 'Error editing proveedor.' });
        }
    },

};

module.exports = proveedoresController;

function normalizeRif(rif) {
    if (!rif) return null;
    const cleaned = rif.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleaned.length < 2) return null;
    return cleaned;
}

