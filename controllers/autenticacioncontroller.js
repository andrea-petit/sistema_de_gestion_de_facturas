/// Controlador de Autenticación y Recuperación de Claves
const { enviarCorreoRecuperacion } = require('../utils/emailService');
const pool = require('../config/bd'); 

// 1. Función para registrar un usuario nuevo (Lógica de tus compañeros)
const registrarUsuario = async (req, res) => {
  try {
    const { nombre, correo, contrasena } = req.body;
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ ok: false, msg: 'Por favor, llena todos los campos necesarios.' });
    }
    return res.status(201).json({ ok: true, msg: '¡Usuario registrado con éxito total!', usuario: { nombre, correo } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, msg: 'Hubo un error en el servidor al registrar.' });
  }
};

// 2. Función para iniciar sesión (Login - Lógica de tus compañeros)
const ingresarUsuario = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
      return res.status(400).json({ ok: false, msg: 'Por favor, introduce correo y contraseña.' });
    }
    return res.status(200).json({ ok: true, msg: '¡Ingreso exitoso al sistema!', token: 'token-falso-de-prueba-12345' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, msg: 'Hubo un error en el servidor al ingresar.' });
  }
};

// ==========================================
// NUEVAS FUNCIONES PARA LA RECUPERACIÓN
// ==========================================

// 3. Solicitar código de recuperación
const solicitarRecuperacion = async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ ok: false, msg: 'Por favor, introduce tu correo electrónico.' });
    }

    // Verificar si el usuario existe en Postgres
    const usuarioExiste = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'El correo no está registrado en el sistema.' });
    }

    // Generar código aleatorio de 6 dígitos
    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Definir tiempo de expiración (Hora actual + 5 minutos)
    const tiempoExpiracion = new Date(Date.now() + 5 * 60 * 1000);

    // Guardar token y expiración en la base de datos
    await pool.query(
      'UPDATE usuarios SET token_recuperacion = $1, token_expiracion = $2 WHERE correo = $3',
      [codigoVerificacion, tiempoExpiracion, correo]
    );

    // Enviar el email usando nuestro helper de utils
    const correoEnviado = await enviarCorreoRecuperacion(correo, codigoVerificacion);

    if (correoEnviado) {
      return res.status(200).json({ ok: true, msg: 'Código de verificación enviado al correo exitosamente.' });
    } else {
      return res.status(500).json({ ok: false, msg: 'Error al enviar el correo electrónico de recuperación.' });
    }
  } catch (error) {
    console.error('Error en solicitarRecuperacion:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

// 4. Verificar código introducido por el usuario
const verificarCodigo = async (req, res) => {
  try {
    const { correo, codigo } = req.body;
    if (!correo || !codigo) {
      return res.status(400).json({ ok: false, msg: 'El correo y el código son obligatorios.' });
    }

    // Buscar al usuario y su token
    const resultado = await pool.query(
      'SELECT token_recuperacion, token_expiracion FROM usuarios WHERE correo = $1',
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
    }

    const { token_recuperacion, token_expiracion } = resultado.rows[0];

    // Validar si el código coincide
    if (token_recuperacion !== codigo) {
      return res.status(400).json({ ok: false, msg: 'El código introducido es incorrecto.' });
    }

    // Validar si ya expiró
    if (new Date() > new Date(token_expiracion)) {
      return res.status(400).json({ ok: false, msg: 'El código ha expirado. Solicita uno nuevo.' });
    }

    return res.status(200).json({ ok: true, msg: 'Código verificado correctamente. Puedes cambiar tu contraseña.' });
  } catch (error) {
    console.error('Error en verificarCodigo:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

// 5. Cambiar la contraseña en la base de datos
const cambiarContrasena = async (req, res) => {
  try {
    const { correo, codigo, nuevaContrasena } = req.body;
    if (!correo || !codigo || !nuevaContrasena) {
      return res.status(400).json({ ok: false, msg: 'Todos los campos son obligatorios.' });
    }

    // Volvemos a verificar el token por seguridad antes de cambiar nada
    const resultado = await pool.query(
      'SELECT token_recuperacion, token_expiracion FROM usuarios WHERE correo = $1',
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
    }

    const { token_recuperacion, token_expiracion } = resultado.rows[0];

    if (token_recuperacion !== codigo || new Date() > new Date(token_expiracion)) {
      return res.status(400).json({ ok: false, msg: 'Acción no autorizada o código vencido.' });
    }

    // Guardar la nueva contraseña de forma directa
    await pool.query(
      'UPDATE usuarios SET contrasena_hash = $1, token_recuperacion = NULL, token_expiracion = NULL WHERE correo = $2',
      [nuevaContrasena, correo]
    );

    return res.status(200).json({ ok: true, msg: 'Contraseña actualizada con éxito total.' });
  } catch (error) {
    console.error('Error en cambiarContrasena:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

// Exportamos todas las funciones para las rutas
module.exports = {
  registrarUsuario,
  ingresarUsuario,
  solicitarRecuperacion,
  verificarCodigo,
  cambiarContrasena
};