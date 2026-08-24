const express = require('express');
const router = express.Router();
const {
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
} = require('../controllers/supplier.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

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
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteSupplier);

module.exports = router;
