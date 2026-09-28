const express = require('express');
const router = express.Router();
const { getCompanyProfile, updateCompanyProfile } = require('../controllers/companyProfile.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/admin/company-profile
 * @desc    Get Tenant Company Profile & GST Settings
 * @access  Private (COMPANY_SETTINGS:READ)
 */
router.get('/', authenticate, checkPermission('COMPANY_SETTINGS', 'READ'), getCompanyProfile);

/**
 * @route   PATCH /api/admin/company-profile
 * @desc    Update Tenant Company Profile & GST Settings
 * @access  Private (COMPANY_SETTINGS:UPDATE)
 */
router.patch('/', authenticate, checkPermission('COMPANY_SETTINGS', 'UPDATE'), updateCompanyProfile);
router.put('/', authenticate, checkPermission('COMPANY_SETTINGS', 'UPDATE'), updateCompanyProfile);

module.exports = router;
