const express = require('express');
const router = express.Router();
const { createTenant } = require('../controllers/tenant.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/tenants
 * @desc    Create a new tenant along with its Tenant Admin user & role
 * @access  Private (Super Admin / USERS:CREATE permission)
 */
router.post('/', authenticate, checkPermission('USERS', 'CREATE'), createTenant);

module.exports = router;
