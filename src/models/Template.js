const mongoose = require('mongoose');
const { Schema } = mongoose;

const templateSchema = new Schema({
  fileName: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  highlights: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Highlight',
  }],
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
  }],
  locationUrl:{
    type: String,
    required: false,
  },
  thumbnail:{
    type: String,
    required: false,
  },
  projectId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default : null,
  },
  createdBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
}, {
  timestamps: {
    createdAt: 'createdTime',
    updatedAt: 'updatedTime'
  }
});

module.exports = mongoose.model('Template', templateSchema);
