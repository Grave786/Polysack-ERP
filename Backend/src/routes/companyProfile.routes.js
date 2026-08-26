const express = require('express');
const router = express.Router();
const { getCompanyProfile, updateCompanyProfile } = require('../controllers/companyProfile.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/admin/company-profile
 * @desc    Get Tenant Company Profile & GST Settings
 * @access  Private (USERS:READ permission - pending ADMINISTRATION module approval)
 */
router.get('/', authenticate, checkPermission('USERS', 'READ'), getCompanyProfile);

/**
 * @route   PATCH /api/admin/company-profile
 * @desc    Update Tenant Company Profile & GST Settings
 * @access  Private (USERS:UPDATE permission - pending ADMINISTRATION module approval)
 */
router.patch('/', authenticate, checkPermission('USERS', 'UPDATE'), updateCompanyProfile);
router.put('/', authenticate, checkPermission('USERS', 'UPDATE'), updateCompanyProfile);

module.exports = router;
