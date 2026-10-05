const express = require('express');
const router = express.Router();
const { getDashboardSummary, globalSearch } = require('../controllers/dashboard.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get Executive Dashboard Summary & KPIs
 * @access  Private (SALES:READ / ANALYTICS:READ permission)
 */
router.get('/summary', authenticate, checkPermission('SALES', 'READ'), getDashboardSummary);

/**
 * @route   GET /api/dashboard/global-search
 *          GET /api/dashboard/search
 * @desc    Global ERP search across transactions, master data codes, and fabric rolls
 * @access  Private (Authenticated users)
 */
router.get('/global-search', authenticate, globalSearch);
router.get('/search', authenticate, globalSearch);

module.exports = router;
