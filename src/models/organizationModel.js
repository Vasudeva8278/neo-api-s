const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  contactNumber: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['New', 'Pending', 'Approved', 'Blocked', 'Disabled', 'Hold'],
    default: 'New',
  },
  subscription: {
    plan: {
      type: String,
      enum: ['Basic', 'Premium', 'Gold'],
      default: 'Basic',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending',
    },
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  paymentnavigate: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
  }],
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Organization', organizationSchema);
