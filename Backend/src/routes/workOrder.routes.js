const express = require('express');
const router = express.Router();
const {
    createWorkOrder,
    advanceStage,
    cancelWorkOrder,
    getWorkOrders,
    getWorkOrderById
} = require('../controllers/workOrder.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('PRODUCTION'));

/**
 * @route   POST /api/work-orders
 * @desc    Create a new Work Order (atomically consumes BOM raw materials)
 * @access  Private (PRODUCTION:CREATE)
 */
router.post('/', authenticate, checkPermission('PRODUCTION', 'CREATE'), createWorkOrder);

/**
 * @route   GET /api/work-orders
 * @desc    Get all Work Orders for current tenant
 * @access  Private (PRODUCTION:READ)
 */
router.get('/', authenticate, checkPermission('PRODUCTION', 'READ'), getWorkOrders);

/**
 * @route   GET /api/work-orders/:id
 * @desc    Get Work Order by ID
 * @access  Private (PRODUCTION:READ)
 */
router.get('/:id', authenticate, checkPermission('PRODUCTION', 'READ'), getWorkOrderById);

/**
 * @route   PATCH /api/work-orders/:id/advance-stage
 * @desc    Advance active stage of Work Order (and produce finished goods if final stage)
 * @access  Private (PRODUCTION:UPDATE)
 */
router.patch('/:id/advance-stage', authenticate, checkPermission('PRODUCTION', 'UPDATE'), advanceStage);

/**
 * @route   PATCH /api/work-orders/:id/cancel
 * @desc    Cancel Work Order
 * @access  Private (PRODUCTION:UPDATE)
 */
router.patch('/:id/cancel', authenticate, checkPermission('PRODUCTION', 'UPDATE'), cancelWorkOrder);

module.exports = router;
