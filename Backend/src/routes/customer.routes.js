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
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

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

module.exports = router;
