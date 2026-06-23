const pool = require('../config/bd'); 

const ingresarUsuario = async (req, res) => {
    try {
        const { nombre, contrasena } = req.body;

        if (!nombre || !contrasena) {
            return res.status(400).json({ ok: false, msg: 'Introduce usuario y contraseña.' });
        }

        // 1. Buscamos al usuario en la base de datos
        const consulta = 'SELECT * FROM usuarios WHERE nombre_usuario = $1';
        const resultado = await pool.query(consulta, [nombre]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ ok: false, msg: 'Usuario o contraseña incorrectos.' });
        }

        const usuarioDB = resultado.rows[0];

        // 2. COMPARACIÓN DIRECTA: Texto limpio contra texto limpio
        // Nota: Si tu columna en Supabase termina en 'n', cámbialo a usuarioDB.contrasena_hash
        if (contrasena !== usuarioDB.contraseña_hash) {
            return res.status(401).json({ ok: false, msg: 'Usuario o contraseña incorrectos.' });
        }

        // 3. ¡Acceso concedido!
        // Guardamos usuario en sesión para permitir acceso a /dashboard y auditorías
        if (req && req.session) {
            req.session.user = {
                id: usuarioDB.id,
                nombre: usuarioDB.nombre_usuario,
                nombre_completo: usuarioDB.nombre_completo
            };
            req.session.userId = usuarioDB.id;
            req.session.userNombre = usuarioDB.nombre_usuario;
            req.session.userCompleto= usuarioDB.nombre_completo
        }

        return res.status(200).json({
            ok: true,
            msg: `¡Bienvenido, ${usuarioDB.nombre_usuario}!`,
            token: req.sessionID
        });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ ok: false, msg: 'Error en el servidor.' });
    }
};

module.exports = { ingresarUsuario };