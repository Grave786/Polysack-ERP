const express = require('express');
const router = express.Router();
const { createRole, getRoles } = require('../controllers/role.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/roles
 * @desc    Create a new role for current tenant
 * @access  Private (ROLES:CREATE)
 */
router.post('/', authenticate, checkPermission('ROLES', 'CREATE'), createRole);

/**
 * @route   GET /api/roles
 * @desc    Get all roles for current tenant
 * @access  Private (ROLES:READ)
 */
router.get('/', authenticate, checkPermission('ROLES', 'READ'), getRoles);

module.exports = router;
