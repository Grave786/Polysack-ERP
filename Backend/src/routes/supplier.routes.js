const express = require('express');
const router = express.Router();
const {
    createSupplier,
    getSuppliers,
    exportSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
} = require('../controllers/supplier.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

/**
 * @route   POST /api/suppliers
 * @desc    Create a new Supplier / Vendor
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createSupplier);

/**
 * @route   GET /api/suppliers
 * @desc    Get all Suppliers for current tenant
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getSuppliers);

/**
 * @route   GET /api/suppliers/export
 * @desc    Export Suppliers to CSV
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/export', authenticate, checkPermission('MASTER_DATA', 'READ'), exportSuppliers);

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get Supplier by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getSupplierById);

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update Supplier by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateSupplier);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Soft delete Supplier by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
const Supplier = require('../models/supplier.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteSupplier);

/**
 * @route   POST /api/suppliers/bulk-delete
 * @desc    Bulk soft delete Suppliers
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(Supplier, { resourceName: 'Suppliers' }));

module.exports = router;
