const express = require('express');
const router = express.Router();
const {
    createMachine,
    getMachines,
    exportMachines,
    getMachineById,
    updateMachine,
    updateMachineStatus,
    deleteMachine
} = require('../controllers/machine.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/machines
 * @desc    Create a new Machine
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createMachine);

/**
 * @route   GET /api/machines
 * @desc    Get all Machines for current tenant
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getMachines);

/**
 * @route   GET /api/machines/export
 * @desc    Export Machines to CSV
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/export', authenticate, checkPermission('MASTER_DATA', 'READ'), exportMachines);

/**
 * @route   GET /api/machines/:id
 * @desc    Get Machine by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getMachineById);

/**
 * @route   PATCH /api/machines/:id/status
 * @desc    Update Machine status
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.patch('/:id/status', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateMachineStatus);

/**
 * @route   PUT /api/machines/:id
 * @desc    Update Machine by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateMachine);

/**
 * @route   DELETE /api/machines/:id
 * @desc    Soft delete Machine by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteMachine);

module.exports = router;
