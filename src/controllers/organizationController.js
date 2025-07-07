const Organization = require('../models/organizationModel');
const logActivity = require('../middleware/logActivity');

// Get all organizations (excluding soft-deleted)
const getOrganizations = async (req, res) => {
  try {
    console.log(`[INFO] User ${req.user.email} requested all organizations`);
    const organizations = await Organization.find({ isDeleted: false });
    console.log(`[INFO] Successfully retrieved ${organizations.length} organizations`);
    res.json(organizations);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve organizations: ${err.message}`);
    res.status(500).json({ message: 'Failed to retrieve organizations', error: err.message });
  }
};

// Get a specific organization
const getOrganization = async (req, res) => {
  try {
    console.log(`[INFO] User ${req.user.email} requested organization ${req.params.id}`);
    const organization = await Organization.findById(req.params.id);
    if (!organization || organization.isDeleted) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    console.log(`[INFO] Successfully retrieved organization ${organization.name}`);
    res.json(organization);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve organization ${req.params.id}: ${err.message}`);
    res.status(500).json({ message: 'Failed to retrieve organization', error: err.message });
  }
};

// Create a new organization (SuperAdmin only)
const createOrganization = async (req, res) => {
  const organization = new Organization(req.body);
  try {
    const newOrganization = await organization.save();
    await logActivity('createOrganization', `Organization ${newOrganization.name} created`)(req, res, () => {});
    console.log(`[INFO] User ${req.user.email} created organization ${newOrganization.name}`);
    res.status(201).json(newOrganization);
  } catch (err) {
    console.error(`[ERROR] Failed to create organization: ${err.message}`);
    res.status(400).json({ message: 'Failed to create organization', error: err.message });
  }
};

// Approve an organization (SuperAdmin only)
const approveOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    organization.status = 'Approved';
    organization.subscription.startDate = new Date();
    organization.subscription.endDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    organization.subscription.paymentStatus = 'Completed';
    await organization.save();

    await logActivity('approveOrganization', `Organization ${organization.name} approved`)(req, res, () => {});
    console.log(`[INFO] User ${req.user.email} approved organization ${organization.name}`);
    res.json(organization);
  } catch (err) {
    console.error(`[ERROR] Failed to approve organization ${req.params.id}: ${err.message}`);
    res.status(400).json({ message: 'Failed to approve organization', error: err.message });
  }
};

// Update an organization
const updateOrganization = async (req, res) => {
  try {
    const updatedOrganization = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedOrganization || updatedOrganization.isDeleted) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    await logActivity('updateOrganization', `Organization ${updatedOrganization.name} updated`)(req, res, () => {});
    console.log(`[INFO] User ${req.user.email} updated organization ${updatedOrganization.name}`);
    res.json(updatedOrganization);
  } catch (err) {
    console.error(`[ERROR] Failed to update organization ${req.params.id}: ${err.message}`);
    res.status(400).json({ message: 'Failed to update organization', error: err.message });
  }
};

// Soft delete an organization
const deleteOrganization = async (req, res) => {
  try {
    const deletedOrganization = await Organization.findByIdAndUpdate(req.params.id, { isDeleted: true, status: 'Disabled' }, { new: true });
    if (!deletedOrganization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    await logActivity('deleteOrganization', `Organization ${deletedOrganization.name} soft deleted`)(req, res, () => {});
    console.log(`[INFO] User ${req.user.email} soft deleted organization ${deletedOrganization.name}`);
    res.json({ message: 'Organization soft deleted' });
  } catch (err) {
    console.error(`[ERROR] Failed to soft delete organization ${req.params.id}: ${err.message}`);
    res.status(500).json({ message: 'Failed to soft delete organization', error: err.message });
  }
};

module.exports = {
  getOrganizations,
  getOrganization,
  createOrganization,
  approveOrganization,
  updateOrganization,
  deleteOrganization,
};
