const express = require('express');
const router = express.Router();
const { createUser, getUsers, toggleUserActive, updateUser, updateProfile, changePassword } = require('../controllers/user.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   PUT /api/users/profile
 * @desc    Update active user's profile info
 * @access  Private
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change active user's password
 * @access  Private
 */
router.put('/change-password', authenticate, changePassword);

/**
 * @route   POST /api/users
 * @desc    Create a new tenant user
 * @access  Private (USERS:CREATE)
 */
router.post('/', authenticate, checkPermission('USERS', 'CREATE'), createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users for current tenant
 * @access  Private (USERS:READ)
 */
router.get('/', authenticate, checkPermission('USERS', 'READ'), getUsers);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user role & facility
 * @access  Private (USERS:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('USERS', 'UPDATE'), updateUser);

/**
 * @route   PATCH /api/users/:id/toggle-active
 * @desc    Soft delete / activate user
 * @access  Private (USERS:UPDATE)
 */
router.patch('/:id/toggle-active', authenticate, checkPermission('USERS', 'UPDATE'), toggleUserActive);

module.exports = router;
