const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");

//router.get('/:id/highlights', documentController.getHighlightsByTemplateId);

// to update filesName and text in the document..
router.put("/updatedoc/:id", documentController.updateDocument);

// to add a new document for a template doc.
router.post("/add-document", documentController.addNewDocForTemplate);

// to fetch the existing document of a template.
router.get(
  "/template-documents/:id",
  documentController.getDocumentsByTemplateId
);

router.get("/view-document/:id", documentController.getDocumentId);

// to delete the document from document collection and its reference from template .
router.delete("/delete-doc/:documentId", documentController.deleteDocument);

router.post("/zip-documents", documentController.zipDocuments);

router.get(
  "/documents-with-template-names",
  documentController.getAllDocumentsWithTemplateName
);

router.post("/:id/download", documentController.downloadDocumentIndoc);

//this route updates only the document content when user saves the editted document content from preview page.
router.put("/update-content/:id", documentController.updateDocumentContent);

router.get('/view-document/:id', documentController.getDocumentsByTemplateId);

module.exports = router;
