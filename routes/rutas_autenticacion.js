const express = require('express');
const router = express.Router();

// Importamos el controlador con las funciones de autenticación y recuperación
const { 
  registrarUsuario, 
  ingresarUsuario,
  solicitarRecuperacion,
  verificarCodigo,
  cambiarContrasena
} = require('../controllers/autenticacioncontroller');

// 1. Ruta para registrar un usuario nuevo
router.post('/registro', registrarUsuario);

// 2. Ruta para iniciar sesion (Login)
router.post('/ingreso', ingresarUsuario);

// ==========================================
// RUTAS NUEVAS PARA LA RECUPERACIÓN DE CLAVE
// ==========================================

// 3. Ruta para solicitar el código (Al presionar el botón de "Recuperar contraseña")
router.post('/solicitar-recuperacion', solicitarRecuperacion);

// 4. Ruta para validar los 6 dígitos que le llegaron al usuario
router.post('/verificar-codigo', verificarCodigo);

// 5. Ruta para guardar la contraseña nueva modificada
router.post('/cambiar-contrasena', cambiarContrasena);

// Exportamos las rutas para que app.js las pueda usar
module.exports = router;