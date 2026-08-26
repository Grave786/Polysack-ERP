const express = require('express');
const router = express.Router();
const { createTenant, getTenantProfile, updateTenantProfile } = require('../controllers/tenant.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/tenants/profile
 * @desc    Get active tenant profile & GST configuration
 * @access  Private
 */
router.get('/profile', authenticate, getTenantProfile);

/**
 * @route   PUT /api/tenants/profile
 * @desc    Update active tenant profile & GST configuration
 * @access  Private
 */
router.put('/profile', authenticate, updateTenantProfile);

/**
 * @route   POST /api/tenants
 * @desc    Create a new tenant along with its Tenant Admin user & role
 * @access  Private (Super Admin / USERS:CREATE permission)
 */
router.post('/', authenticate, checkPermission('USERS', 'CREATE'), createTenant);

module.exports = router;
