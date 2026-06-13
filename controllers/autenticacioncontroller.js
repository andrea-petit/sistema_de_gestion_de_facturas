// Controlador de Autenticación Temporal para pruebas

// 1. Función para registrar un usuario nuevo
const registrarUsuario = async (req, res) => {
    try {
        const { nombre, correo, contrasena } = req.body;

        // Validación básica de que lleguen los datos
        if (!nombre || !correo || !contrasena) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Por favor, llena todos los campos necesarios.' 
            });
        }

        // Si todo sale bien, respondemos con éxito
        return res.status(201).json({
            ok: true,
            msg: '¡Usuario registrado con éxito total!',
            usuario: { nombre, correo }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: 'Hubo un error en el servidor al registrar.'
        });
    }
};

// 2. Función para iniciar sesión (Login)
const ingresarUsuario = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Por favor, introduce correo y contraseña.' 
            });
        }

        return res.status(200).json({
            ok: true,
            msg: '¡Ingreso exitoso al sistema!',
            token: 'token-falso-de-prueba-12345'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: 'Hubo un error en el servidor al ingresar.'
        });
    }
};

// Exportamos las funciones para que las rutas las puedan importar
module.exports = {
    registrarUsuario,
    ingresarUsuario
};