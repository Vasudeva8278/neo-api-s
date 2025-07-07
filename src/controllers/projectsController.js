// controllers/projectController.js
const projectsService = require("../services/projectsService");

// Function to convert file buffer to base64
const convertToBase64 = (fileBuffer) => {
  return fileBuffer.toString("base64");
};

// Create Project
exports.createProject = async (req, res) => {
  try {
    const projectData = {
      projectName: req.body.projectName,
      block: JSON.parse(req.body.block),
      property: JSON.parse(req.body.property),
      thumbnail: req.file ? convertToBase64(req.file.buffer) : null, // Convert to base64
      createdBy: req.userId,
    };

    const newProject = await projectsService.createProject(projectData);
    res.status(201).json(newProject);
  } catch (error) {
    res.status(500).json({ error: "Failed to create project" });
  }
};

// Update Project
exports.updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectData = {
      projectName: req.body.projectName,
      block: req.body.block ? JSON.parse(req.body.block) : undefined,
      property: req.body.property ? JSON.parse(req.body.property) : undefined,
      thumbnail: req.file ? convertToBase64(req.file.buffer) : undefined, // Convert to base64 if file exists
    };

    const updatedProject = await projectsService.updateProject(
      projectId,
      projectData
    );
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: "Failed to update project" });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const success = await projectsService.deleteProject(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json({ message: "Project deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await projectsService.getAllProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New method to get subprojects based on parent project
exports.getSubprojects = async (req, res) => {
  try {
    const subprojects = await projectsService.getSubprojects(req.params.id);
    if (!subprojects || subprojects.length === 0) {
      return res
        .status(404)
        .json({ message: "No subprojects found for this project" });
    }
    res.json(subprojects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getExistingLabelsWithinProject = async (req, res) => {
  const { projectId } = req.params;
  console.log("in getAllLabels", projectId);
  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }
  try {
    const highlights = await projectsService.getDistinctLabelsInProject(
      projectId
    );
    res.status(200).json(highlights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTemplateHighlightsinProject = async (req, res) => {
  const { projectId } = req.params;
  console.log("in getAllLabels", projectId);
  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }
  try {
    const highlights = await projectsService.getTemplatesWithHighlights(
      projectId
    );
    res.status(200).json(highlights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
