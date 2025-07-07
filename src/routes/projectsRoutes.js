// routes/projectRoutes.js
const express = require("express");
const multer = require("multer");
const projectsController = require("../controllers/projectsController");
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Routes
router.get(
  "/get-labels/:projectId",
  projectsController.getExistingLabelsWithinProject
);
router.get(
  "/templateHighlights/:projectId",
  projectsController.getTemplateHighlightsinProject
);

router.post("/", upload.single("thumbnail"), projectsController.createProject);
router.put(
  "/:id",
  upload.single("thumbnail"),
  projectsController.updateProject
);
router.delete("/:id", projectsController.deleteProject);
router.get("/", projectsController.getAllProjects); // New route for all projects
router.get("/:id/subprojects", projectsController.getSubprojects); // New route for subprojects

module.exports = router;
