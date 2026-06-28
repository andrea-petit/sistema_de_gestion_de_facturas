const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categoriasController');
const { sanitizarPeticion } = require('../middleware/sanitizer.js');

// 1. Rutas analíticas (Resumen general y desglose por ID)
router.get('/resumen', categoriasController.obtenerResumenGastos);
router.get('/:id/gastos', categoriasController.obtenerGastosPorCategoria);

// 2. Rutas CRUD de apoyo
router.get('/', categoriasController.listarCategorias);
router.post('/', sanitizarPeticion, categoriasController.crearNuevaCategoria);

module.exports = router;