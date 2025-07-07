const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  subscriptionPlan: {
    type: String,
    enum: ['Basic', 'Premium', 'Gold'],
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Payment', paymentSchema);
