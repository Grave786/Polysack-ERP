const express = require('express');
const router = express.Router();
const {
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    updateSalesOrder,
    updateStatus,
    deleteSalesOrder
} = require('../controllers/salesOrder.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/sales-orders
 * @desc    Create a new Sales Order
 * @access  Private (SALES:CREATE)
 */
router.post('/', authenticate, checkPermission('SALES', 'CREATE'), createSalesOrder);

/**
 * @route   GET /api/sales-orders
 * @desc    Get all Sales Orders for current tenant
 * @access  Private (SALES:READ)
 */
router.get('/', authenticate, checkPermission('SALES', 'READ'), getSalesOrders);

/**
 * @route   GET /api/sales-orders/:id
 * @desc    Get Sales Order by ID
 * @access  Private (SALES:READ)
 */
router.get('/:id', authenticate, checkPermission('SALES', 'READ'), getSalesOrderById);

/**
 * @route   PUT /api/sales-orders/:id
 * @desc    Update Sales Order (Allowed ONLY when status is DRAFT or CONFIRMED)
 * @access  Private (SALES:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('SALES', 'UPDATE'), updateSalesOrder);

/**
 * @route   PATCH /api/sales-orders/:id/status
 * @desc    Update Sales Order status (DRAFT -> CONFIRMED -> READY_FOR_DISPATCH, or CANCELLED)
 * @access  Private (SALES:UPDATE)
 */
router.patch('/:id/status', authenticate, checkPermission('SALES', 'UPDATE'), updateStatus);

/**
 * @route   DELETE /api/sales-orders/:id
 * @desc    Soft delete Sales Order (Allowed ONLY when DRAFT or CANCELLED)
 * @access  Private (SALES:DELETE)
 */
const SalesOrder = require('../models/salesOrder.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('SALES', 'DELETE'), deleteSalesOrder);

/**
 * @route   POST /api/sales-orders/bulk-delete
 * @desc    Bulk cancel / soft delete Sales Orders
 * @access  Private (SALES:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('SALES', 'DELETE'), createBulkDeleteHandler(SalesOrder, { resourceName: 'Sales Orders', statusField: 'status', statusValue: 'CANCELLED' }));

module.exports = router;
