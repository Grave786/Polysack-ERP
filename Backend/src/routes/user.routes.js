const express = require('express');
const router = express.Router();
const { createUser, getUsers } = require('../controllers/user.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

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

module.exports = router;
