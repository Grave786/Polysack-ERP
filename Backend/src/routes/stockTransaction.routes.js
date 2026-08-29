const express = require('express');
const router = express.Router();
const {
    createStockTransaction,
    getStockTransactions,
    getStockTransactionById
} = require('../controllers/stockTransaction.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('INVENTORY'));

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

const StockTransaction = require('../models/stockTransaction.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

const rejectStockTransactionModification = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Stock ledger transactions are immutable audit records and cannot be modified or deleted after execution.'
    });
};

router.put('/:id', authenticate, rejectStockTransactionModification);
router.patch('/:id', authenticate, rejectStockTransactionModification);
router.delete('/:id', authenticate, rejectStockTransactionModification);
router.post('/bulk-delete', authenticate, createBulkDeleteHandler(StockTransaction, { resourceName: 'Stock Transactions', isImmutable: true }));

module.exports = router;
