const express = require('express');
const router = express.Router();

// Importamos la función que lee tu base de datos de usuarios
const { ingresarUsuario } = require('../controllers/logincontroller');

// Definimos la ruta raíz de este archivo para el inicio de sesión
router.post('/', ingresarUsuario);

// Exportamos el enrutador
module.exports = router;