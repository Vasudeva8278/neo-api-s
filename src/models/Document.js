const mongoose = require("mongoose");
const { Schema } = mongoose;

const documentSchema = new Schema({
  fileName: {
    type: String,
    required: true,
  },
  content: {
    type: String,
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Template",
    required: true,
  },
  highlights: [
    {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Highlight",
      },
      highlightId: {
        type: String,
        required: true,
      },
      label: {
        type: String,
        required: true,
      },
      text: {
        type: String,
        required: false,
      },
      type: {
        type: String,
        required: false,
        default: "text",
      },
    },
  ],
  thumbnail: {
    type: String,
    required: false,
  },
  locationUrl: {
    type: String,
    required: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

module.exports = mongoose.model("Document", documentSchema);
