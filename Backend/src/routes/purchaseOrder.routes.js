const express = require('express');
const router = express.Router();
const {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    updateStatus,
    deletePurchaseOrder
} = require('../controllers/purchaseOrder.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/purchase-orders
 * @desc    Create a new Purchase Order
 * @access  Private (PROCUREMENT:CREATE)
 */
router.post('/', authenticate, checkPermission('PROCUREMENT', 'CREATE'), createPurchaseOrder);

/**
 * @route   GET /api/purchase-orders
 * @desc    Get all Purchase Orders for current tenant
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/', authenticate, checkPermission('PROCUREMENT', 'READ'), getPurchaseOrders);

/**
 * @route   PATCH /api/purchase-orders/:id/status
 * @route   PUT /api/purchase-orders/:id/status
 * @desc    Update Purchase Order status (DRAFT/PENDING_APPROVAL -> SENT_TO_SUPPLIER or CANCELLED)
 * @access  Private (PROCUREMENT:UPDATE)
 */
router.patch('/:id/status', authenticate, checkPermission('PROCUREMENT', 'UPDATE'), updateStatus);
router.put('/:id/status', authenticate, checkPermission('PROCUREMENT', 'UPDATE'), updateStatus);

/**
 * @route   GET /api/purchase-orders/:id
 * @desc    Get Purchase Order by ID
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/:id', authenticate, checkPermission('PROCUREMENT', 'READ'), getPurchaseOrderById);

/**
 * @route   PUT /api/purchase-orders/:id
 * @desc    Update Purchase Order (Allowed ONLY when status is DRAFT)
 * @access  Private (PROCUREMENT:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('PROCUREMENT', 'UPDATE'), updatePurchaseOrder);

/**
 * @route   DELETE /api/purchase-orders/:id
 * @desc    Soft delete Purchase Order (Allowed ONLY when DRAFT or CANCELLED)
 * @access  Private (PROCUREMENT:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('PROCUREMENT', 'DELETE'), deletePurchaseOrder);

module.exports = router;
