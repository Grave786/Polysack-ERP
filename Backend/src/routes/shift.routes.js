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
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createShift);

/**
 * @route   POST /api/shifts/seed-default
 * @desc    Seed standard shifts (Shift A, Shift B, Night Shift)
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/seed-default', authenticate, checkPermission('MASTER_DATA', 'CREATE'), seedDefaultShifts);

/**
 * @route   GET /api/shifts
 * @desc    Get all Shifts for current tenant
 * @access  Private (Authenticated users)
 */
router.get('/', authenticate, getShifts);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get Shift by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', authenticate, getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update Shift by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateShift);

/**
 * @route   PATCH /api/shifts/:id
 * @desc    Update Shift by ID (Partial)
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.patch('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Soft delete Shift
 * @access  Private (MASTER_DATA:DELETE)
 */
const Shift = require('../models/shift.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteShift);

/**
 * @route   POST /api/shifts/bulk-delete
 * @desc    Bulk soft delete Shifts
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(Shift, { resourceName: 'Shifts' }));

module.exports = router;
