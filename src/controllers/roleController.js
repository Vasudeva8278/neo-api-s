const Role = require('../models/Role');

// Create Role
exports.createRole = async (req, res) => {
  try {
    const { name, features } = req.body;
    const role = new Role({ name, features });
    await role.save();
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ message: 'Error creating role', error: err.message });
  }
};

// Get All Roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json(roles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching roles', error: err.message });
  }
};

// Get Role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.status(200).json(role);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching role', error: err.message });
  }
};

// Update Role
exports.updateRole = async (req, res) => {
  try {
    const { name, features } = req.body;
    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      { name, features },
      { new: true, runValidators: true }
    );
    if (!updatedRole) return res.status(404).json({ message: 'Role not found' });
    res.status(200).json(updatedRole);
  } catch (err) {
    res.status(500).json({ message: 'Error updating role', error: err.message });
  }
};

// Delete Role
exports.deleteRole = async (req, res) => {
  try {
    const deletedRole = await Role.findByIdAndDelete(req.params.id);
    if (!deletedRole) return res.status(404).json({ message: 'Role not found' });
    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting role', error: err.message });
  }
};
