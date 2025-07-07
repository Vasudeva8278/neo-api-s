const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController"); // Replace with actual path

// Route to fetch all clients with populated data
router.get("/", clientController.getAllClients);

router.get("/:id", clientController.getClientDetails);

router.delete("/:id", clientController.deleteClientById);

module.exports = router;
