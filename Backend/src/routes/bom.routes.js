const express = require('express');
const router = express.Router();
const {
    createBOM,
    getBOMs,
    getBOMById,
    updateBOM,
    deleteBOM
} = require('../controllers/bom.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/boms
 * @desc    Create a new Bill of Materials
 * @access  Private (PRODUCTION:CREATE)
 */
router.post('/', authenticate, checkPermission('PRODUCTION', 'CREATE'), createBOM);

/**
 * @route   GET /api/boms
 * @desc    Get all BOMs for current tenant
 * @access  Private (PRODUCTION:READ)
 */
router.get('/', authenticate, checkPermission('PRODUCTION', 'READ'), getBOMs);

/**
 * @route   GET /api/boms/:id
 * @desc    Get BOM by ID
 * @access  Private (PRODUCTION:READ)
 */
router.get('/:id', authenticate, checkPermission('PRODUCTION', 'READ'), getBOMById);

/**
 * @route   PUT /api/boms/:id
 * @desc    Update BOM by ID
 * @access  Private (PRODUCTION:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('PRODUCTION', 'UPDATE'), updateBOM);

/**
 * @route   DELETE /api/boms/:id
 * @desc    Soft delete BOM by ID
 * @access  Private (PRODUCTION:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('PRODUCTION', 'DELETE'), deleteBOM);

module.exports = router;
