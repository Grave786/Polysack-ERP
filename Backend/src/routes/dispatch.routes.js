const express = require('express');
const router = express.Router();
const {
    getDispatchableSources,
    createDispatch,
    updateDeliveryStatus,
    getDispatches,
    getDeliveryRegister,
    getDispatchById
} = require('../controllers/dispatch.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('DISPATCH'));

/**
 * @route   GET /api/dispatches/delivery-register
 * @desc    Get detailed line-item level Delivery Register
 * @access  Private (DISPATCH:READ)
 */
router.get('/delivery-register', authenticate, checkPermission('DISPATCH', 'READ'), getDeliveryRegister);

/**
 * @route   GET /api/dispatches/dispatchable-sources
 * @desc    Get combined list of dispatchable Sales Orders & POS Invoices
 * @access  Private (DISPATCH:READ)
 */
router.get('/dispatchable-sources', authenticate, checkPermission('DISPATCH', 'READ'), getDispatchableSources);
router.get('/dispatchable-orders', authenticate, checkPermission('DISPATCH', 'READ'), getDispatchableSources);

/**
 * @route   POST /api/dispatches
 * @desc    Create a new Dispatch note (Fulfill SalesOrder or POS Invoice finished goods)
 * @access  Private (DISPATCH:CREATE)
 */
router.post('/', authenticate, checkPermission('DISPATCH', 'CREATE'), createDispatch);

/**
 * @route   GET /api/dispatches
 * @desc    Get all Dispatches for current tenant
 * @access  Private (DISPATCH:READ)
 */
router.get('/', authenticate, checkPermission('DISPATCH', 'READ'), getDispatches);

/**
 * @route   GET /api/dispatches/:id
 * @desc    Get Dispatch by ID
 * @access  Private (DISPATCH:READ)
 */
router.get('/:id', authenticate, checkPermission('DISPATCH', 'READ'), getDispatchById);

const Dispatch = require('../models/dispatch.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

/**
 * @route   PATCH /api/dispatches/:id/delivery-status
 * @desc    Update Delivery Status (IN_TRANSIT -> DELIVERED / RETURNED)
 * @access  Private (DISPATCH:UPDATE)
 */
router.patch('/:id/delivery-status', authenticate, checkPermission('DISPATCH', 'UPDATE'), updateDeliveryStatus);

/**
 * @route   POST /api/dispatches/bulk-delete
 * @desc    Rejects deletion of immutable dispatch movement records
 * @access  Private
 */
const rejectDispatchModification = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Dispatch and logistics ledger records are immutable and cannot be modified or deleted directly.'
    });
};

router.put('/:id', authenticate, rejectDispatchModification);
router.delete('/:id', authenticate, rejectDispatchModification);

module.exports = router;
