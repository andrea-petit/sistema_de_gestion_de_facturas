const historialModel = require('../models/historial_model');

const historialController = {
    async obtenerHistorialPaginado(req, res) {
        try {
            // Capturamos los query parameters de la URL, por ejemplo: /api/historial?page=1&limit=10
            const pagina = parseInt(req.query.page, 10) || 1;
            const limite = parseInt(req.query.limit, 10) || 10; // Puedes cambiar el default a 15 si prefieres

            // Ejecutamos ambas consultas en paralelo para mejorar el rendimiento
            const [registros, totalRegistros] = await Promise.all([
                historialModel.getHistorial(pagina, limite),
                historialModel.getContadorHistorial()
            ]);

            const totalPaginas = Math.ceil(totalRegistros / limite);

            return res.status(200).json({
                mensaje: "Historial de auditoría recuperado",
                data: registros,
                paginacion: {
                    totalRegistros,
                    totalPaginas,
                    paginaActual: pagina,
                    limite
                }
            });
        } catch (error) {
            console.error("Error en controlador de historial:", error);
            return res.status(500).json({ error: error.message });
        }
    }
};

module.exports = historialController;