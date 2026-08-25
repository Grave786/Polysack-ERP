const express = require('express');
const router = express.Router();
const {
    createInvoiceFromSalesOrder,
    getInvoices,
    getInvoiceById,
    recordPayment
} = require('../controllers/invoice.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/invoices/from-sales-order/:salesOrderId
 * @desc    Create Invoice from a confirmed Sales Order
 * @access  Private (SALES:CREATE)
 */
router.post('/from-sales-order/:salesOrderId', authenticate, checkPermission('SALES', 'CREATE'), createInvoiceFromSalesOrder);

/**
 * @route   GET /api/invoices
 * @desc    Get all Invoices for current tenant
 * @access  Private (SALES:READ)
 */
router.get('/', authenticate, checkPermission('SALES', 'READ'), getInvoices);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get Invoice by ID
 * @access  Private (SALES:READ)
 */
router.get('/:id', authenticate, checkPermission('SALES', 'READ'), getInvoiceById);

/**
 * @route   PATCH /api/invoices/:id/payment
 * @desc    Record payment against an Invoice
 * @access  Private (SALES:UPDATE)
 */
router.patch('/:id/payment', authenticate, checkPermission('SALES', 'UPDATE'), recordPayment);

// NOTE: No PUT or DELETE routes are exposed for Invoices because generated invoices are immutable financial records.

module.exports = router;
