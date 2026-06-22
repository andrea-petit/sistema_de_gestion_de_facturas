const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.inactivateUser);
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);

module.exports = router;