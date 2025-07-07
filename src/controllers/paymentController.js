const Payment = require('../models/paymentModel');
const Organization = require('../models/organizationModel');
const logActivity = require('../middleware/logActivity');

// Get all payments for an organization
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ organization: req.params.orgId }).sort({ date: -1 });
    console.log(`[INFO] Retrieved ${payments.length} payments for organization ${req.params.orgId}`);
    res.json(payments);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve payments for organization ${req.params.orgId}: ${err.message}`);
    res.status(500).json({ message: 'Failed to retrieve payments', error: err.message });
  }
};

// Create a new payment record
const createPayment = async (req, res) => {
  const { organization, amount, subscriptionPlan, transactionId } = req.body;

  try {
    const newPayment = new Payment({ organization, amount, subscriptionPlan, transactionId, status: 'Completed' });
    await newPayment.save();

    await Organization.findByIdAndUpdate(organization, {
      $push: { paymentnavigate: newPayment._id },
      'subscription.paymentStatus': 'Completed',
      'subscription.startDate': new Date(),
      'subscription.endDate': new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    });

    await logActivity('createPayment', `Payment ${transactionId} created for organization ${organization}`)(req, res, () => {});
    console.log(`[INFO] Created payment ${transactionId} for organization ${organization}`);
    res.status(201).json(newPayment);
  } catch (err) {
    console.error(`[ERROR] Failed to create payment: ${err.message}`);
    res.status(400).json({ message: 'Failed to create payment', error: err.message });
  }
};

module.exports = {
  getPayments,
  createPayment,
};
