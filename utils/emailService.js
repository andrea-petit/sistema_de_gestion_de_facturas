const nodemailer = require('nodemailer');

/**
 * Función útil para enviar el correo con el código de recuperación
 * @param {string} correoUsuario - El correo de la persona que olvidó la clave
 * @param {string} codigoVerificacion - El número aleatorio de 6 dígitos
 */
const enviarCorreoRecuperacion = async (correoUsuario, codigoVerificacion) => {
  try {
    // 1. Configuración del transportador conectado a tu cuenta del sistema
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'recuperaciondeclavedeusuario@gmail.com', // El correo que acabas de crear
        pass: 'hhrvygxeztfwvxkc' // ¡Aquí pegas las 16 letras amarillas sin espacios!
      }
    });

   // 2. Estructura y diseño del mensaje
    const opcionesCorreo = {
      from: '"Sistema de Facturas" <recuperaciondeclavedeusuario@gmail.com>',
      to: correoUsuario, 
      subject: 'Verificación de Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333; text-align: center;">Control de Facturas</h2>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p>¡Hola!</p>
          <p>Has solicitado recuperar tu acceso al sistema. Tu código de verificación es:</p>
          <div style="text-align: center; margin: 25px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background-color: #f4f4f5; padding: 10px 20px; border-radius: 5px; border: 1px dashed #ccc; color: #007bff;">
              ${codigoVerificacion}
            </span>
          </div>
          <p style="color: #666; font-size: 0.9em; text-align: center;">Recuerda que tu código expira en 5 minutos.</p>
        </div>
      `
    };

    // 3. Enviar el correo final
    await transporter.sendMail(opcionesCorreo);
    return true;

  } catch (error) {
    console.error('Error crítico en emailService:', error);
    return false;
  }
};

module.exports = { enviarCorreoRecuperacion };