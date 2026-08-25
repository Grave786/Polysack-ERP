const express = require('express');
const router = express.Router();
const {
    createDispatch,
    updateDeliveryStatus,
    getDispatches,
    getDispatchById
} = require('../controllers/dispatch.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/dispatches
 * @desc    Create a new Dispatch note (Fulfill SalesOrder finished goods)
 * @access  Private (SALES:CREATE)
 */
router.post('/', authenticate, checkPermission('SALES', 'CREATE'), createDispatch);

/**
 * @route   GET /api/dispatches
 * @desc    Get all Dispatches for current tenant
 * @access  Private (SALES:READ)
 */
router.get('/', authenticate, checkPermission('SALES', 'READ'), getDispatches);

/**
 * @route   GET /api/dispatches/:id
 * @desc    Get Dispatch by ID
 * @access  Private (SALES:READ)
 */
router.get('/:id', authenticate, checkPermission('SALES', 'READ'), getDispatchById);

/**
 * @route   PATCH /api/dispatches/:id/delivery-status
 * @desc    Update Delivery Status (IN_TRANSIT -> DELIVERED / RETURNED)
 * @access  Private (SALES:UPDATE)
 */
router.patch('/:id/delivery-status', authenticate, checkPermission('SALES', 'UPDATE'), updateDeliveryStatus);

// NOTE: No PUT or DELETE routes are exposed for Dispatches because outbound goods movements are immutable ledger records.

module.exports = router;
