const ActivityLog = require('../models/activityLogModel');

const logActivity = (action, details) => async (req, res, next) => {
  try {
    console.log(`[INFO] User ${req.user.email} performed action: ${action}`);
    const log = new ActivityLog({
      user: req.user._id,
      action,
      details,
    });
    await log.save();
    console.log(`[INFO] Activity logged: ${action}`);
  } catch (err) {
    console.error(`[ERROR] Failed to log activity: ${err.message}`);
  }
  next();
};

module.exports = logActivity;
