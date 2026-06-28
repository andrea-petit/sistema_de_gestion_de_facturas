const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { sanitizarPeticion } = require('../middleware/sanitizer.js');

router.get('/', empresaController.getEmpresa);
router.post('/', sanitizarPeticion, empresaController.createEmpresa);
router.put('/', sanitizarPeticion, empresaController.updateEmpresa);

module.exports = router;