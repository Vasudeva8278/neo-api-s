const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectSchema = new Schema({
  projectName: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    required: false,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId, // Changed to ObjectId for referencing another project
    ref: 'Project', // Reference to the same 'Project' model for subprojects
    required: false,
  },
  template:[ {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template', // Reference to the Template model
    required: false,
  }],
  block:[ {
    type: String,
    required: false,
  }],
  property:[ {
    type: String,
    required: false,
  }],
  thumbnail:{
    type: String,
    default: null
  },
  createdBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Project', projectSchema);
