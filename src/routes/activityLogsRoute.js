const express = require('express');
const router = express.Router();
const {
  getAllActivityLogs,
  getOrgActivityLogs,
} = require('../controllers/activityLogController');
const { auth, admin, orgAdmin } = require('../middleware/auth');

// Get all activity logs (SuperAdmin only)
router.get('/all', auth, admin, getAllActivityLogs);

// Get activity logs for a specific organization (OrgAdmin or SuperAdmin)
router.get('/org', auth, orgAdmin, getOrgActivityLogs);

module.exports = router;
