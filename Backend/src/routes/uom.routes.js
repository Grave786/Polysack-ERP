const express = require('express');
const router = express.Router();
const {
    createUOM,
    getUOMs,
    getUOMById,
    updateUOM,
    deleteUOM
} = require('../controllers/uom.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

/**
 * @route   POST /api/uom
 * @desc    Create a new UOM
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createUOM);

/**
 * @route   GET /api/uom
 * @desc    Get all UOMs for current tenant
 * @access  Private (Authenticated users)
 */
router.get('/', authenticate, getUOMs);

/**
 * @route   GET /api/uom/:id
 * @desc    Get UOM by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', authenticate, getUOMById);

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
const UOM = require('../models/uom.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteUOM);

/**
 * @route   POST /api/uom/bulk-delete
 * @desc    Bulk soft delete UOMs
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(UOM, { resourceName: 'Units of Measurement' }));

module.exports = router;
