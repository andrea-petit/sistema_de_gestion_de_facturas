/// Controlador de Autenticación y Recuperación de Claves
const bcrypt = require('bcrypt');
const { enviarCorreoRecuperacion } = require('../utils/emailService');
const userModel = require('../models/user_model');

const registrarUsuario = async (req, res) => {
  try {
    const { nombre, correo, contrasena } = req.body;
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ ok: false, msg: 'Por favor, llena todos los campos necesarios.' });
    }

    const usuarioExiste = await userModel.getUserByCorreo(correo);
    if (usuarioExiste.rows.length > 0) {
      return res.status(409).json({ ok: false, msg: 'El correo ya está registrado en el sistema.' });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    const nuevoUsuario = await userModel.createUser({
      nombre_usuario: nombre,
      contraseña_hash: contrasenaHash,
      nombre_completo: nombre,
      rol: 'empleado',
      correo
    });

    return res.status(201).json({ ok: true, msg: 'Usuario registrado con éxito.', usuario: nuevoUsuario.rows[0] });
  } catch (error) {
    console.error('Error en registrarUsuario:', error);
    return res.status(500).json({ ok: false, msg: 'Hubo un error en el servidor al registrar.' });
  }
};

const ingresarUsuario = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
      return res.status(400).json({ ok: false, msg: 'Por favor, introduce correo y contraseña.' });
    }

    const usuarioExiste = await userModel.getUserByCorreo(correo);
    if (usuarioExiste.rows.length === 0) {
      return res.status(401).json({ ok: false, msg: 'Usuario o contraseña incorrectos.' });
    }

    const usuarioDB = usuarioExiste.rows[0];
    const passwordValido = await bcrypt.compare(contrasena, usuarioDB.contraseña_hash);
    if (!passwordValido) {
      return res.status(401).json({ ok: false, msg: 'Usuario o contraseña incorrectos.' });
    }

    if (req && req.session) {
      req.session.user = {
        id: usuarioDB.id,
        nombre: usuarioDB.nombre_usuario,
        nombre_completo: usuarioDB.nombre_completo,
        rol: usuarioDB.rol,
        correo: usuarioDB.correo
      };
      req.session.userId = usuarioDB.id;
      req.session.userNombre = usuarioDB.nombre_usuario;
      req.session.userCompleto = usuarioDB.nombre_completo;
      req.session.userRol = usuarioDB.rol;
    }

    return res.status(200).json({ ok: true, msg: 'Ingreso exitoso al sistema.', token: req.sessionID });
  } catch (error) {
    console.error('Error en ingresarUsuario:', error);
    return res.status(500).json({ ok: false, msg: 'Hubo un error en el servidor al ingresar.' });
  }
};

const solicitarRecuperacion = async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ ok: false, msg: 'Por favor, introduce tu correo electrónico.' });
    }

    const usuarioExiste = await userModel.getUserByCorreo(correo);
    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'El correo no está registrado en el sistema.' });
    }

    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    const tiempoExpiracion = new Date(Date.now() + 5 * 60 * 1000);

    await userModel.setRecoveryToken(correo, codigoVerificacion, tiempoExpiracion);

    const correoEnviado = await enviarCorreoRecuperacion(correo, codigoVerificacion);
    if (!correoEnviado) {
      return res.status(500).json({ ok: false, msg: 'Error al enviar el correo electrónico de recuperación.' });
    }

    return res.status(200).json({ ok: true, msg: 'Código de verificación enviado al correo exitosamente.' });
  } catch (error) {
    console.error('Error en solicitarRecuperacion:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

const verificarCodigo = async (req, res) => {
  try {
    const { correo, codigo } = req.body;
    if (!correo || !codigo) {
      return res.status(400).json({ ok: false, msg: 'El correo y el código son obligatorios.' });
    }

    const resultado = await userModel.getRecoveryTokenData(correo);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
    }

    const { token_recuperacion, token_expiracion } = resultado.rows[0];
    if (token_recuperacion !== codigo) {
      return res.status(400).json({ ok: false, msg: 'El código introducido es incorrecto.' });
    }

    if (new Date() > new Date(token_expiracion)) {
      return res.status(400).json({ ok: false, msg: 'El código ha expirado. Solicita uno nuevo.' });
    }

    return res.status(200).json({ ok: true, msg: 'Código verificado correctamente. Puedes cambiar tu contraseña.' });
  } catch (error) {
    console.error('Error en verificarCodigo:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

const cambiarContrasena = async (req, res) => {
  try {
    const { correo, codigo, nuevaContrasena } = req.body;
    if (!correo || !codigo || !nuevaContrasena) {
      return res.status(400).json({ ok: false, msg: 'Todos los campos son obligatorios.' });
    }

    const resultado = await userModel.getRecoveryTokenData(correo);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
    }

    const { token_recuperacion, token_expiracion } = resultado.rows[0];
    if (token_recuperacion !== codigo) {
      return res.status(400).json({ ok: false, msg: 'El código introducido es incorrecto.' });
    }

    if (new Date() > new Date(token_expiracion)) {
      return res.status(400).json({ ok: false, msg: 'El código ha expirado. Solicita uno nuevo.' });
    }

    const nuevaHash = await bcrypt.hash(nuevaContrasena, 10);
    await userModel.updatePasswordByCorreo(correo, nuevaHash);

    return res.status(200).json({ ok: true, msg: 'Contraseña actualizada con éxito total.' });
  } catch (error) {
    console.error('Error en cambiarContrasena:', error);
    return res.status(500).json({ ok: false, msg: 'Error interno en el servidor.' });
  }
};

module.exports = {
  registrarUsuario,
  ingresarUsuario,
  solicitarRecuperacion,
  verificarCodigo,
  cambiarContrasena
};