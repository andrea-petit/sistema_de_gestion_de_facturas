const express = require('express');
const router = express.Router();
const proveedoresController = require('../controllers/proveedoresController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', proveedoresController.getAllProveedores);
router.get('/:id', proveedoresController.getProveedorById);
router.post('/', proveedoresController.createProveedor);
router.put('/:id', authMiddleware, proveedoresController.editProveedor);

module.exports = router;