const express = require("express");
const router = express.Router();
const documentProjectController = require("../controllers/documentProjectController");
const { sendEmail } = require("../utils/helper");

//router.get('/:id/highlights', documentProjectController.getHighlightsByTemplateId);

// to update filesName and text in the document..
router.put("/updatedoc/:id", documentProjectController.updateDocument);

// to add a new document for a template doc.
router.post("/add-document", documentProjectController.addNewDocForTemplate);

router.get(
  "/commonData/:id/:docName",
  documentProjectController.getCommonDocumentData
);

// to fetch the existing document of a template.
router.get(
  "/:pid/template-documents/:id",
  documentProjectController.getDocumentsByTemplateId
);

router.get("/view-document/:id", documentProjectController.getDocumentId);

//to send the selected document to registered Email.
router.get(
  "/email-document/:id",
  documentProjectController.sendDocumentViaEmail
);

// to delete the document from document collection and its reference from template .
router.delete(
  "/:pid/documents/delete-doc/:documentId",
  documentProjectController.deleteDocument
);

router.post("/zip-documents", documentProjectController.zipDocuments);

router.get(
  "/:pid/documents/documents-with-template-names",
  documentProjectController.getAllDocumentsWithTemplateName
);

router.get(
  "/documents/documents-with-template-names",
  documentProjectController.getAllDocumentsWithTemplateNameByUser
);

router.post("/:id/download", documentProjectController.downloadDocumentIndoc);

//this route updates only the document content when user saves the editted document content from preview page.
router.put(
  "/update-content/:id",
  documentProjectController.updateDocumentContent
);

router.post(
  "/create-multiDocs",
  documentProjectController.createDocsForMultipleTemplates
);

router.post(
  "/generate-documents",
  documentProjectController.generateZipDocuments
);

module.exports = router;
