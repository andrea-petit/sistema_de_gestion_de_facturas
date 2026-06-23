const categoriasModel = require("../models/categorias_model");

const categoriasController = {
    // GET /api/categorias/resumen
    async obtenerResumenGastos(req, res) {
        try {
            const resumen = await categoriasModel.getResumenGastos();
            
            // Calculamos el gran total acumulado para facilitar la maquetación de los porcentajes en la torta
            const granTotal = resumen.reduce((sum, item) => sum + parseFloat(item.total_bs), 0);

            return res.status(200).json({
                mensaje: "Resumen estadístico de gastos por categoría recuperado",
                granTotal,
                data: resumen
            });
        } catch (error) {
            console.error("Error en controlador de categorías (resumen):", error);
            return res.status(500).json({ error: error.message });
        }
    },

    // GET /api/categorias/:id/gastos
    // GET /api/categorias/:id/gastos
    async obtenerGastosPorCategoria(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: "El ID de la categoría es strictly requerido." });
            }

            // FORZAMOS EL CASTING A ENTERO AQUÍ
            const categoriaIdNumerico = parseInt(id, 10);

            // Control de auditoría en tu consola de Node
            console.log(`[SGAF - Categorías] Buscando gastos para ID recibido: "${id}" -> Convertido a entero: ${categoriaIdNumerico}`);

            if (isNaN(categoriaIdNumerico)) {
                return res.status(400).json({ error: "El ID proporcionado no es un número válido." });
            }

            const gastosDetalle = await categoriasModel.getGastosPorCategoria(categoriaIdNumerico);

            return res.status(200).json({
                mensaje: `Desglose de facturas recuperado para la categoría ID: ${categoriaIdNumerico}`,
                categoriaId: categoriaIdNumerico,
                data: gastosDetalle
            });
        } catch (error) {
            console.error("Error en controlador de categorías (gastos por categoría):", error);
            return res.status(500).json({ error: error.message });
        }
    },

    // GET /api/categorias
    async listarCategorias(req, res) {
        try {
            const categorias = await categoriasModel.getAllCategorias();
            
            return res.status(200).json({
                mensaje: "Listado completo de categorías recuperado",
                data: categorias
            });
        } catch (error) {
            console.error("Error en controlador de categorías (listar):", error);
            return res.status(500).json({ error: error.message });
        }
    },

    // POST /api/categorias
    async crearNuevaCategoria(req, res) {
        try {
            const { nombre } = req.body;

            if (!nombre || nombre.trim() === "") {
                return res.status(400).json({ error: "El nombre de la categoría no puede estar vacío." });
            }

            // Verificamos de forma preventiva si ya existe una categoría idéntica usando ILIKE
            const existe = await categoriasModel.getCategoriaByNombre(nombre.trim());
            if (existe) {
                return res.status(400).json({ 
                    error: `La categoría "${nombre}" ya se encuentra registrada en el sistema.` 
                });
            }

            const nuevaCategoria = await categoriasModel.createCategoria(nombre.trim());

            return res.status(201).json({
                mensaje: "Categoría registrada exitosamente",
                data: nuevaCategoria
            });
        } catch (error) {
            console.error("Error en controlador de categorías (crear):", error);
            return res.status(500).json({ error: error.message });
        }
    }
};

module.exports = categoriasController;