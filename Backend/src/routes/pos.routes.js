const express = require('express');
const router = express.Router();
const { directCheckout } = require('../controllers/pos.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/pos/checkout
 * @desc    Direct Counter Checkout (POS Billing)
 * @access  Private (SALES:CREATE)
 */
router.post('/checkout', authenticate, checkTenantModule('POS'), checkPermission('SALES', 'CREATE'), directCheckout);

module.exports = router;
