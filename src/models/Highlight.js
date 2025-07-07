const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define a schema for highlights
const highlightSchema = new Schema({
    id: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    type:{
      type: String,
      required: true,
      default :'text'
    },
    createdBy:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
  });
  
  module.exports = mongoose.model('Highlight', highlightSchema);