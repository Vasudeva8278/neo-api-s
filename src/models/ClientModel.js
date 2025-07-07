const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const clientSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    documents: [
      {
        templateId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Template", // Reference the Template model
          required: true,
        },
        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document", // Reference the Document model
          required: true,
        },
      },
    ],
    details: [
      {
        label: { type: String, required: false },
        value: { type: String, required: false },
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

const Client = mongoose.model("Client", clientSchema);

module.exports = Client;
