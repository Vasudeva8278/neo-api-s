const ActivityLog = require('../models/activityLogModel');

// Get all activity logs (SuperAdmin only)
const getAllActivityLogs = async (req, res) => {
  try {
    console.log(`[INFO] SuperAdmin ${req.user.email} is requesting all activity logs`);
    const logs = await ActivityLog.find().populate('user', 'email name');
    console.log(`[INFO] Successfully retrieved ${logs.length} activity logs`);
    res.json(logs);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve activity logs: ${err.message}`);
    res.status(500).json({ message: 'Failed to retrieve activity logs', error: err.message });
  }
};

// Get activity logs for a specific organization (OrgAdmin or SuperAdmin)
const getOrgActivityLogs = async (req, res) => {
  try {
    console.log(`[INFO] OrgAdmin ${req.user.email} from organization ${req.user.orgId} is requesting activity logs`);
    const logs = await ActivityLog.find({ 'user.orgId': req.user.orgId }).populate('user', 'email name');
    console.log(`[INFO] Successfully retrieved ${logs.length} activity logs for organization ${req.user.orgId}`);
    res.json(logs);
  } catch (err) {
    console.error(`[ERROR] Failed to retrieve activity logs for organization ${req.user.orgId}: ${err.message}`);
    res.status(500).json({ message: 'Failed to retrieve activity logs', error: err.message });
  }
};

module.exports = {
  getAllActivityLogs,
  getOrgActivityLogs,
};
