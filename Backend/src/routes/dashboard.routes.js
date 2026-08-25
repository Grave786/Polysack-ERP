const express = require('express');
const router = express.Router();
const { getDashboardSummary } = require('../controllers/dashboard.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get Executive Dashboard Summary & KPIs
 * @access  Private (SALES:READ / ANALYTICS:READ permission)
 */
router.get('/summary', authenticate, checkPermission('SALES', 'READ'), getDashboardSummary);

module.exports = router;
