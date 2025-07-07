const Template = require("../models/Template");
const DocumentModel = require("../models/Document");
const Highlight = require("../models/Highlight");
const documentService = require("../services/documentService");
const fileService = require("../services/fileService");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const cheerio = require("cheerio");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const juice = require("juice");
const Client = require("../models/ClientModel");
const clientService = require("../services/clientService");
const { PDFDocument } = require("pdf-lib");
const puppeteer = require("puppeteer");
const { sendEmail } = require("../utils/helper");
const ejs = require("ejs");

exports.getDocumentsByTemplateId = async (req, res) => {
  try {
    const templateId = req.params.id;
    const projectId = req.params.pid;
    console.log(templateId, projectId);
    // Find the template with the given templateId and userId
    const template = await Template.findOne({
      _id: templateId,
    })
      .populate("documents")
      .populate("content highlights");

    if (!template) {
      return res.status(404).send("Template not found");
    }

    // Check if there are no documents in the template
    if (template.documents.length === 0) {
      // Create a new document with highlights from the template and userId
      const document = new DocumentModel({
        fileName: "Reference",
        content: template.content,
        highlights: template.highlights.map((highlight) => ({
          id: highlight._id,
          highlightId: highlight.id,
          label: highlight.label,
          text: highlight.text,
          type: highlight.type,
        })),
        thumbnail: template.thumbnail,
      });

      const data = await document.save();
      // Update the template with the new document ID
      await Template.findByIdAndUpdate(template._id, {
        $push: { documents: document._id },
      });
    }

    // Refetch the template to include the newly added document
    const updatedTemplate = await Template.findOne({
      _id: templateId,
    }).populate({
      path: "documents",
      populate: { path: "highlights.id" },
    });

    res.send({
      templateName: updatedTemplate.fileName,
      documents: updatedTemplate.documents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
};

exports.getDocumentId = async (req, res, next) => {
  const documentId = req.params.id;
  try {
    // Retrieve the document by ID and userId to ensure it belongs to the user
    const document = await documentService.getDocumentByIdAndUserId(
      documentId
    );

    // Check if document exists
    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or does not belong to the user" });
    }

    // Export and update document content
    document.content = await exportTemplate(document);

    // Send response
    res.json(document);
  } catch (error) {
    // Pass the error to the next middleware
    console.error("Error fetching document:", error.message);
    next(error);
  }
};

/* exports.createDocsForMultipleTemplates = async (req, res) => {
  const projectId = req.params.pid;
  const userId = req.userId;
  //console.log("in createDocsForMultipleTemplates, userId ", userId);
  try {
    const { templates } = req.body; // Expect an array of templates
    console.log("in createDocsForMultipleTemplates templates ", templates);
    const createdDocuments = []; // Array to store IDs of created documents

    let clientName;

    for (const templateData of templates) {
      const { _id, docName, highlights } = templateData;

      const templateId = _id;

      // Find the template and populate its content
      const template = await Template.findById(templateId).select("content");
      if (!template) {
        console.log(`Template with ID ${templateId} not found`);
        return res.status(404).send(`Template with ID ${templateId} not found`);
      }

      // Extract highlight IDs and validate them
      const highlightIds = highlights.map((h) => h.id);
      console.log(highlightIds);
      const highlightDocs = await Highlight.find({
        id: { $in: highlightIds },
      });

      if (highlightDocs.length !== highlightIds.length) {
        console.log(
          `Invalid highlight IDs provided for template ${templateId}`
        );
        return res
          .status(400)
          .send(`Invalid highlight IDs provided for template ${templateId}`);
      }

      console.log("creating documents");
      // Create a new document
      const document = new DocumentModel({
        fileName: docName,
        content: template.content,
        templateId: templateId,
        highlights: highlights.map((h) => ({
          id: h._id,
          highlightId: h.id, // Assuming this structure is correct
          label: h.label,
          text: h.text,
          type: h.type,
        })),
        thumbnail: template.thumbnail,
        createdBy: userId,
      });

      // Save the document and update the template
      const savedDocument = await document.save();

      console.log("document created");

      await Template.findByIdAndUpdate(templateId, {
        $push: { documents: savedDocument._id },
      });

      console.log("templated updated");
      clientName = docName;

      await clientService.createOrUpdateClientDocument(
        clientName,
        templateId,
        savedDocument._id
      );

      // Add the saved document's ID to the response array
      createdDocuments.push(savedDocument._id);
    }

    //  await Client.findOneAndUpdate(
    //  { name: clientName },
    //  { $push: { documents: { $each: createdDocuments } } },
   //   { upsert: true, new: true }
   // ); 

   
    res
      .status(201)
      .send({ success: true, message: "Documents created successfully" });
  } catch (error) {
    console.error("Error processing templates: ", error);
    res.status(500).send(error.message);
  }
};
 */
exports.createDocsForMultipleTemplates = async (req, res) => {
  const projectId = req.params.pid;

  try {
    const { templates } = req.body; // Expect an array of templates
    console.log("in createDocsForMultipleTemplates templates ", templates);
    const createdDocuments = []; // Array to store IDs of created documents

    if (!templates || templates.length === 0) {
      return res
        .status(400)
        .send({ success: false, message: "Please select atleast 1 template" });
    }

    let clientName;

    for (const templateData of templates) {
      const { _id, docName, highlights } = templateData;

      const templateId = _id;

      // Find the template and populate its content
      const template = await Template.findById(templateId).select("content");
      if (!template) {
        console.log(`Template with ID ${templateId} not found`);
        return res.status(404).send(`Template with ID ${templateId} not found`);
      }

      // Check if a document already exists for this client and template
      const existingClient = await Client.findOne({
        name: docName,
        "documents.templateId": templateId,
      });

      if (existingClient) {
        console.log(
          `Document already exists for client "${docName}" and template "${templateId}". Skipping document creation.`
        );
        // Find the existing document within the client's documents array
        const existingDocument = existingClient.documents.find(
          (doc) => doc.templateId.toString() === templateId.toString()
        );

        if (existingDocument) {
          // Update the highlights of the existing document
          await DocumentModel.findByIdAndUpdate(existingDocument.documentId, {
            highlights: highlights.map((h) => ({
              id: h._id,
              highlightId: h.id,
              label: h.label,
              text: h.text,
              type: h.type,
            })),
          });

          console.log("Highlights updated for existing document");
        }
        continue; // Skip to the next template
      }

      // Extract highlight IDs and validate them
      const highlightIds = highlights.map((h) => h.id);
      console.log(highlightIds);
      const highlightDocs = await Highlight.find({
        id: { $in: highlightIds },
      });

      if (highlightDocs.length !== highlightIds.length) {
        console.log(
          `Invalid highlight IDs provided for template ${templateId}`
        );
        return res
          .status(400)
          .send(`Invalid highlight IDs provided for template ${templateId}`);
      }

      console.log("creating document");
      // Create a new document
      const document = new DocumentModel({
        fileName: docName,
        content: template.content,
        templateId: templateId,
        highlights: highlights.map((h) => ({
          id: h._id,
          highlightId: h.id,
          label: h.label,
          text: h.text,
          type: h.type,
        })),
        thumbnail: template.thumbnail,
      });

      // Save the document and update the template
      const savedDocument = await document.save();

      console.log("document created");

      await Template.findByIdAndUpdate(templateId, {
        $push: { documents: savedDocument._id },
      });

      console.log("template updated");
      clientName = docName;

      // Create or update the client document relationship
      await clientService.createOrUpdateClientDocument(
        clientName,
        templateId,
        savedDocument._id,
        highlights
      );

      // Add the saved document's ID to the response array
      createdDocuments.push(savedDocument._id);
    }

    res
      .status(201)
      .send({ success: true, message: "Documents created successfully" });
  } catch (error) {
    console.error("Error processing templates: ", error);
    res.status(500).send(error.message);
  }
};

exports.getHighlightsByTemplateId = async (req, res) => {
  const projectId = req.params.pid;
  try {
    const template = await Template.findById(req.params.id).populate({
      path: "documents",
      populate: { path: "highlights.id" },
    });
    if (!template) {
      return res.status(404).send("Template not found");
    }
    res.send(template.documents);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.addNewDocForTemplate = async (req, res) => {
  const projectId = req.params.pid;
  console.log("in addNewDocForTemplate");

  try {
    const { templateId, fileName, highlights } = req.body;
    // console.log(templateId, fileName, highlights );
    const template = await Template.findById(templateId).populate("content");
    //console.log(template)
    // Extract highlight IDs and ensure they exist
    const highlightIds = highlights.map((h) => h.id);

    const highlightDocs = await Highlight.find({ _id: { $in: highlightIds } });

    // Ensure all highlight IDs are valid
    if (highlightDocs.length !== highlightIds.length) {
      return res.status(400).send("Invalid highlight IDs provided");
    }

    const document = new DocumentModel({
      fileName: fileName,
      content: template.content,
      templateId: templateId,
      highlights: highlights.map((h) => ({
        id: h.id,
        highlightId: h.id.id,
        label: h.label,
        text: h.text,
        type: h.type,
      })),
      thumbnail: template.thumbnail,
    });
    // console.log(document)
    const data = await document.save();
    await Template.findByIdAndUpdate(templateId, {
      $push: { documents: document._id },
    });
    res.status(201).send({ id: document._id });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.updateDocument = async (req, res) => {
  const projectId = req.params.pid;
  try {
    const docId = req.params.id;
    const { fileName, highlights } = req.body;
    //console.log(fileName,highlights);
    const document = await DocumentModel.findById(docId).populate(
      "highlights.id"
    );
    if (!document) {
      return res.status(404).send("Document not found");
    }
    document.fileName = fileName;
    document.highlights = highlights.map((h) => ({
      id: h.id,
      highlightId: h.id.id,
      label: h.label,
      text: h.text,
      type: h.type,
    }));
    document.content = await exportTemplate(document);
    await document.save();
    res.send(document);
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};

// to delete a document and its references from template.
exports.deleteDocument = async (req, res) => {
  const { documentId } = req.params;
  try {
    const document = await documentService.getDocumentByIdAndUserId(
      documentId
    ); // Check document ownership

    if (!document) {
      return res.status(404).json({
        message:
          "Document not found or you do not have permission to delete it",
      });
    }

    const deletedDocument = await documentService.deleteDocument(documentId);

    // Remove the document reference from all clients
    await Client.updateMany(
      { "documents.documentId": documentId },
      { $pull: { documents: { documentId } } }
    );

    res.status(200).json({
      message: "Document deleted successfully",
      document: deletedDocument,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};

exports.zipDocuments = async (req, res) => {
  //const projectId = req.params.pid;
  const { projectId, documentIds, folderName, templateId } = req.body;
  if (!documentIds || documentIds.length === 0 || !folderName) {
    return res.status(400).send("documentIds and folderName are required");
  }

  const outputFolder = path.join(__dirname, "../uploads", folderName);
  const zipPath = path.join(__dirname, "../uploads", `${folderName}.zip`);

  try {
    fs.mkdirSync(outputFolder, { recursive: true });

    const documents = await DocumentModel.find({ _id: { $in: documentIds } });

    for (const document of documents) {
      try {
        // Export template and update document content
        document.content = await exportTemplate(document);

        // Check if content is available before creating the DOCX file
        if (document.content) {
          const result = await createDocxFileFromHTML(
            document,
            outputFolder,
            templateId
          );
          if (
            result &&
            (result !== null || result !== "undefined") &&
            result?.Location
          ) {
            await DocumentModel.findByIdAndUpdate(document._id, {
              locationUrl: result.Location,
            });
          }
        }
      } catch (error) {
        // Handle errors for each document
        console.error("Error processing document:", error.message);
        // Optionally, you can continue processing other documents or break the loop
      }
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      res.download(zipPath, `${folderName}.zip`, (err) => {
        if (err) {
          console.error(
            `Failed to download the zip file at path ${zipPath}:`,
            err
          );
          res.status(500).send("Failed to download the zip file");
        } else {
          try {
            fs.rmSync(outputFolder, { recursive: true, force: true });
            fs.unlinkSync(zipPath);
          } catch (cleanupErr) {
            console.error("Failed to clean up files:", cleanupErr);
          }
        }
      });
    });

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      res.status(500).send("Failed to create archive");
    });

    archive.pipe(output);
    archive.directory(outputFolder, false);
    await archive.finalize();
  } catch (error) {
    console.error("Failed to process documents:", error);
    res.status(500).send("Failed to process documents");
  }
};

exports.getAllDocumentsWithTemplateName = async (req, res) => {
  const projectId = req.params.pid;
  console.log("Here", projectId);
  try {
    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Step 1: Find templates based on projectId
    const templates = await Template.find({
      projectId: projectId,
    })
      .select("_id fileName documents")
      .populate({
        path: "documents",
        model: "Document",
        select: "_id fileName thumbnail highlights",
      })
      .exec();
    // console.log("@285", templates)
    // Step 2: Extract the document IDs from the templates
    const documentIds = templates.reduce((ids, template) => {
      return ids.concat(template.documents.map((doc) => doc._id));
    }, []);

    // Step 3: Fetch documents that are associated with the templates
    const documents = await DocumentModel.find({ _id: { $in: documentIds } })
      .select("_id fileName thumbnail highlights")
      .sort({ updatedTime: -1 })
      .populate({
        path: "highlights.id",
        model: "Highlight",
      })
      .skip(skip)
      .limit(limit)
      .exec();

    // Step 4: Attach the corresponding template names to the documents
    const documentsWithTemplateNames = documents.map((doc) => {
      const associatedTemplates = templates.filter((template) =>
        template.documents.some((d) => d._id.equals(doc._id))
      );
      return {
        ...doc._doc,
        templates: associatedTemplates.map((t) => t.fileName),
      };
    });

    res.json(documentsWithTemplateNames);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllDocumentsWithTemplateNameByUser = async (req, res) => {
  console.log("getAllDocumentsWithTemplateNameByUserL ");
  try {
    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Step 1: Find templates based on projectId
    const templates = await Template.find({})
      .select("_id fileName documents")
      .populate({
        path: "documents",
        model: "Document",
        select: "_id fileName thumbnail highlights",
      })
      .exec();

    // Step 2: Extract the document IDs from the templates
    const documentIds = templates.reduce((ids, template) => {
      return ids.concat(template.documents.map((doc) => doc._id));
    }, []);

    // Step 3: Fetch documents that are associated with the templates
    const documents = await DocumentModel.find({ _id: { $in: documentIds } })
      .select("_id fileName thumbnail highlights")
      .sort({ updatedTime: -1 })
      .populate({
        path: "highlights.id",
        model: "Highlight",
      })
      .skip(skip)
      .limit(limit)
      .exec();

    // Step 4: Attach the corresponding template names to the documents
    const documentsWithTemplateNames = documents.map((doc) => {
      const associatedTemplates = templates.filter((template) =>
        template.documents.some((d) => d._id.equals(doc._id))
      );
      return {
        ...doc._doc,
        templates: associatedTemplates.map((t) => t.fileName),
      };
    });
    console.log(documentsWithTemplateNames);

    res.json(documentsWithTemplateNames);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

const createDocxFileFromHTML = async (document, folderPath, templateId) => {
  let filePath = "";
  try {
    const content = document.content;
    const fileName = `${document.fileName}.docx`;
    // Load content with cheerio
    const $ = cheerio.load(content);

    let htmlString = $.html();

    // Check if &quot; exists in the content
    if (htmlString.includes("&quot;")) {
      console.log("Found &quot; in the content.");
      // If you want to remove it:
      htmlString = htmlString.replace(/&quot;/g, "");
    }

    const styledHTML = await juice(htmlString);
    //console.log(styledHTML);
    // Convert HTML content from pt to px if necessary
    const finalHtml = convertPtToPxInHtml(styledHTML);

    // console.log(finalHtml);
    const buffer = await fileService.convertHTMLToDocxBuffer(finalHtml);
    filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, buffer);

    // Also uploading in S3 Bucket
    let result;
    try {
      result = await fileService.uploadDocxToS3(
        "Document",
        fileName,
        buffer,
        templateId
      );
    } catch (err) {
      console.error("Error while uploading file to AWS S3 bucket:", err);
    }
    if (result) {
      return result;
    }
  } catch (err) {
    console.error(`Failed to write file at path ${filePath}:`, err);
    throw err;
  }
};

const ptToPx = (pt) => {
  return Math.round(pt * 1.3333); // Conversion factor
};

const convertPtToPxInStyle = (style) => {
  return style.replace(/(\d+(\.\d+)?)\s*pt/g, (match, p1) => {
    const pxValue = p1 < 1 && p1 > 0 ? 1 : ptToPx(parseInt(p1));
    //const pxValue = ptToPx(parseInt(p1));
    return `${pxValue}px`;
  });
};

const convertPtToPxInHtml = (html) => {
  const $ = cheerio.load(html);

  // Iterate over all elements with a style attribute
  $("[style]").each((index, element) => {
    const $element = $(element);
    const style = $element.attr("style");
    const updatedStyle = convertPtToPxInStyle(style);
    $element.attr("style", updatedStyle);
  });

  return $.html();
};

exports.downloadDocumentIndoc = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the document by ID
    console.log("downloadDocumentIndoc");
    const document = await DocumentModel.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Export and update document content
    document.content = await exportTemplate(document);
    const content = document.content;

    // Load content with cheerio
    const $ = cheerio.load(content);

    console.log("In downloadDocumentIndoc");
    let htmlString = $.html();

    // htmlString= await convertHtmlListGroups(htmlString);

    // Check if &quot; exists in the content
    if (htmlString.includes("&quot;")) {
      console.log("Found &quot; in the content.");
      // If you want to remove it:
      htmlString = htmlString.replace(/&quot;/g, "");
    }

    //   console.log(htmlString);
    const styledHTML = await juice(htmlString);
    //const styledHTML = await juice(htmlString,[,{inlinePseudoElements: ["before"]}]);
    // styledHTML = await inline(styledHTML);
    //console.log(styledHTML);
    // Convert HTML content from pt to px if necessary
    const finalHtml = convertPtToPxInHtml(styledHTML);

    // Convert HTML to DOCX buffer
    const buffer = await fileService.convertHTMLToDocxBuffer(finalHtml);

    // Set headers and send response
    res.setHeader("Content-Type", "application/vnd.ms-word");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName || "converted"}.docx"`
    );
    res.send(buffer);
  } catch (error) {
    // Log error and send appropriate response
    console.error("Error during document download:", error);
    res.status(500).send("An error occurred during the download.");
  }
};

async function exportTemplate(document) {
  try {
    // Validate input
    if (!document) {
      throw new Error("Document not found");
    }

    // Load HTML content
    const { content, highlights } = document;
    const $ = cheerio.load(content);

    // Process each highlight
    highlights.forEach((highlight) => {
      const { type, highlightId, text } = highlight;

      if (type === "text") {
        // Update text and remove style
        $(`#${highlightId}`).text(text).removeAttr("style");

        // Find and update elements with the corresponding data attribute
        const elements = $(`[data-highlight-id="${highlightId}"]`);
        if (elements.length > 0) {
          elements.each(function () {
            $(this).text(text).removeAttr("style");
          });
        } else {
          console.log(
            `No elements found with data-highlight-id="${highlightId}"`
          );
        }
      } else {
        // Update HTML content
        //$(`#${highlightId}`).html(text).removeAttr('style');
        $(`#${highlightId}`).html(text);
      }
    });

    $("td").each(function () {
      const $this = $(this);
      if ($this.css("background") === "inherit") {
        $this.css("background", "");
      }
      if ($this.css("background-color") === "inherit") {
        $this.css("background-color", "");
      }
    });

    // Return updated HTML
    return $.html();
  } catch (error) {
    console.error("An error occurred during the export:", error.message);
    throw new Error("An error occurred during the export.");
  }
}

async function imageConversion(htmlString) {
  try {
    const content = htmlString;
    const $ = cheerio.load(content);

    const imgTags = $("img");
    for (let i = 0; i < imgTags.length; i++) {
      const img = imgTags[i];
      const src = $(img).attr("src");
      if (src) {
        const base64Image = await imageToBase64(src);
        $(img).attr("src", base64Image);
      }
    }

    const updatedHtml = $.html();
    return updatedHtml;
  } catch (error) {
    console.error(error);
    throw new Error("An error occurred during the export.");
  }
}

async function imageToBase64(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const base64 = Buffer.from(response.data, "binary").toString("base64");
    const mimeType = response.headers["content-type"];
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to base64: ${error.message}`);
    return url; // Return the original URL if there's an error
  }
}

exports.updateDocumentContent = async (req, res) => {
  const docId = req.params.id;
  const projectId = req.params.pid;
  const { content } = req.body;

  try {
    console.log("Saving document changes from preview page ", docId);

    // Check if the document exists and belongs to the user
    const document = await documentService.getDocumentByIdAndUserId(
      docId
    );

    if (!document) {
      return res.status(404).send("Document not found or access denied");
    }

    // Update the document content
    const updatedDocument = await documentService.updateDocumentContent(
      docId,
      content
    );

    res.send(updatedDocument);
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};

exports.generateZipDocuments = async (req, res) => {
  const { projectId, templateId } = req.body;
  console.log(
    "templateId",
    templateId,
    "projectId",
    projectId
  );
  if (!templateId || !projectId) {
    return res.status(400).send("templateId and projectId are required");
  }

  const template = await Template.find({
    _id: templateId,
    projectId: projectId,
  });
  const folderName = template[0].fileName;
  const documentIds = template[0].documents;
  console.log(folderName);

  if (!documentIds || documentIds.length === 0 || !folderName) {
    return res.status(400).send("documents for this template are not existing");
  }

  const outputFolder = path.join(__dirname, "../uploads", folderName);
  const zipPath = path.join(__dirname, "../uploads", `${folderName}.zip`);

  try {
    fs.mkdirSync(outputFolder, { recursive: true });

    const documents = await DocumentModel.find({ _id: { $in: documentIds } });

    for (const document of documents) {
      try {
        // Export template and update document content
        document.content = await exportTemplate(document);

        // Check if content is available before creating the DOCX file
        if (document.content) {
          const result = await createDocxFileFromHTML(
            document,
            outputFolder,
            templateId
          );
          if (
            result &&
            (result !== null || result !== "undefined") &&
            result?.Location
          ) {
            await DocumentModel.findByIdAndUpdate(document._id, {
              locationUrl: result.Location,
            });
          }
        }
      } catch (error) {
        // Handle errors for each document
        console.error("Error processing document:", error.message);
        // Optionally, you can continue processing other documents or break the loop
      }
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      res.download(zipPath, `${folderName}.zip`, (err) => {
        if (err) {
          console.error(
            `Failed to download the zip file at path ${zipPath}:`,
            err
          );
          res.status(500).send("Failed to download the zip file");
        } else {
          try {
            fs.rmSync(outputFolder, { recursive: true, force: true });
            fs.unlinkSync(zipPath);
          } catch (cleanupErr) {
            console.error("Failed to clean up files:", cleanupErr);
          }
        }
      });
    });

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      res.status(500).send("Failed to create archive");
    });

    archive.pipe(output);
    archive.directory(outputFolder, false);
    await archive.finalize();
  } catch (error) {
    console.error("Failed to process documents:", error);
    res.status(500).send("Failed to process documents");
  }
};

exports.getCommonDocumentData = async (req, res) => {
  console.log(req.params);
  const projectId = req.params.id;
  const documentName = req.params.docName;

  try {
    console.log("Fetching common highlights in project:", projectId);

    const commonHighlights =
      await documentService.getCommonHighlighDataInDocuments(
        projectId,
        documentName
      );

    if (!commonHighlights || commonHighlights.length === 0) {
      return res.status(404).json({ message: "No highlights found." });
    }

    res.status(200).json({ commonHighlights });
  } catch (error) {
    console.error("Error in getCommonDocumentData:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/*
function convertHtmlListGroups(htmlContent) {
    // Load the HTML content into Cheerio
    const $ = cheerio.load(htmlContent);

    const styleTags = $('style').toArray();
    const cssRules = styleTags.map(tag => $(tag).html()).join('\n').split('}').map(rule => rule + '}');
   // console.log(cssRules)
  

    // Define the getListType function
    function getListType(className) {
        console.log(className);
        const elem = $('.' + className).get(0);
        if (!elem) return null;

        const content = $(elem).text().trim(); 

          // Regex to match the `counter` content in CSS
         const regex = new RegExp(`\\.${className}:before\\s*{[^}]*content:\\s*""counter\\([^)]+,\\s*([a-zA-Z-]+)\\)`.replace(/"/g, '\\"'), 'i');
         const fontFamilyRegex = new RegExp(`\\.${className.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}:before\\s*{[^}]*font-family:\\s*([^;]+);?`, 'i');
         let fontFamilyMatch = null;
    for (const rule of cssRules) {
        const match = rule.match(regex);
        if (match) {
            console.log('-------->  ', match[1]);
            return { type: 'ol', counter: match[1] }; // Return ordered list with counter type
        }
        
        if (!fontFamilyMatch) {
           fontFamilyMatch = rule.match(fontFamilyRegex);
         //  console.log(fontFamilyMatch)
        }
    }

    const bulletFontFamilies = ['Symbol', 'Wingdings', 'Webdings', 'Arial Unicode MS', 'Times New Roman', 'Calibri',"Courier New"];
        if (
          (fontFamilyMatch && bulletFontFamilies.includes(fontFamilyMatch[1].trim())) ||  // Match font-family
          content.includes('•') ||  // Common bullet point symbols
          content.includes('◦') ||
          content.includes('▪')
      ) {
          console.log('Detected unordered list based on font-family or symbols.');
          return { type: 'ul', counter: "disc" };  // Return unordered list
      }

        return null; // Return null if no list type can be determined
    }

    // Define the convertListGroups function
    function convertListGroups() {
        const processedClasses = new Set();

         // Collect all unique class names starting with "docx-num-"
      //  $('p[class^="docx-num-"]').each(function() {
       //     const className = $(this).attr('class');
       //     processedClasses.add(className);
       // }); 
        $('p').each(function() {
          const classAttr = $(this).attr('class'); // Get the class attribute
          if (classAttr) { // Check if class attribute is defined
              const classList = classAttr.split(/\s+/); // Split class attribute into an array of class names
              classList.forEach(function(className) {
                  if (className.startsWith('docx-num')) {
                      processedClasses.add(className);
                  }
              });
          }
      });
     
         console.log(processedClasses)
        // Iterate over each unique class and convert to list
        processedClasses.forEach(function(className) {
            const listTypeInfo = getListType(className);
           
            if (!listTypeInfo) return;

            // Create the list (either <ol> or <ul>)
            const $list = $(listTypeInfo.type === 'ol' ? '<ol>' : '<ul list-style-type=circle>');

            if (listTypeInfo.type === 'ol') {
                // Apply the counter type if it's an ordered list
                console.log("appending:: ",listTypeInfo.type, listTypeInfo.counter)
                $list.css('list-style-type', listTypeInfo.counter);
            }

            // Copy styles and classes from the first <p> tag to the list
            const $firstParagraph = $('p.' + className).first();
            $list.attr('class', $firstParagraph.attr('class')); // Copy class
            $list.attr('style', $firstParagraph.attr('style')); // Copy inline style

            // Add each <p> to the list as a <li>
            $('p.' + className).each(function() {
                const $li = $('<li>').text($(this).text().trim());

                // Copy styles and classes from the <p> tag to the <li> tag
                $li.attr('class', $(this).attr('class')); // Copy class
                $li.attr('style', $(this).attr('style')); // Copy inline style

                $list.append($li);
            });

            // Insert the list before the first item of the same class
            $firstParagraph.before($list);

            // Remove the original <p> tags
            $('p.' + className).remove();
        });
    }

    // Convert the list groups
    convertListGroups();

    // Return the updated HTML string
    return $.html();
}
  */
exports.sendDocumentViaEmail = async (req, res) => {
  console.log("Reached correct method");
  const documentId = req.params.id;
  try {
    // Retrieve the document by ID and userId to ensure it belongs to the user
    const document = await documentService.getDocumentByIdAndUserId(
      documentId
    );

    console.log(documentId);
    // Check if document exists
    if (!document) {
      return res
        .status(404)
        .json({ message: "Document not found or does not belong to the user" });
    }

    // Export and update document content
    document.content = await exportTemplate(document);

    const htmlContent =
      typeof document.content === "string"
        ? document.content
        : JSON.stringify(document.content);

    const pdfBytes = await generatePDF(htmlContent);

    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/documents.ejs",
      { email: req.user.email, user: req.user.name },
      { async: true }
    );

    await sendEmail({
      to: req.user.email,
      subject: "Here is the document you requested",
      text: `Please check you attachment`,
      html: messageHtml,
      attachment: [
        {
          filename: `${document.fileName}.pdf`,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });

    res.status(200).json({ message: "Document sent via email successfully!" });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ error: error.message });
  }
};

// Function to generate a PDF
async function generatePDF(document) {
  let browser;

  try {
    // Launch Puppeteer with options to handle environments like headless mode on Windows
    browser = await puppeteer.launch({
      headless: true, // Ensures Puppeteer runs in headless mode
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Optional path to Chromium executable
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // Useful for environments with sandboxing issues
    });

    //const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const mediaStyles = `
    <style>
      @media print {
                 
  body {
      margin: 0px;
      padding: 0px !important;
  }
 
  
  .docx-wrapper{
    padding: 0px !important;
  }
 
 footer{
   text-align: center;
 }

  .docx {
      padding: 60pt 60pt 30pt !important; 
      width: 610pt !important;
      min-height: 900.9pt;
      margin: 0 !important;
   }

  .print-content {
      margin: 0;
      border: 1px solid #000;
      box-sizing: border-box;
  }
      
  section .docx{ 
    zoom: 0.89;
    min-height: 840pt !important;
    max-height: 845pt !important;
    box-shadow: none !important;
    box-sizing: content-box;
    padding: 0 !important;
    margin: 0 !important;
  }
  
  


table{
    max-width: 550px !important;
}
 img{
  max-width: 550px !important;
}

.docx-wrapper {
  float: none;
  overflow: visible !important;
  position: absolute;
  height: auto;
  width: 99%;
  font-size: 12px;
  padding: 20px 0px;
  margin: 10px 0px;
  clear: both;
}


.highlight{
  border: 0px solid blue;
 }
  }
    </style>
  `;

    // Inject media styles into the HTML content
    const enhancedHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PDF Document</title>
      ${mediaStyles}
    </head>
    <body>
      ${document}
    </body>
    </html>
  `;

    // Set the HTML content
    await page.setContent(enhancedHtmlContent, { waitUntil: "networkidle0" });

    await page.emulateMediaType("print");

    // Generate the PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // Ensures background styles are included
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
