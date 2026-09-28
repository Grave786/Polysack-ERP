const express = require('express');
const router = express.Router();
const {
    createShift,
    getShifts,
    seedDefaultShifts,
    getShiftById,
    updateShift,
    deleteShift
} = require('../controllers/shift.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('HR'));

/**
 * @route   POST /api/shifts
 * @desc    Create a new Shift
 * @access  Private (HR:CREATE)
 */
router.post('/', authenticate, checkPermission('HR', 'CREATE'), createShift);

/**
 * @route   POST /api/shifts/seed-default
 * @desc    Seed standard shifts (Shift A, Shift B, Night Shift)
 * @access  Private (HR:CREATE)
 */
router.post('/seed-default', authenticate, checkPermission('HR', 'CREATE'), seedDefaultShifts);

/**
 * @route   GET /api/shifts
 * @desc    Get all Shifts for current tenant
 * @access  Private (HR:READ)
 */
router.get('/', authenticate, checkPermission('HR', 'READ'), getShifts);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get Shift by ID
 * @access  Private (HR:READ)
 */
router.get('/:id', authenticate, checkPermission('HR', 'READ'), getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update Shift by ID
 * @access  Private (HR:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('HR', 'UPDATE'), updateShift);

/**
 * @route   PATCH /api/shifts/:id
 * @desc    Update Shift by ID (Partial)
 * @access  Private (HR:UPDATE)
 */
router.patch('/:id', authenticate, checkPermission('HR', 'UPDATE'), updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Soft delete Shift
 * @access  Private (HR:DELETE)
 */
const Shift = require('../models/shift.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('HR', 'DELETE'), deleteShift);

/**
 * @route   POST /api/shifts/bulk-delete
 * @desc    Bulk soft delete Shifts
 * @access  Private (HR:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('HR', 'DELETE'), createBulkDeleteHandler(Shift, { resourceName: 'Shifts' }));

module.exports = router;
