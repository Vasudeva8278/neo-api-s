const Document = require('../models/Document');
const Highlight = require('../models/Highlight');
const Template = require('../models/Template');

async function getHighlightsByTemplateId(templateId) {
  const template = await Template.findById(templateId).populate({
    path: 'documents',
    populate: { path: 'highlights.id' },
  });
  if (!template) throw new Error('Template not found');
  return template.documents;
}

async function addNewHighlight(templateId, title, highlights) {
  const highlightIds = highlights.map(h => h.id);
  const highlightDocs = await Highlight.find({ _id: { $in: highlightIds } });

  if (highlightDocs.length !== highlightIds.length) {
    throw new Error('Invalid highlight IDs provided');
  }

  const document = new Document({
    fileName: title,
    highlights: highlights.map(h => ({
      id: h.id,
      label: h.label,
      text: h.text,
      type: h.type,
    })),
  });

  await document.save();
  await Template.findByIdAndUpdate(templateId, { $push: { documents: document._id } });
  return document._id;
}
async function getDocumentId(id) {
  return await Document.findById(id).populate('highlights');
}

async function updateHighlight(docId, title, highlights) {
  const document = await Document.findById(docId).populate('highlights.id');
  if (!document) throw new Error('Document not found');

  document.fileName = title;
  document.highlights = highlights.map(h => ({
    id: h.id,
    label: h.label,
    text: h.text,
  }));
  await document.save();
  return document;
}

async function deleteDocument (documentId) {
  // Remove the document
  const deletedDocument = await Document.findByIdAndDelete(documentId);

  if (!deletedDocument) {
    console.log('Document not found')
    throw new Error('Document not found');
  }

  // Remove the document reference from all templates
  await Template.updateMany(
    { documents: documentId },
    { $pull: { documents: documentId } }
  );

  return deletedDocument;
};

async function getDocumentByIdAndUserId(documentId, userId) {
  return await Document.findOne({ _id: documentId, createdBy: userId });
}


async function updateDocumentContent(documentId, documentContent){
  try{
      const document = await Document.findById(documentId);
      if (!document) {
        return res.status(404).send('Document not found');
      }
      document.content = documentContent;
      await document.save();
      return document;
  }
  catch(error){
    console.log(error);
  }
}


async function getCommonHighlighDataInDocuments(projectId,fileName){
  try{
  
      // Step 1: Fetch templates associated with the project
      const templates = await Template.find({ projectId }).select('_id documents');
     // console.log(templates)

      const documentIds = templates.reduce((acc, template) => {
        acc.push(...template.documents);
        return acc;
      }, []);
      
     // console.log('All Document IDs:', documentIds);

      const matchingDocuments = await Document.find({
        _id: { $in: documentIds },
        fileName: fileName,
      }).select('_id highlights');

      const highlights = matchingDocuments.reduce((acc, doc) => {
        acc.push(...doc.highlights);
        return acc;
      }, []);
      console.log("Fetched highlights:", highlights);
      return highlights; // Return only highlights
    } catch (error) {
      console.error("Error in getCommonHighlighDataInDocuments:", error);
      throw error; // Propagate error to the caller
    }
  }



module.exports = {
  getHighlightsByTemplateId,
  getDocumentId,
  addNewHighlight,
  updateHighlight,
  deleteDocument,
  updateDocumentContent,
  getDocumentByIdAndUserId,
  getCommonHighlighDataInDocuments,
};
