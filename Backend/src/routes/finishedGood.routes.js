const express = require('express');
const router = express.Router();
const {
    createFinishedGood,
    getFinishedGoods,
    exportFinishedGoods,
    getFinishedGoodById,
    updateFinishedGood,
    deleteFinishedGood
} = require('../controllers/finishedGood.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('INVENTORY'));

/**
 * @route   POST /api/finished-goods
 * @desc    Create a new Finished Good
 * @access  Private (INVENTORY:CREATE)
 */
router.post('/', authenticate, checkPermission('INVENTORY', 'CREATE'), createFinishedGood);

/**
 * @route   GET /api/finished-goods
 * @desc    Get all Finished Goods for current tenant
 * @access  Private (INVENTORY:READ)
 */
router.get('/', authenticate, checkPermission('INVENTORY', 'READ'), getFinishedGoods);

/**
 * @route   GET /api/finished-goods/export
 * @desc    Export Finished Goods to CSV
 * @access  Private (INVENTORY:READ)
 */
router.get('/export', authenticate, checkPermission('INVENTORY', 'READ'), exportFinishedGoods);

/**
 * @route   GET /api/finished-goods/:id
 * @desc    Get Finished Good by ID
 * @access  Private (INVENTORY:READ)
 */
router.get('/:id', authenticate, checkPermission('INVENTORY', 'READ'), getFinishedGoodById);

/**
 * @route   PUT /api/finished-goods/:id
 * @desc    Update Finished Good by ID
 * @access  Private (INVENTORY:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('INVENTORY', 'UPDATE'), updateFinishedGood);

/**
 * @route   DELETE /api/finished-goods/:id
 * @desc    Soft delete Finished Good by ID
 * @access  Private (INVENTORY:DELETE)
 */
const FinishedGood = require('../models/finishedGood.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('INVENTORY', 'DELETE'), deleteFinishedGood);

/**
 * @route   POST /api/finished-goods/bulk-delete
 * @desc    Bulk soft delete Finished Goods
 * @access  Private (INVENTORY:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('INVENTORY', 'DELETE'), createBulkDeleteHandler(FinishedGood, { resourceName: 'Finished Goods' }));

module.exports = router;
