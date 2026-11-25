const express = require('express');
const router = express.Router();
const { submitPublicEnquiry, getPublicCompanyInfo } = require('../controllers/publicEnquiry.controller');

/**
 * @route   GET /api/public/company-info
 * @desc    Get whitelisted company profile details for marketing website
 * @access  Public
 */
router.get('/company-info', getPublicCompanyInfo);

/**
 * @route   POST /api/public/enquiries
 * @desc    Submit public sales enquiry from marketing website
 * @access  Public
 */
router.post('/enquiries', submitPublicEnquiry);

module.exports = router;
