const express = require('express');
const router = express.Router();
const { createRole, getRoles, getAllPermissions, updateRole, deleteRole } = require('../controllers/role.controller');
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
router.delete('/:id', authenticate, checkPermission('ROLES', 'DELETE'), deleteRole);

module.exports = router;
