const express = require('express');
const router = express.Router();

// Importamos el controlador que acabas de crear (el cerebro)
const { registrarUsuario, ingresarUsuario } = require('../controllers/autenticacioncontroller');

// 1. Ruta para registrar un usuario nuevo
// Ahora, en vez de mandar un texto simple, llama a la funcion del controlador
router.post('/registro', registrarUsuario);

// 2. Ruta para iniciar sesion (Login)
// Aqui tambien llama a la funcion correspondiente del controlador
router.post('/ingreso', ingresarUsuario);

// Exportamos las rutas para que app.js las pueda usar
module.exports = router;
