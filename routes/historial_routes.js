const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const historialController = require('../controllers/historialController');

router.get('/historial', authMiddleware, historialController.obtenerHistorialPaginado);

module.exports = router;