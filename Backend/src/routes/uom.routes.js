const express = require('express');
const router = express.Router();
const {
    createUOM,
    getUOMs,
    getUOMById,
    updateUOM,
    deleteUOM
} = require('../controllers/uom.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/uom
 * @desc    Create a new UOM
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createUOM);

/**
 * @route   GET /api/uom
 * @desc    Get all UOMs for current tenant
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getUOMs);

/**
 * @route   GET /api/uom/:id
 * @desc    Get UOM by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getUOMById);

/**
 * @route   PUT /api/uom/:id
 * @desc    Update UOM by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateUOM);

/**
 * @route   DELETE /api/uom/:id
 * @desc    Soft delete UOM by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteUOM);

module.exports = router;
