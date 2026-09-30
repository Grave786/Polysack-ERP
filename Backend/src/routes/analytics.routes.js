const express = require('express');
const router = express.Router();
const {
    getFinancialSummary,
    getProductionYieldMetrics,
    getInventoryValuation,
    getGstTaxRegister,
    getOperatorProductivityMetrics,
    saveGstFiling,
    deleteGstFiling
} = require('../controllers/analytics.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('ANALYTICS'));

router.get('/financial-summary', authenticate, checkPermission('ANALYTICS', 'READ'), getFinancialSummary);
router.get('/production-yield-metrics', authenticate, checkPermission('ANALYTICS', 'READ'), getProductionYieldMetrics);
router.get('/production-yield', authenticate, checkPermission('ANALYTICS', 'READ'), getProductionYieldMetrics);
router.get('/inventory-valuation', authenticate, checkPermission('ANALYTICS', 'READ'), getInventoryValuation);
router.get('/gst-register', authenticate, checkPermission('ANALYTICS', 'READ'), getGstTaxRegister);
router.get('/operator-productivity', authenticate, checkPermission('ANALYTICS', 'READ'), getOperatorProductivityMetrics);
router.post('/gst-filing', authenticate, checkPermission('ANALYTICS', 'CREATE'), saveGstFiling);
router.delete('/gst-filing/:id', authenticate, checkPermission('ANALYTICS', 'DELETE'), deleteGstFiling);

module.exports = router;

