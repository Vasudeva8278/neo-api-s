const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  features: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
