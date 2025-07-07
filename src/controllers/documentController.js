const Template = require('../models/Template');
const DocumentModel = require('../models/Document');
const Highlight = require('../models/Highlight');
const documentService = require('../services/documentService');
const fileService = require('../services/fileService');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const cheerio = require('cheerio');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const juice = require('juice');



exports.getDocumentsByTemplateId = async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await Template.findById(templateId).populate('documents').populate('content highlights');
    if (!template) {
      return res.status(404).send('Template not found');
    }

    // Check if there are no documents in the template
    if (template.documents.length === 0) {
      // Create a new document with highlights from the template
      const document = new DocumentModel({
        fileName: 'Reference',
        content: template.content,
        highlights: template.highlights.map(highlight => ({
          id: highlight._id,
          highlightId: highlight.id,
          label: highlight.label,
          text: highlight.text,
          type: highlight.type,
        })),
        thumbnail : template.thumbnail,

      });

      const data = await document.save();
      //console.log(data);

      // Update the template with the new document ID
      await Template.findByIdAndUpdate(template._id, { $push: { documents: document._id } });
    }

    // Refetch the template to include the newly added document
    const updatedTemplate = await Template.findById(templateId).populate({
      path: 'documents',
      populate: { path: 'highlights.id' }
    });
    res.send(updatedTemplate.documents);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
}

exports.getDocumentId = async (req, res, next) => {
  try {
    // Retrieve the document by ID
    const document = await documentService.getDocumentId(req.params.id);

    // Check if document exists
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Export and update document content
    document.content = await exportTemplate(document);
    //console.log("In view Document",document.content);
    // Send response
    res.json(document);
  } catch (error) {
    // Pass the error to the next middleware
    console.error('Error fetching document:', error.message);
    next(error);
  }
};

exports.getHighlightsByTemplateId = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id).populate({
      path: 'documents',
      populate: { path: 'highlights.id' },
    });
    if (!template) {
      return res.status(404).send('Template not found');
    }
    res.send(template.documents);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.addNewDocForTemplate = async (req, res) => {
  try {
    const { templateId, fileName, highlights } = req.body;
    // console.log(templateId, fileName, highlights );
    const template = await Template.findById(templateId).populate('content');
    //console.log(template)
    // Extract highlight IDs and ensure they exist
    const highlightIds = highlights.map(h => h.id);

    const highlightDocs = await Highlight.find({ _id: { $in: highlightIds } });

    // Ensure all highlight IDs are valid
    if (highlightDocs.length !== highlightIds.length) {
      return res.status(400).send('Invalid highlight IDs provided');
    }

    const document = new DocumentModel({
      fileName: fileName,
      content: template.content,
      highlights: highlights.map(h => ({
        id: h.id,
        highlightId: h.id.id,
        label: h.label,
        text: h.text,
        type: h.type,
      })),
      thumbnail : template.thumbnail,
    });
    // console.log(document)
    const data = await document.save();
    await Template.findByIdAndUpdate(templateId, { $push: { documents: document._id } });
    res.status(201).send({ id: document._id });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const docId = req.params.id;
    const { fileName, highlights } = req.body;
    //console.log(fileName,highlights);
    const document = await DocumentModel.findById(docId).populate('highlights.id');
    if (!document) {
      return res.status(404).send('Document not found');
    }
    document.fileName = fileName;
    document.highlights = highlights.map(h => ({
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
  try {
    const { documentId } = req.params;
    const deletedDocument = await documentService.deleteDocument(documentId);
    console.log("Document deleted successfully");
    res.status(200).json({ message: 'Document deleted successfully', document: deletedDocument });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};



const createDocxFileFromHTML = async (document, folderPath,templateId) => {
  let filePath = '';
  try {
    const content = document.content;
    const fileName =`${document.fileName}.docx`;

    // Load content with cheerio
    const $ = cheerio.load(content);
     
   // console.log(content);
    
    // Check if &quot; exists in the content
    if (htmlString.includes('&quot;')) {
      console.log('Found &quot; in the content.');
      // If you want to remove it:
      htmlString = htmlString.replace(/&quot;/g, '');
  }
    const styledHTML = await juice($.html());
    //console.log(styledHTML);
    // Convert HTML content from pt to px if necessary
    const finalHtml = convertPtToPxInHtml($.html()); 
    
  // console.log(finalHtml);
    const buffer = await fileService.convertHTMLToDocxBuffer(finalHtml);
    filePath = path.join(folderPath,fileName );
    fs.writeFileSync(filePath, buffer);

    // Also uploading in S3 Bucket
    let result;
    try {
      result = await fileService.uploadDocxToS3("Document",fileName,buffer,templateId);
    } catch (err) {
      console.error('Error while uploading file to AWS S3 bucket:', err);
    }
    if(result) {
      return result;
    }

  } catch (err) {
    console.error(`Failed to write file at path ${filePath}:`, err);
    throw err;
  }
};

exports.zipDocuments = async (req, res) => {
  const { documentIds, folderName,templateId } = req.body;
  //console.log(templateId);

  if (!documentIds || documentIds.length === 0 || !folderName) {
    return res.status(400).send('documentIds and folderName are required');
  }

  const outputFolder = path.join(__dirname, '../uploads', folderName);
  const zipPath = path.join(__dirname, '../uploads', `${folderName}.zip`);

  try {
    fs.mkdirSync(outputFolder, { recursive: true });

    const documents = await DocumentModel.find({ _id: { $in: documentIds } });
    
    for (const document of documents) {
      try {
        // Export template and update document content
        document.content = await exportTemplate(document);
        
        // Check if content is available before creating the DOCX file
        if (document.content) {
        const result =  await createDocxFileFromHTML(document, outputFolder,templateId);
        if(result && (result !== null || result !== 'undefined') && result?.Location) { await DocumentModel.findByIdAndUpdate(document._id,{locationUrl: result.Location});}
        }
      } catch (error) {
        // Handle errors for each document
        console.error('Error processing document:', error.message);
        // Optionally, you can continue processing other documents or break the loop
      }
    }
    

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, `${folderName}.zip`, err => {
        if (err) {
          console.error(`Failed to download the zip file at path ${zipPath}:`, err);
          res.status(500).send('Failed to download the zip file');
        } else {
          try {
            fs.rmSync(outputFolder, { recursive: true, force: true });
            fs.unlinkSync(zipPath);
          } catch (cleanupErr) {
            console.error('Failed to clean up files:', cleanupErr);
          }
        }
      });
    });

    archive.on('error', err => {
      console.error('Archive error:', err);
      res.status(500).send('Failed to create archive');
    });

    archive.pipe(output);
    archive.directory(outputFolder, false);
    await archive.finalize();
  } catch (error) {
    console.error('Failed to process documents:', error);
    res.status(500).send('Failed to process documents');
  }
};

exports.getAllDocumentsWithTemplateName = async (req, res) => {
  try {
    // Populate the documents with their associated template names
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const documents = await DocumentModel.find()
      .select('_id fileName thumbnail highlights')
      .populate({
        path: 'highlights.id',
        model: 'Highlight'
      })
      .populate({
        path: 'highlights.id.template', // Assuming highlights.id has reference to template
        model: 'Template',
        select: 'fileName'  // Select only the fileName field
      })
      .skip(skip)        // Skip the records based on the current page
      .limit(limit)    
      .exec();

    // Iterate over documents to get the template names
    const documentsWithTemplateNames = await Promise.all(documents.map(async (doc) => {
      const templates = await Template.find({ documents: doc._id }).select('fileName').exec();
      return {
        ...doc._doc,  // Spread the document object
        templates: templates.map(t => t.fileName)  // Add the template names
      };
    }));

    res.json(documentsWithTemplateNames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const ptToPx = (pt) => {
  return Math.round(pt * 1.3333); // Conversion factor
};

const convertPtToPxInStyle = (style) => {
  return style.replace(/(\d+(\.\d+)?)\s*pt/g, (match, p1) => {
   const pxValue = (p1 <1 && p1>0) ? 1 : ptToPx(parseInt(p1));
    //const pxValue = ptToPx(parseInt(p1));
    return `${pxValue}px`;
  });
};

const convertPtToPxInHtml = (html) => {
  const $ = cheerio.load(html);

  // Iterate over all elements with a style attribute
  $('[style]').each((index, element) => {
    const $element = $(element);
    const style = $element.attr('style');
    const updatedStyle = convertPtToPxInStyle(style);
    $element.attr('style', updatedStyle);
  });

  return $.html();
};


exports.downloadDocumentIndoc = async (req, res) => {
  try {
    const { id } = req.params;
    const highlights = req.body; // Ensure highlights are processed if needed

    // Find the document by ID
    const document = await DocumentModel.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Export and update document content
    document.content = await exportTemplate(document);
    const content = document.content;

    // Load content with cheerio
    const $ = cheerio.load(content);
     
   // console.log(content);
    
    //const styledHTML = await juice($.html());
    //console.log(styledHTML);
    // Convert HTML content from pt to px if necessary
    const finalHtml = convertPtToPxInHtml($.html());
    //console.log(finalHtml);

    // Convert HTML to DOCX buffer
    const buffer = await fileService.convertHTMLToDocxBuffer(finalHtml);

    // Set headers and send response
    res.setHeader('Content-Type', 'application/vnd.ms-word');
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName || 'converted'}.docx"`);
    res.send(buffer);
  } catch (error) {
    // Log error and send appropriate response
    console.error('Error during document download:', error);
    res.status(500).send("An error occurred during the download.");
  }
};





async function exportTemplate(document) {
  try {
    // Validate input
    if (!document) {
      throw new Error('Document not found');
    }

    // Load HTML content
    const { content, highlights } = document;
    const $ = cheerio.load(content);

    // Process each highlight
    highlights.forEach(highlight => {
      const { type, highlightId, text } = highlight;

      if (type === 'text') {
        // Update text and remove style
        $(`#${highlightId}`).text(text).removeAttr('style');
        
        // Find and update elements with the corresponding data attribute
        const elements = $(`[data-highlight-id="${highlightId}"]`);
        if (elements.length > 0) {
          elements.each(function () {
            $(this).text(text).removeAttr('style');
          });
        } else {
          console.log(`No elements found with data-highlight-id="${highlightId}"`);
        }
      } else {
        // Update HTML content
        //$(`#${highlightId}`).html(text).removeAttr('style');
        $(`#${highlightId}`).html(text)
      }
    });

    $('td').each(function() {
      const $this = $(this);
      if ($this.css('background') === 'inherit') {
        $this.css('background', '');
      }
      if ($this.css('background-color') === 'inherit') {
        $this.css('background-color', '');
      }
    });

    // Return updated HTML
    return $.html();
  } catch (error) {
    console.error('An error occurred during the export:', error.message);
    throw new Error('An error occurred during the export.');
  }
}

async function imageConversion(htmlString) {
  try {


    const content = htmlString;
    const $ = cheerio.load(content);

    const imgTags = $('img');
    for (let i = 0; i < imgTags.length; i++) {
      const img = imgTags[i];
      const src = $(img).attr('src');
      if (src) {
        const base64Image = await imageToBase64(src);
        $(img).attr('src', base64Image);
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
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'];
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to base64: ${error.message}`);
    return url; // Return the original URL if there's an error
  }
}



exports.updateDocumentContent = async (req, res) => {
  try {
    const docId = req.params.id;
    const { content } = req.body;
    console.log("saving document changes from preview page ",docId);
    const document = await documentService.updateDocumentContent(docId,content);
    //console.log(document);
    res.send(document);
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
};

