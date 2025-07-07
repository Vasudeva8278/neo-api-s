const express = require('express');
const router = express.Router();
const { getPayments, createPayment } = require('../controllers/paymentController');
const { auth, admin, orgAdmin } = require('../middleware/auth');

// Get all payments for an organization (OrgAdmin or SuperAdmin)
router.get('/:orgId', auth, orgAdmin, getPayments);

// Create a new payment record (SuperAdmin only)
router.post('/', auth, admin, createPayment);

module.exports = router;
