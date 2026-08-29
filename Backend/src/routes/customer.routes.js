const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    exportCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customer.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

/**
 * @route   POST /api/customers
 * @desc    Create a new Customer
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createCustomer);

/**
 * @route   GET /api/customers
 * @desc    Get all Customers for current tenant
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getCustomers);

/**
 * @route   GET /api/customers/export
 * @desc    Export Customers to CSV
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/export', authenticate, checkPermission('MASTER_DATA', 'READ'), exportCustomers);

/**
 * @route   GET /api/customers/:id
 * @desc    Get Customer by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getCustomerById);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update Customer by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateCustomer);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Soft delete Customer by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteCustomer);

const Customer = require('../models/customer.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

/**
 * @route   POST /api/customers/bulk-delete
 * @desc    Bulk soft delete Customers
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(Customer, { resourceName: 'Customers' }));

module.exports = router;
