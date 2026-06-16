const userModel = require('../models/user_model');
const bcrypt = require('bcrypt');


const userController= {
    async getAllUsers(req, res) {
        try {
            const users = await userModel.getAllUsers();
            res.status(200).json({ ok: true, data: users.rows });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ ok: false, msg: 'Error fetching users.' });
        }
    },

    async getUserById(req, res) {
        const { id } = req.params;
        try {
            const user = await userModel.getUserById(id);
            if (user.rows.length === 0) {
                return res.status(404).json({ ok: false, msg: 'User not found.' });
            }
            res.status(200).json({ ok: true, data: user.rows[0] });
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            res.status(500).json({ ok: false, msg: 'Error fetching user.' });
        }
    },

    async createUser(req, res) {
        const { nombre_usuario, contraseña, nombre_completo, rol, correo } = req.body;
        
        // 1. Validación de campos obligatorios
        if (!nombre_usuario || !contraseña || !nombre_completo || !rol || !correo) {
            return res.status(400).json({ ok: false, msg: 'Missing required fields.' });
        }

        // 2. Control de Acceso Jerárquico (RBAC)
        const operadorRol = req.session?.userRol; // Obtenido de la sesión activa del operador

        if (operadorRol === 'empleado' || !operadorRol) {
            return res.status(403).json({ ok: false, msg: 'Acceso denegado. Rol insuficiente.' });
        }

        if (operadorRol === 'admin' && rol !== 'empleado') {
            return res.status(403).json({ ok: false, msg: 'Los administradores solo pueden registrar cuentas de tipo empleado.' });
        }
        // Si es superadmin, la jerarquía le permite avanzar sin restricciones para crear admins o empleados

        try {
            const hashedPassword = await bcrypt.hash(contraseña, 10);
            const newUser = await userModel.createUser({ 
                nombre_usuario, 
                contraseña_hash: hashedPassword, 
                nombre_completo, 
                rol, 
                correo 
            });
            res.status(201).json({ ok: true, data: newUser.rows[0] });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ ok: false, msg: 'Error creating user.' });
        }
    },

    async updateUser(req, res) {
        const { id } = req.params;
        const { campo, valor } = req.body;

        if (!campo || valor === undefined) {
            return res.status(400).json({ ok: false, msg: 'Missing required fields.' });
        }

        // REGLA DE ORO: El rol es inmutable
        if (campo.trim().toLowerCase() === 'rol') {
            return res.status(400).json({ ok: false, msg: 'El rol de un usuario es inmutable. No se permite su modificación.' });
        }

        const operadorRol = req.session?.userRol;
        if (operadorRol === 'empleado' || !operadorRol) {
            return res.status(403).json({ ok: false, msg: 'Acceso denegado.' });
        }

        try {
            // Buscamos primero al usuario que se desea editar para validar su jerarquía real en la BD
            const userTarget = await userModel.getUserById(id);
            if (userTarget.rows.length === 0) {
                return res.status(404).json({ ok: false, msg: 'User not found.' });
            }
            
            const usuarioAEdeitar = userTarget.rows[0];

            // REGLA: Un admin NO puede editar a otro admin ni a un superadmin
            if (operadorRol === 'admin' && (usuarioAEdeitar.rol === 'admin' || usuarioAEdeitar.rol === 'superadmin')) {
                return res.status(403).json({ ok: false, msg: 'No tienes permisos para modificar usuarios de igual o mayor jerarquía.' });
            }

            // Si el campo a editar es la contraseña, aplicamos hashing antes de guardar
            let valorFinal = valor;
            let campoFinal = campo;
            if (campo === 'contraseña' || campo === 'contraseña_hash') {
                valorFinal = await bcrypt.hash(valor, 10);
                campoFinal = 'contraseña_hash'; // Aseguramos que apunte a la columna correcta
            }

            const updatedUser = await userModel.updateUser(id, campoFinal, valorFinal);
            res.status(200).json({ ok: true, data: updatedUser.rows[0] });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ ok: false, msg: 'Error updating user.' });
        }
    },

    async inactivateUser(req, res) {
        const { id } = req.params;
        const operadorRol = req.session?.userRol;

        if (operadorRol === 'empleado' || !operadorRol) {
            return res.status(403).json({ ok: false, msg: 'Acceso denegado.' });
        }

        try {
            const userTarget = await userModel.getUserById(id);
            if (userTarget.rows.length === 0) {
                return res.status(404).json({ ok: false, msg: 'User not found.' });
            }

            const usuarioAEdeitar = userTarget.rows[0];

            if (operadorRol === 'admin' && (usuarioAEdeitar.rol === 'admin' || usuarioAEdeitar.rol === 'superadmin')) {
                return res.status(403).json({ ok: false, msg: 'No puedes inactivar usuarios de igual o mayor jerarquía.' });
            }

            const inactivatedUser = await userModel.inactivateUser(id);
            res.status(200).json({ ok: true, data: inactivatedUser.rows[0] });
        } catch (error) {
            console.error('Error inactivating user:', error);
            res.status(500).json({ ok: false, msg: 'Error inactivating user.' });
        }
    },

    async loginUser(req, res) {
        const { nombre_usuario, contraseña } = req.body;
        if (!nombre_usuario || !contraseña) {
            return res.status(400).json({ ok: false, msg: 'Missing required fields.' });
        }
        try {
            const user = await userModel.loginUser(nombre_usuario);
            if (user.rows.length === 0) {
                return res.status(401).json({ ok: false, msg: 'Invalid credentials.' });
            }
            const usuarioDB = user.rows[0];
            const passwordMatches = await bcrypt.compare(contraseña, usuarioDB.contraseña_hash);
            if (!passwordMatches) {
                return res.status(401).json({ ok: false, msg: 'Invalid credentials.' });
            }
            if (req && req.session) {
                req.session.user = {
                    id: usuarioDB.id,
                    nombre: usuarioDB.nombre_usuario,
                    rol: usuarioDB.rol
                };
                req.session.userId = usuarioDB.id;
                req.session.userNombre = usuarioDB.nombre_usuario;
                req.session.userRol = usuarioDB.rol;
            }
            if (usuarioDB.activo === false) {
                return res.status(403).json({ ok: false, msg: 'Tu cuenta ha sido inactivada. Contacta al administrador.' });
            }


            // Respondemos con la sesión ya creada; no usar `sessionStorage` en servidor
            res.status(200).json({ ok: true, data: usuarioDB, token: req.sessionID });
        } catch (error) {
            console.error('Error logging in user:', error);
            res.status(500).json({ ok: false, msg: 'Error logging in user.' });
        }
    }

};

module.exports = userController;