const express = require('express');
const router = express.Router();
const {
    createInvoiceFromSalesOrder,
    getInvoices,
    getInvoiceById,
    recordPayment
} = require('../controllers/invoice.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('SALES'));

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

const Invoice = require('../models/invoice.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

/**
 * @route   PATCH /api/invoices/:id/payment
 * @desc    Record payment against an Invoice
 * @access  Private (SALES:UPDATE)
 */
router.patch('/:id/payment', authenticate, checkPermission('SALES', 'UPDATE'), recordPayment);

/**
 * @route   POST /api/invoices/bulk-delete
 * @desc    Rejects deletion of immutable tax invoices
 * @access  Private
 */
const rejectInvoiceModification = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Tax invoices are immutable financial records and cannot be modified or deleted.'
    });
};

router.put('/:id', authenticate, rejectInvoiceModification);
router.delete('/:id', authenticate, rejectInvoiceModification);

module.exports = router;
