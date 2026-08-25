const Invoice = require('../models/invoice.model');
const SalesOrder = require('../models/salesOrder.model');
const Tenant = require('../models/tenant.model');
const Customer = require('../models/customer.model');
const { calculateGstBreakdown } = require('../utils/gstHelper');

/**
 * Helper function to auto-generate unique Invoice number per tenant & year within optional transaction session
 */
const generateInvoiceNumber = async (tenantId, session) => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const query = Invoice.findOne({
        tenant: tenantId,
        invoiceNumber: { $regex: `^${prefix}\\d{3,}$` }
    }).sort({ invoiceNumber: -1 });

    if (session) {
        query.session(session);
    }

    const lastInvoice = await query;

    let nextNumber = 101; // Default starting sequence
    if (lastInvoice && lastInvoice.invoiceNumber) {
        const parts = lastInvoice.invoiceNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(3, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Generate Invoice from a confirmed Sales Order
 * @route   POST /api/invoices/from-sales-order/:salesOrderId
 * @access  Private (SALES:CREATE permission)
 */
const createInvoiceFromSalesOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const tenantDoc = await Tenant.findById(tenantId);
        if (!tenantDoc || !tenantDoc.stateCode) {
            return res.status(400).json({
                success: false,
                message: 'Seller state (GST) is not configured for this organization. Please set it up in Company Profile & GST Settings before generating invoices.'
            });
        }

        const { salesOrderId } = req.params;
        const { gstRate } = req.body;

        // 1. Fetch SalesOrder within tenant scope
        const salesOrder = await SalesOrder.findOne({ _id: salesOrderId, tenant: tenantId })
            .populate('items.finishedGood', 'name code uom pricePerBag')
            .populate('customer', 'companyName code contactPerson phone gstin state');

        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found or does not belong to your organization.'
            });
        }

        if (salesOrder.status === 'DRAFT') {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate an invoice for a DRAFT Sales Order. Please confirm the Sales Order first.'
            });
        }

        if (salesOrder.status === 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate an invoice for a CANCELLED Sales Order.'
            });
        }

        // 2. Snapshot items from SalesOrder
        let totalTaxable = 0;
        const invoiceItems = salesOrder.items.map(item => {
            const fgDoc = item.finishedGood;
            const qty = Number(item.quantity);
            const rate = Number(item.ratePerUnit);
            const taxableValue = qty * rate;
            totalTaxable += taxableValue;

            return {
                finishedGood: fgDoc._id || item.finishedGood,
                description: fgDoc.name ? `${fgDoc.name} (${fgDoc.code})` : 'Finished Good Item',
                quantity: qty,
                ratePerUnit: rate,
                taxableValue
            };
        });

        const effectiveGstRate = (gstRate !== undefined && !isNaN(Number(gstRate))) ? Number(gstRate) : 18;
        if (effectiveGstRate < 0 || effectiveGstRate > 28) {
            return res.status(400).json({
                success: false,
                message: 'GST rate must be between 0% and 28%.'
            });
        }

        const customerDoc = salesOrder.customer;
        const gstResult = calculateGstBreakdown({
            totalTaxable,
            gstRate: effectiveGstRate,
            sellerStateCode: tenantDoc.stateCode,
            customerGstin: customerDoc?.gstin,
            customerState: customerDoc?.state,
            isWalkIn: false
        });

        const grandTotal = totalTaxable + gstResult.gstAmount;
        const invoiceNumber = await generateInvoiceNumber(tenantId);

        // 3. Create Invoice Document
        const invoice = new Invoice({
            tenant: tenantId,
            invoiceNumber,
            salesOrder: salesOrder._id,
            customer: salesOrder.customer._id || salesOrder.customer,
            invoiceDate: new Date(),
            items: invoiceItems,
            gstRate: gstResult.gstRate,
            gstAmount: gstResult.gstAmount,
            cgstAmount: gstResult.cgstAmount,
            sgstAmount: gstResult.sgstAmount,
            igstAmount: gstResult.igstAmount,
            grandTotal,
            paidAmount: 0,
            dueAmount: grandTotal,
            paymentStatus: 'UNPAID',
            isActive: true
        });

        await invoice.save();

        await invoice.populate([
            { path: 'customer', select: 'companyName code contactPerson phone email address gstin' },
            { path: 'salesOrder', select: 'soNumber status orderDate' },
            { path: 'items.finishedGood', select: 'name code uom' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Invoice '${invoiceNumber}' generated successfully for Sales Order ${salesOrder.soNumber}.`,
            data: invoice
        });
    } catch (error) {
        console.error('Error in createInvoiceFromSalesOrder:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to generate Invoice from Sales Order.'
        });
    }
};

/**
 * @desc    Get all Invoices scoped to user's tenant
 * @route   GET /api/invoices
 * @access  Private (SALES:READ permission)
 */
const getInvoices = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { paymentStatus, customer, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        if (customer) {
            filter.customer = customer;
        }

        if (search) {
            filter.invoiceNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .populate('customer', 'companyName code contactPerson phone')
                .populate('salesOrder', 'soNumber status')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Invoice.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: invoices.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: invoices
        });
    } catch (error) {
        console.error('Error in getInvoices:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Invoices.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Invoice by ID scoped to user's tenant
 * @route   GET /api/invoices/:id
 * @access  Private (SALES:READ permission)
 */
const getInvoiceById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const invoice = await Invoice.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName code contactPerson phone email address gstin')
            .populate('salesOrder', 'soNumber status orderDate deliveryDue')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom pricePerBag',
                populate: { path: 'uom', select: 'name symbol' }
            });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error('Error in getInvoiceById:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Invoice.',
            error: error.message
        });
    }
};

/**
 * @desc    Record payment against an Invoice
 * @route   PATCH /api/invoices/:id/payment
 * @access  Private (SALES:UPDATE permission)
 */
const recordPayment = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { amount } = req.body;
        const numAmount = Number(amount);

        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid payment amount greater than 0.'
            });
        }

        const invoice = await Invoice.findOne({ _id: req.params.id, tenant: tenantId });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found.'
            });
        }

        if (invoice.dueAmount <= 0 || invoice.paymentStatus === 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Invoice is already fully paid.'
            });
        }

        const newPaidAmount = invoice.paidAmount + numAmount;
        if (newPaidAmount > invoice.grandTotal + 0.001) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (${numAmount}) exceeds remaining due amount (${invoice.dueAmount.toFixed(2)}).`
            });
        }

        invoice.paidAmount = newPaidAmount;
        invoice.dueAmount = Math.max(0, invoice.grandTotal - invoice.paidAmount);

        if (invoice.dueAmount <= 0.0001) {
            invoice.paymentStatus = 'PAID';
        } else if (invoice.paidAmount > 0) {
            invoice.paymentStatus = 'PARTIALLY_PAID';
        } else {
            invoice.paymentStatus = 'UNPAID';
        }

        await invoice.save();

        await invoice.populate([
            { path: 'customer', select: 'companyName code' },
            { path: 'salesOrder', select: 'soNumber' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Payment of ${numAmount} recorded successfully. Remaining due: ${invoice.dueAmount.toFixed(2)}.`,
            data: invoice
        });
    } catch (error) {
        console.error('Error in recordPayment:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to record payment on Invoice.',
            error: error.message
        });
    }
};

module.exports = {
    createInvoiceFromSalesOrder,
    getInvoices,
    getInvoiceById,
    recordPayment
};
