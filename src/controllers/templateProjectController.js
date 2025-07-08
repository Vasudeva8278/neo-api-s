const Document = require("../models/Document");
const Highlight = require("../models/Highlight");
const Template = require("../models/Template");
const templateService = require("../services/templateService");
const fileService = require("../services/fileService");
const { generateTemplateThumbnail } = require("../utils/helper");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cheerio = require("cheerio");
const htmlDocx = require("html-docx-js");

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB, adjust as needed
});

exports.getAllTemplates = async (req, res, next) => {
  const projectId = req.params.pid;
  const query = { projectId: projectId };

  try {
    const templates = await Template.find({ query }).populate("highlights");
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching templates.");
  }
};

exports.getTemplateById = async (req, res, next) => {
  const projectId = req.params.pid;
  const templateId = req.params.id;
  console.log(projectId, templateId);
  const query = { _id: templateId, projectId: projectId };

  try {
    const template = await templateService.getTemplateById(query);
    res.json(template);
  } catch (error) {
    next(error);
  }
};

exports.convertedFile = async (req, res) => {
  const projectId = req.params.pid;

  if (!req.file || !req.body.content) {
    console.error("Missing file or content", { file: !!req.file, content: !!req.body.content });
    return res.status(400).json({ error: "File and content are required." });
  }

  let s3Result;
  try {
    console.log("Uploading file to S3...");
    s3Result = await fileService.uploadDocxToS3(
      "Template",
      req.file,
      "",
      "neo-templates-bucket"
    );
    console.log("S3 upload result:", s3Result);
    if (!s3Result || !s3Result.Location) {
      throw new Error("S3 upload did not return a file location.");
    }
  } catch (err) {
    console.error("Error uploading file to AWS S3 bucket:", err);
    return res.status(500).json({ error: "Failed to upload file to S3.", details: err.message });
  }

  try {
    const fileName = req.file.originalname;
    const content = req.body.content;
    console.log("Generating thumbnail...");
    const thumbnail = await generateTemplateThumbnail(content);

    const newTemplate = new Template({
      fileName,
      content,
      highlights: [],
      locationUrl: s3Result.Location,
      thumbnail,
      projectId,
    });

    console.log("Saving new template to DB...");
    await newTemplate.save();
    console.log("Template saved:", newTemplate._id);
    return res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error saving template:", error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
};

//api to add or update hightlights in template documents
exports.addNewHighlight = async (req, res) => {
  const projectId = req.params.pid;
  try {
    const { id } = req.params; //templateId;
    const { fileName, content, highlights } = req.body;
    console.log(" addNewHighlight highlights:", highlights);
    const highlightIds = [];
    const newHighlights = [];
    for (const highlight of highlights) {
      let highlightDoc;
      highlightDoc = await Highlight.findOne({ id: highlight.id });
      if (highlightDoc) {
        // If it exists, update it
        highlightDoc = await Highlight.findByIdAndUpdate(
          highlightDoc._id,
          {
            label: highlight.label,
            text: highlight.text,
            type: highlight.type,
          },
          { new: true }
        );
      } else {
        // If it doesn't exist, create new highlight
        //console.log("highlight doesn't exist, creating new");
        const newHighlightDoc = new Highlight({
          id: highlight.id,
          label: highlight.label,
          text: highlight.text,
          type: highlight.type,
        });
        highlightDoc = await newHighlightDoc.save();
        newHighlights.push(highlightDoc);
      }
      highlightIds.push(highlightDoc._id);
    }
    const updatedTemplate = await Template.findByIdAndUpdate(
      id,
      { fileName: fileName, content: content, highlights: highlightIds },
      { new: true }
    ).populate("highlights");
    // console.log("updatedTemplate:",updatedTemplate);

    // Check if there are any documents associated with the template
    const documents = await Document.find({
      _id: { $in: updatedTemplate.documents },
    });
    if (documents.length > 0) {
      // Update each document with the new highlights
      await Promise.all(
        documents.map(async (document) => {
          const newHighlightRefs = newHighlights.map((h) => ({
            id: h._id,
            highlightId: h.id,
            label: h.label,
            text: h.text,
            type: h.type,
          }));
          document.highlights.push(...newHighlightRefs);
          document.content = content;
          await document.save();
        })
      );
    }

    res.status(201).send({ updatedTemplate });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};

// to delete a Highlight in the template.
exports.deleteHighlight = async (req, res) => {
  const projectId = req.params.pid;
  try {
    const { templateId } = req.params;
    const { highlightId, content } = req.body;

    // Step 1: Delete the highlight from the highlight collection
    const deletedHighlight = await Highlight.findOneAndDelete({
      id: highlightId,
    });
    if (!deletedHighlight) {
      return res.status(404).send({ message: "Highlight not found" });
    }

    // Step 2: Update the template's highlights reference array
    const updatedTemplate = await Template.findByIdAndUpdate(
      templateId,
      {
        $pull: { highlights: deletedHighlight._id },
        content: content,
      },
      { new: true }
    ).populate("highlights");

    if (!updatedTemplate) {
      return res.status(404).send({ message: "Template not found" });
    }

    // Remove the highlight from all associated with documents
    const documents = await Document.find({
      _id: { $in: updatedTemplate.documents },
    });

    if (documents.length > 0) {
      await Promise.all(
        documents.map(async (document) => {
          document.highlights = document.highlights.filter(
            (h) => !h.id.equals(deletedHighlight._id)
          );
          await document.save();
        })
      );
    }
    res.status(200).send({ updatedTemplate });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message });
  }
};

exports.deleteTemplateById = async (req, res, next) => {
  const templateId = req.params.id;

  try {
    // Find the template by templateId
    const template = await Template.findOne({
      _id: templateId,
    });
    if (!template) {
      return res
        .status(404)
        .send("Template not found or you do not have permission to delete it");
    }

    // Delete all highlights associated with the template
    await Highlight.deleteMany({ _id: { $in: template.highlights } });

    // Delete all documents associated with the template
    await Document.deleteMany({ _id: { $in: template.documents } });

    // Delete the template itself
    await Template.findByIdAndDelete(templateId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

exports.updateTemplateById = async (req, res, next) => {
  const templateId = req.params.id;
  const updateData = req.body;

  try {
    // Retrieve the template by ID
    const template = await Template.findOne({
      _id: templateId,
    });

    // Check if the template exists
    if (!template) {
      return res
        .status(404)
        .json({ message: "Template not found or access denied" });
    }

    // Update the template
    const updatedTemplate = await templateService.updateTemplate(
      templateId,
      updateData
    );

    // Send the updated template as response
    res.json(updatedTemplate);
  } catch (error) {
    next(error);
  }
};

exports.downloadTemplateById = async (req, res) => {
  const projectId = req.params.pid;
  try {
    const { id } = req.params;
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).send("Template not found");
    }
    const content = template.content;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${template.fileName}</title>
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { color: #333; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
    const blob = htmlDocx.asBlob(fullHtml);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = template.fileName.replace(/\.[^/.]+$/, "") + ".docx";
    const filePath = path.join(__dirname, "../../downloads", fileName);
    if (!fs.existsSync(path.join(__dirname, "../../downloads"))) {
      fs.mkdirSync(path.join(__dirname, "../../downloads"));
    }
    fs.writeFileSync(filePath, buffer);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred during the download.");
  }
};

exports.exportTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const highlights = req.body;
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).send("Template not found");
    }
    const content = template.content;
    const $ = cheerio.load(content);
    highlights.forEach((highlight) => {
      $(`#${highlight.id}`).text(highlight.text).removeAttr("style");
    });
    const updatedHtml = $.html();
    const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${template.fileName}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { color: #333; }
            p { margin: 10px 0; }
          </style>
        </head>
        <body>
          ${updatedHtml}
        </body>
        </html>
      `;
    const buffer = await fileService.convertHTMLToDocxBuffer(updatedHtml);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", "attachment; filename=converted.docx");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred during the download.");
  }
};

exports.getAllTemplatesForHomePage = async (req, res, next) => {
  const projectId = req.params.pid; // Extract projectId from the route parameters
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Fetch templates associated with the given projectId
    const templates = await Template.find({ projectId }) // Filter by projectId
      .select("_id fileName thumbnail createdAt updatedTime")
      .sort({ updatedTime: -1 }) // Sort by updatedTime in descending order
      //.skip(skip)                 // Skip the records based on the current page
      // .limit(limit)
      .exec();

    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching templates.");
  }
};

exports.getAllTemplatesByProjectId = async (req, res, next) => {
  const projectId = req.params.pid; // Extract projectId from the route parameters
  try {
    // Fetch templates associated with the given projectId
    const templates = await Template.find({ projectId }) // Filter by projectId
      .select("_id fileName")
      .exec();
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching templates.");
  }
};
