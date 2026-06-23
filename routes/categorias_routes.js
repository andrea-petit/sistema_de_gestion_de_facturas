const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categoriasController');

// 1. Rutas analíticas (Resumen general y desglose por ID)
router.get('/resumen', categoriasController.obtenerResumenGastos);
router.get('/:id/gastos', categoriasController.obtenerGastosPorCategoria);

// 2. Rutas CRUD de apoyo
router.get('/', categoriasController.listarCategorias);
router.post('/', categoriasController.crearNuevaCategoria);

module.exports = router;