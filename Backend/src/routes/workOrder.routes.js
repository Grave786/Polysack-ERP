const express = require('express');
const router = express.Router();
const {
    createWorkOrder,
    advanceStage,
    cancelWorkOrder,
    getWorkOrders,
    getWorkOrderById,
    getAvailableRolls
} = require('../controllers/workOrder.controller');
const {
    createProductionLog,
    getProductionLogs,
    getProductionLogsSummary,
    getWorkOrderOverallProductionSummary,
    updateProductionLog,
    deleteProductionLog
} = require('../controllers/productionLog.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('PRODUCTION'));

/**
 * @route   GET /api/work-orders/:woId/production-summary
 * @desc    Get consolidated overall production summary across all stages for a Work Order
 * @access  Private (PRODUCTION:READ)
 */
router.get('/:woId/production-summary', authenticate, checkPermission('PRODUCTION', 'READ'), getWorkOrderOverallProductionSummary);
router.get('/:woId/overall-summary', authenticate, checkPermission('PRODUCTION', 'READ'), getWorkOrderOverallProductionSummary);

/**
 * @route   POST /api/work-orders/:woId/stages/:stageId/logs
 * @desc    Create a new ProductionLog entry for an assigned operator on a stage
 * @access  Private (PRODUCTION:UPDATE)
 */
router.post('/:woId/stages/:stageId/logs', authenticate, checkPermission('PRODUCTION', 'UPDATE'), createProductionLog);
router.post('/:woId/logs', authenticate, checkPermission('PRODUCTION', 'UPDATE'), createProductionLog);

/**
 * @route   GET /api/work-orders/:woId/stages/:stageId/logs/summary
 * @desc    Get operator-wise and date-wise production summary & matrix
 * @access  Private (PRODUCTION:READ)
 */
router.get('/:woId/stages/:stageId/logs/summary', authenticate, checkPermission('PRODUCTION', 'READ'), getProductionLogsSummary);
router.get('/:woId/logs/summary', authenticate, checkPermission('PRODUCTION', 'READ'), getProductionLogsSummary);

/**
 * @route   GET /api/work-orders/:woId/stages/:stageId/logs
 * @desc    Get all ProductionLog entries for a stage
 * @access  Private (PRODUCTION:READ)
 */
router.get('/:woId/stages/:stageId/logs', authenticate, checkPermission('PRODUCTION', 'READ'), getProductionLogs);
router.get('/:woId/logs', authenticate, checkPermission('PRODUCTION', 'READ'), getProductionLogs);

/**
 * @route   PUT /api/work-orders/:woId/stages/:stageId/logs/:logId
 * @desc    Update a ProductionLog entry
 * @access  Private (PRODUCTION:UPDATE)
 */
router.put('/:woId/stages/:stageId/logs/:logId', authenticate, checkPermission('PRODUCTION', 'UPDATE'), updateProductionLog);
router.put('/logs/:logId', authenticate, checkPermission('PRODUCTION', 'UPDATE'), updateProductionLog);

/**
 * @route   DELETE /api/work-orders/:woId/stages/:stageId/logs/:logId
 * @desc    Delete a ProductionLog entry
 * @access  Private (PRODUCTION:UPDATE)
 */
router.delete('/:woId/stages/:stageId/logs/:logId', authenticate, checkPermission('PRODUCTION', 'UPDATE'), deleteProductionLog);
router.delete('/logs/:logId', authenticate, checkPermission('PRODUCTION', 'UPDATE'), deleteProductionLog);

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
 * @route   GET /api/work-orders/available-rolls
 * @desc    Get rolls with remaining meters stock for roll selection
 * @access  Private (PRODUCTION:READ)
 */
router.get('/available-rolls', authenticate, checkPermission('PRODUCTION', 'READ'), getAvailableRolls);

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
