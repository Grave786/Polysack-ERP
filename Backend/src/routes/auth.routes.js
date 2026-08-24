const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/auth.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Restricted to authorized Super Admin/Admin)
 * @access  Private (Requires USERS:CREATE permission)
 */
router.post('/register', authenticate, checkPermission('USERS', 'CREATE'), register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get JWT token
 * @access  Public
 */
router.post('/login', login);

module.exports = router;
