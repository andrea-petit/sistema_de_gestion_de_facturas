const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');


router.get('/', empresaController.getEmpresa);
router.post('/', empresaController.createEmpresa);
router.put('/', empresaController.updateEmpresa);

module.exports = router;