const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

router.post('/', roleController.createRole); //working
router.get('/', roleController.getAllRoles);//working
router.get('/:id', roleController.getRoleById);//working
router.put('/:id', roleController.updateRole);//working
router.delete('/:id', roleController.deleteRole);//working

module.exports = router;
