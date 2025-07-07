const express = require('express');
const router = express.Router();
const {
  getOrganizations,
  getOrganization,
  createOrganization,
  approveOrganization,
  updateOrganization,
  deleteOrganization,
} = require('../controllers/organizationController');
const { auth, admin } = require('../middleware/auth');

// Get all organizations
router.get('/', auth, getOrganizations);

// Get a specific organization
router.get('/:id', auth, getOrganization);

// Create a new organization (SuperAdmin only)
router.post('/', auth, admin, createOrganization);

// Approve an organization (SuperAdmin only)
router.put('/:id/approve', auth, admin, approveOrganization);

// Update an organization
router.put('/:id', auth, admin, updateOrganization);

// Soft delete an organization
router.delete('/:id', auth, admin, deleteOrganization);

module.exports = router;
