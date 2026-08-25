const express = require('express');
const router = express.Router();
const {
    createShift,
    getShifts,
    getShiftById,
    updateShift,
    deleteShift
} = require('../controllers/shift.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/shifts
 * @desc    Create a new Shift
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createShift);

/**
 * @route   GET /api/shifts
 * @desc    Get all Shifts for current tenant
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getShifts);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get Shift by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update Shift by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Soft delete Shift
 * @access  Private (MASTER_DATA:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteShift);

module.exports = router;
