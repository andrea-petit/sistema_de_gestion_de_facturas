const empresaModel = require('../models/empresa_model');

const empresaController = {
    async getEmpresa(req, res) {
        try {
            const result = await empresaModel.getEmpresa();
            if (result.rows.length === 0) {
                return res.status(200).json({ ok: true, data: null, msg: 'No hay perfil de empresa registrado.' });
            }
            res.status(200).json({ ok: true, data: result.rows[0] });
        } catch (error) {
            console.error('Error al obtener perfil de empresa:', error);
            res.status(500).json({ ok: false, msg: 'Error al obtener el perfil de la empresa.' });
        }
    },

   async createEmpresa(req, res) {
        const operadorRol = req.session?.userRol;

        // BARRERA DE SEGURIDAD MÁXIMA
        if (operadorRol !== 'superadmin') {
            return res.status(403).json({ 
                ok: false, 
                msg: 'Acceso denegado. Solo el Superusuario técnico puede inicializar el perfil empresarial.' 
            });
        }

        const { nombre, tipo_documento, rif, tipo_contribuyente, direccion, porcentaje_retencion } = req.body;
        
        // Validación de campos obligatorios en el controlador
        if (!nombre || !tipo_documento || !rif || !tipo_contribuyente || !direccion) {
            return res.status(400).json({ ok: false, msg: 'Faltan campos obligatorios para el registro.' });
        }

        try {
            // UNIFICACIÓN CON TU MODELO: Verificamos si ya existe la empresa usando tu query nativa
            const empresaExistente = await empresaModel.getEmpresa();
            
            if (empresaExistente && empresaExistente.rows && empresaExistente.rows.length > 0) {
                return res.status(400).json({ 
                    ok: false, 
                    msg: 'Ya existe una empresa registrada en el sistema. El perfil ya se encuentra inicializado.' 
                });
            }

            // Inserción directa en PostgreSQL mediante tu modelo
            const nuevaEmpresa = await empresaModel.createEmpresa({
                nombre, 
                tipo_documento, 
                rif, 
                tipo_contribuyente, 
                direccion, 
                porcentaje_retencion: parseFloat(porcentaje_retencion) || 0.00
            });

            // Respuesta exitosa al frontend
            return res.status(201).json({ 
                ok: true, 
                data: nuevaEmpresa.rows[0] 
            });

        } catch (error) {
            console.error('Error crítico al inicializar empresa:', error);
            // Evitamos que la conexión colapse enviando siempre una respuesta estructurada
            return res.status(500).json({ 
                ok: false, 
                msg: 'Error interno en el servidor al registrar el perfil de la empresa.' 
            });
        }
    },

    async updateEmpresa(req, res) {
        const operadorRol = req.session?.userRol;

        if (operadorRol !== 'superadmin') {
            return res.status(403).json({ ok: false, msg: 'Acceso denegado. No posee privilegios técnicos para alterar la configuración fiscal de la empresa.' });
        }

        const { campo, valor } = req.body;
        if (!campo || valor === undefined) {
            return res.status(400).json({ ok: false, msg: 'Faltan parámetros requeridos (campo o valor).' });
        }

        const camposPermitidos = ['nombre', 'tipo_documento', 'rif', 'tipo_contribuyente', 'direccion', 'porcentaje_retencion'];
        if (!camposPermitidos.includes(campo.trim().toLowerCase())) {
            return res.status(400).json({ ok: false, msg: 'Intento de modificación de columna no válida o inexistente.' });
        }

        try {
            const empresaActualizada = await empresaModel.updateEmpresa(campo, valor);
            if (empresaActualizada.rows.length === 0) {
                return res.status(404).json({ ok: false, msg: 'No se encontró el registro de la empresa para modificar.' });
            }
            res.status(200).json({ ok: true, data: empresaActualizada.rows[0] });
        } catch (error) {
            console.error('Error al actualizar campo de la empresa:', error);
            res.status(500).json({ ok: false, msg: 'Error interno al actualizar el perfil.' });
        }
    }
};

module.exports = empresaController;