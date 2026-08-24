const express = require('express');
const router = express.Router();
const {
    createStockTransaction,
    getStockTransactions,
    getStockTransactionById
} = require('../controllers/stockTransaction.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/stock-transactions
 * @desc    Create a new stock transaction (Ledger entry - Immutable)
 * @access  Private (INVENTORY:CREATE)
 */
router.post('/', authenticate, checkPermission('INVENTORY', 'CREATE'), createStockTransaction);

/**
 * @route   GET /api/stock-transactions
 * @desc    Get all stock transactions for current tenant
 * @access  Private (INVENTORY:READ)
 */
router.get('/', authenticate, checkPermission('INVENTORY', 'READ'), getStockTransactions);

/**
 * @route   GET /api/stock-transactions/:id
 * @desc    Get stock transaction by ID
 * @access  Private (INVENTORY:READ)
 */
router.get('/:id', authenticate, checkPermission('INVENTORY', 'READ'), getStockTransactionById);

// NOTE: No PUT or DELETE routes are defined for stock transactions because ledger entries are immutable.
// Adjustments must be made via new StockTransaction entries of type 'ADJUSTMENT'.

module.exports = router;
