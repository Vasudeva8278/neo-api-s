const Template = require('../models/Template');

async function getAllTemplates() {
    const templates = await Template.find({}).populate('highlights');
  return templates;
}

async function getTemplateById(id) {
  return await Template.findById(id)
              .populate('highlights')
              .populate('projectId');
}

async function createTemplate(data) {
  const template = new Template(data);
  return await template.save();
}

async function updateTemplate(id, data) {
  return await Template.findByIdAndUpdate(id, data, { new: true });
}

async function deleteTemplate(id) {
  return await Template.findByIdAndDelete(id);
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
