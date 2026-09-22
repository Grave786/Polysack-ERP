const express = require('express');
const router = express.Router();
const { createRole, getRoles, getAllPermissions, updateRole, deleteRole, toggleRoleStatus } = require('../controllers/role.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/roles/permissions
 * @desc    Get all available system permissions
 * @access  Private
 */
router.get('/permissions', authenticate, getAllPermissions);
router.get('/permissions-list', authenticate, getAllPermissions);

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

/**
 * @route   PUT /api/roles/:id
 * @desc    Update a role's name & permissions
 * @access  Private (ROLES:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('ROLES', 'UPDATE'), updateRole);

/**
 * @route   DELETE /api/roles/:id
 * @desc    Delete a custom role
 * @access  Private (ROLES:DELETE)
 */
const Role = require('../models/role.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('ROLES', 'DELETE'), deleteRole);

/**
 * @route   PATCH /api/roles/:id/status
 * @desc    Toggle a role's isActive status (deactivate / reactivate)
 * @access  Private (ROLES:UPDATE)
 */
router.patch('/:id/status', authenticate, checkPermission('ROLES', 'UPDATE'), toggleRoleStatus);

/**
 * @route   POST /api/roles/bulk-delete
 * @desc    Bulk soft delete Roles
 * @access  Private (ROLES:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('ROLES', 'DELETE'), createBulkDeleteHandler(Role, { resourceName: 'Roles' }));

module.exports = router;
