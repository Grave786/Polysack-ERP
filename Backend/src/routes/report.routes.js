const express = require('express');
const router = express.Router();
const {
    getPLSummary,
    getProductionYieldReport,
    getInventoryValuationReport,
    getGstRegisterReport
} = require('../controllers/report.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('ANALYTICS'));

/**
 * @route   GET /api/reports/pl-summary
 * @desc    Financial P&L Summary Report (Report #1)
 * @access  Private (ANALYTICS:READ permission)
 */
router.get('/pl-summary', authenticate, checkPermission('ANALYTICS', 'READ'), getPLSummary);

/**
 * @route   GET /api/reports/production-yield
 * @desc    Production Yield & Scrap Report (Report #2)
 * @access  Private (ANALYTICS:READ permission)
 */
router.get('/production-yield', authenticate, checkPermission('ANALYTICS', 'READ'), getProductionYieldReport);

/**
 * @route   GET /api/reports/inventory-valuation
 * @desc    Inventory Valuation Report (Report #3)
 * @access  Private (ANALYTICS:READ permission)
 */
router.get('/inventory-valuation', authenticate, checkPermission('ANALYTICS', 'READ'), getInventoryValuationReport);

/**
 * @route   GET /api/reports/gst-register
 * @desc    Sales & GST Tax Register Report (Report #4)
 * @access  Private (ANALYTICS:READ permission)
 */
router.get('/gst-register', authenticate, checkPermission('ANALYTICS', 'READ'), getGstRegisterReport);

module.exports = router;
