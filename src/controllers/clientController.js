const clientService = require("../services/clientService");

// Fetch all clients with details
const getAllClients = async (req, res) => {
  try {
    const clients = await clientService.getAllClientsWithDetails();
    res.status(200).json({
      success: true,
      message: "Clients fetched successfully.",
      data: clients,
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching clients.",
    });
  }
};

// Fetch details for a specific client by ID
const getClientDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    const clients = await clientService.getDocumentsByClientId(id);

    // Check if client exists
    if (!clients || clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Client details fetched successfully.",
      data: clients,
    });
  } catch (error) {
    console.error("Error fetching client details:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching client details.",
    });
  }
};

const deleteClientById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }
    const deleted = await clientService.deleteClientById(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Client not found or already deleted.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Client deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the client.",
    });
  }
};

module.exports = {
  getAllClients,
  getClientDetails,
  deleteClientById,
};
