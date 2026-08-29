const express = require('express');
const router = express.Router();
const {
    createRawMaterial,
    getRawMaterials,
    exportRawMaterials,
    getRawMaterialById,
    updateRawMaterial,
    deleteRawMaterial
} = require('../controllers/rawMaterial.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/raw-materials
 * @desc    Create a new Raw Material
 * @access  Private (INVENTORY:CREATE)
 */
router.post('/', authenticate, checkPermission('INVENTORY', 'CREATE'), createRawMaterial);

/**
 * @route   GET /api/raw-materials
 * @desc    Get all Raw Materials for current tenant
 * @access  Private (INVENTORY:READ)
 */
router.get('/', authenticate, checkPermission('INVENTORY', 'READ'), getRawMaterials);

/**
 * @route   GET /api/raw-materials/export
 * @desc    Export Raw Materials to CSV
 * @access  Private (INVENTORY:READ)
 */
router.get('/export', authenticate, checkPermission('INVENTORY', 'READ'), exportRawMaterials);

/**
 * @route   GET /api/raw-materials/:id
 * @desc    Get Raw Material by ID
 * @access  Private (INVENTORY:READ)
 */
router.get('/:id', authenticate, checkPermission('INVENTORY', 'READ'), getRawMaterialById);

/**
 * @route   PUT /api/raw-materials/:id
 * @desc    Update Raw Material by ID
 * @access  Private (INVENTORY:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('INVENTORY', 'UPDATE'), updateRawMaterial);

/**
 * @route   DELETE /api/raw-materials/:id
 * @desc    Soft delete Raw Material by ID
 * @access  Private (INVENTORY:DELETE)
 */
const RawMaterial = require('../models/rawMaterial.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('INVENTORY', 'DELETE'), deleteRawMaterial);

/**
 * @route   POST /api/raw-materials/bulk-delete
 * @desc    Bulk soft delete Raw Materials
 * @access  Private (INVENTORY:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('INVENTORY', 'DELETE'), createBulkDeleteHandler(RawMaterial, { resourceName: 'Raw Materials' }));

module.exports = router;
