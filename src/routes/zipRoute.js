const express = require('express');
const router = express.Router();
const { zipFolderController } = require('../controllers/zipController');

// Define the route for zipping a folder
router.get('/zip-folder', zipFolderController);

module.exports = router;
