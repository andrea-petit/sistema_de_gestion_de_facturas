const pool = require('../config/bd');

const userModel = {
    getAllUsers() {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM usuarios', (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    getUserById(id) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM usuarios WHERE id = $1', [id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    createUser(userData) {  
        return new Promise((resolve, reject) => {
            pool.query('INSERT INTO usuarios (nombre_usuario, contraseña_hash, nombre_completo, rol, correo) VALUES ($1, $2, $3, $4, $5) RETURNING *', [userData.nombre_usuario, userData.contraseña_hash, userData.nombre_completo, userData.rol, userData.correo], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    updateUser(id, campo, valor) {
        return new Promise((resolve, reject) => {
            pool.query(`UPDATE usuarios SET ${campo} = $1 WHERE id = $2 RETURNING *`, [valor, id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    inactivateUser(id) {
        return new Promise((resolve, reject) => {
            pool.query('UPDATE usuarios SET activo = false WHERE id = $1 RETURNING *', [id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },
    activateUser(id) {
        return new Promise((resolve, reject) => {
            pool.query('UPDATE usuarios SET activo = true WHERE id = $1 RETURNING *', [id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },

    loginUser(nombre_usuario) {
        return new Promise((resolve, reject) => {
            pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [nombre_usuario], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    }
};

module.exports = userModel;