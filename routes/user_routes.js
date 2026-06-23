const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/session-info', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({
            ok: true,
            usuario: {
                nombre: req.session.userNombre,
                nombre_completo: req.session.userCompleto 
            }
        });
    } else {
        return res.status(401).json({
            ok: false,
            msg: 'No hay una sesión activa'
        });
    }
});
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.inactivateUser);
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);


module.exports = router;