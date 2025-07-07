const express = require("express");
const router = express.Router();
const templateController = require("../controllers/templateController");

// get all templates on loading page
router.get("/", templateController.getAllTemplates);

router.get(
  "/homePageTemplates/",
  templateController.getAllTemplatesForHomePage
);

//get template by on DocxToTextConverter
router.get("/:id", templateController.getTemplateById);

//delete template
router.delete("/:id", templateController.deleteTemplateById);

//to add or update a highlight in a templateDoc
router.put("/add-highlights/:id", templateController.addNewHighlight);

// to update the template content alone. THis route is used to update content in Labeling page.
router.put("/update-content/:id", templateController.updateTemplateContent);

//to delete a highlight from a template
router.delete(
  "/delete-highlight/:templateId",
  templateController.deleteHighlight
);

router.put("/:id", templateController.updateTemplateById);
router.post("/convert", templateController.convertFile);

router.post("/converted", templateController.convertedFile);

router.get("/:id/download", templateController.downloadTemplateById);

router.post("/:id/export", templateController.exportTemplate);

module.exports = router;
