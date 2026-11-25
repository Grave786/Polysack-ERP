const Invoice = require('../models/invoice.model');
const SalesOrder = require('../models/salesOrder.model');
const Tenant = require('../models/tenant.model');
const Customer = require('../models/customer.model');
const { calculateGstBreakdown } = require('../utils/gstHelper');

/**
 * Safely parses any date representation (Date obj, timestamp, ISO string, DD/MM/YYYY, DD-MM-YYYY)
 */
const parseDateValue = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
            const year = parseInt(ddmmyyyyMatch[3], 10);
            const d = new Date(year, month, day, 23, 59, 59, 999);
            if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
};

/**
 * Checks if a given date is strictly in the past (before today / now).
 */
const isDateOverdue = (dateVal, now = new Date()) => {
    const d = parseDateValue(dateVal);
    if (!d) return false;
    return d.getTime() < now.getTime();
};

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
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom pricePerBag',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            })
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
            const fgDoc = item.finishedGood || {};
            const qty = Number(item.quantity);
            const rate = Number(item.ratePerUnit);
            const taxableValue = qty * rate;
            totalTaxable += taxableValue;

            const fgUom = (fgDoc.uom && typeof fgDoc.uom === 'object' && (fgDoc.uom.symbol || fgDoc.uom.name || fgDoc.uom.abbreviation))
                ? (fgDoc.uom.symbol || fgDoc.uom.name || fgDoc.uom.abbreviation)
                : (typeof fgDoc.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(fgDoc.uom) ? fgDoc.uom : null);

            return {
                finishedGood: fgDoc._id || item.finishedGood,
                description: fgDoc.name ? `${fgDoc.name} (${fgDoc.code})` : 'Finished Good Item',
                quantity: qty,
                unit: item.unit || fgUom || 'Pcs',
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
            balanceAmount: grandTotal,
            dueDate: req.body.dueDate || salesOrder.deliveryDue || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentStatus: 'UNPAID',
            payments: [],
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

        const resolvedPaymentStatus = paymentStatus || req.query.status;
        if (resolvedPaymentStatus && resolvedPaymentStatus !== 'All' && resolvedPaymentStatus !== 'All Statuses') {
            if (resolvedPaymentStatus === 'OUTSTANDING' || resolvedPaymentStatus === 'UNPAID') {
                filter.paymentStatus = { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] };
            } else {
                filter.paymentStatus = resolvedPaymentStatus;
            }
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
                .populate('salesOrder', 'soNumber status deliveryDue')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Invoice.countDocuments(filter)
        ]);

        const now = new Date();
        const enrichedInvoices = invoices.map((inv) => {
            const invObj = inv.toObject ? inv.toObject() : { ...inv };
            const grandTotal = Number(invObj.grandTotal !== undefined ? invObj.grandTotal : (invObj.totalAmount || 0));
            const paid = Number(invObj.paidAmount || 0);
            const balance = Math.max(0, grandTotal - paid);

            invObj.paidAmount = paid;
            invObj.balanceAmount = balance;
            invObj.dueAmount = balance;
            invObj.dueDate = invObj.dueDate || invObj.salesOrder?.deliveryDue || invObj.invoiceDate || invObj.createdAt;

            const isOverdue = isDateOverdue(invObj.dueDate, now);

            if (balance <= 0.0001 && (paid > 0 || grandTotal > 0)) {
                invObj.paymentStatus = 'PAID';
            } else if (isOverdue || invObj.paymentStatus === 'OVERDUE') {
                invObj.paymentStatus = 'OVERDUE';
            } else if (paid > 0) {
                invObj.paymentStatus = 'PARTIALLY_PAID';
            } else {
                invObj.paymentStatus = 'UNPAID';
            }

            return invObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedInvoices.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: enrichedInvoices
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
            .populate({
                path: 'salesOrder',
                select: 'soNumber status orderDate deliveryDue items',
                populate: {
                    path: 'items.finishedGood',
                    select: 'name code uom',
                    populate: { path: 'uom', select: 'name symbol abbreviation' }
                }
            })
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom pricePerBag',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found.'
            });
        }

        const invObj = invoice.toObject ? invoice.toObject() : invoice;
        if (Array.isArray(invObj.items)) {
            invObj.items = invObj.items.map((it) => {
                const fg = it.finishedGood || {};
                const fgUom = (fg.uom && typeof fg.uom === 'object' && (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation))
                    ? (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation)
                    : (typeof fg.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(fg.uom) ? fg.uom : null);

                let matchedSoItem = null;
                if (invObj.salesOrder && Array.isArray(invObj.salesOrder.items)) {
                    matchedSoItem = invObj.salesOrder.items.find((soIt) =>
                        String(soIt.finishedGood?._id || soIt.finishedGood) === String(fg._id || it.finishedGood)
                    );
                }
                const unit = it.unit || matchedSoItem?.unit || fgUom || 'Pcs';
                return { ...it, unit };
            });
        }

        return res.status(200).json({
            success: true,
            data: invObj
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

        const rawAmt = req.body.amount !== undefined ? req.body.amount : (req.body.paymentAmount !== undefined ? req.body.paymentAmount : req.body.paidAmount);
        const numAmount = Number(rawAmt);

        if (rawAmt === undefined || rawAmt === null || isNaN(numAmount) || numAmount <= 0) {
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

        const grandTotal = Number(invoice.grandTotal !== undefined ? invoice.grandTotal : (invoice.totalAmount || 0));
        const currentPaid = Number(invoice.paidAmount || 0);
        const currentBalance = Math.max(0, grandTotal - currentPaid);

        if (currentBalance <= 0 || invoice.paymentStatus === 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Invoice is already fully paid.'
            });
        }

        if (numAmount > currentBalance + 0.001) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (₹${numAmount}) exceeds remaining balance (₹${currentBalance.toFixed(2)}).`
            });
        }

        const newPaidAmount = currentPaid + numAmount;
        invoice.paidAmount = newPaidAmount;
        invoice.balanceAmount = Math.max(0, grandTotal - invoice.paidAmount);
        invoice.dueAmount = invoice.balanceAmount;

        const dueD = invoice.dueDate || invoice.invoiceDate || invoice.createdAt;
        const now = new Date();
        if (invoice.balanceAmount <= 0.0001) {
            invoice.paymentStatus = 'PAID';
        } else if (isDateOverdue(dueD, now) || invoice.paymentStatus === 'OVERDUE') {
            invoice.paymentStatus = 'OVERDUE';
        } else if (invoice.paidAmount > 0) {
            invoice.paymentStatus = 'PARTIALLY_PAID';
        } else {
            invoice.paymentStatus = 'UNPAID';
        }

        if (!Array.isArray(invoice.payments)) invoice.payments = [];
        invoice.payments.push({
            amount: numAmount,
            paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
            paymentMode: req.body.paymentMode || 'UPI',
            reference: req.body.reference || '',
            notes: req.body.notes || '',
            recordedBy: req.user?._id || req.user?.id || null,
            recordedAt: new Date()
        });

        await invoice.save();

        await invoice.populate([
            { path: 'customer', select: 'companyName code contactPerson phone' },
            { path: 'salesOrder', select: 'soNumber' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Payment of ₹${numAmount} recorded successfully. Remaining balance: ₹${invoice.balanceAmount.toFixed(2)}.`,
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

/**
 * @desc    Get Accounts Receivable Summary (Total receivable, overdue, customer count)
 * @route   GET /api/invoices/receivables-summary
 * @access  Private (SALES:READ permission)
 */
const getReceivablesSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const invoices = await Invoice.find({ tenant: tenantId, isActive: true })
            .select('grandTotal totalAmount paidAmount balanceAmount dueAmount dueDate invoiceDate createdAt paymentStatus customer')
            .lean();

        let totalReceivable = 0;
        let overdueAmount = 0;
        const customersWithDues = new Set();
        const now = new Date();

        invoices.forEach((inv) => {
            const grandTotal = Number(inv.grandTotal !== undefined ? inv.grandTotal : (inv.totalAmount || 0));
            const paid = Number(inv.paidAmount || 0);
            const balance = Math.max(0, grandTotal - paid);

            if (balance > 0.0001) {
                totalReceivable += balance;
                if (inv.customer) {
                    customersWithDues.add(String(inv.customer));
                }
                const dueD = inv.dueDate || inv.invoiceDate || inv.createdAt;
                if (inv.paymentStatus === 'OVERDUE' || isDateOverdue(dueD, now)) {
                    overdueAmount += balance;
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                totalReceivable: Math.round(totalReceivable * 100) / 100,
                overduePayable: Math.round(overdueAmount * 100) / 100,
                overdueReceivable: Math.round(overdueAmount * 100) / 100,
                overdueAmount: Math.round(overdueAmount * 100) / 100,
                customersWithDues: customersWithDues.size
            }
        });
    } catch (error) {
        console.error('Error in getReceivablesSummary:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch receivables summary.', error: error.message });
    }
};

/**
 * @desc    Get Customer-Wise Outstanding Accounts Receivable
 * @route   GET /api/invoices/customer-outstanding
 * @access  Private (SALES:READ permission)
 */
const getCustomerOutstanding = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const invoices = await Invoice.find({ tenant: tenantId, isActive: true })
            .populate('customer', 'companyName code contactPerson phone email')
            .sort({ createdAt: -1 })
            .lean();

        const customerMap = {};
        const now = new Date();

        invoices.forEach((inv) => {
            const custId = inv.customer ? String(inv.customer._id || inv.customer) : (inv.walkInCustomer?.name || 'Walk-In');
            const custName = inv.customer?.companyName || inv.walkInCustomer?.name || 'Walk-in Customer';
            const custCode = inv.customer?.code || '-';
            const phone = inv.customer?.phone || inv.walkInCustomer?.phone || '-';

            if (!customerMap[custId]) {
                customerMap[custId] = {
                    customerId: inv.customer?._id || custId,
                    customerName: custName,
                    customerCode: custCode,
                    phone: phone,
                    totalBilled: 0,
                    totalPaid: 0,
                    balance: 0,
                    overdueAmount: 0,
                    invoiceCount: 0,
                    unpaidInvoiceCount: 0
                };
            }

            const grandTotal = Number(inv.grandTotal !== undefined ? inv.grandTotal : (inv.totalAmount || 0));
            const paid = Number(inv.paidAmount || 0);
            const balance = Math.max(0, grandTotal - paid);

            customerMap[custId].totalBilled += grandTotal;
            customerMap[custId].totalPaid += paid;
            customerMap[custId].balance += balance;
            customerMap[custId].invoiceCount += 1;

            if (balance > 0.0001) {
                customerMap[custId].unpaidInvoiceCount += 1;
                const dueD = inv.dueDate || inv.invoiceDate || inv.createdAt;
                if (inv.paymentStatus === 'OVERDUE' || isDateOverdue(dueD, now)) {
                    customerMap[custId].overdueAmount += balance;
                }
            }
        });

        let list = Object.values(customerMap).map((c) => ({
            ...c,
            totalBilled: Math.round(c.totalBilled * 100) / 100,
            totalPaid: Math.round(c.totalPaid * 100) / 100,
            balance: Math.round(c.balance * 100) / 100,
            overdueAmount: Math.round(c.overdueAmount * 100) / 100
        })).sort((a, b) => b.balance - a.balance);

        const searchQ = (req.query.search || '').trim().toLowerCase();
        if (searchQ) {
            list = list.filter((item) =>
                (item.customerName && item.customerName.toLowerCase().includes(searchQ)) ||
                (item.customerCode && item.customerCode.toLowerCase().includes(searchQ)) ||
                (item.phone && item.phone.toLowerCase().includes(searchQ))
            );
        }

        const statusQ = (req.query.status || '').trim().toUpperCase();
        if (statusQ && statusQ !== 'ALL' && statusQ !== 'ALL STATUSES') {
            if (statusQ === 'OVERDUE') {
                list = list.filter((item) => (item.overdueAmount || 0) > 0);
            } else if (statusQ === 'OUTSTANDING' || statusQ === 'UNPAID') {
                list = list.filter((item) => (item.balance || 0) > 0.0001);
            } else if (statusQ === 'PAID') {
                list = list.filter((item) => (item.balance || 0) <= 0.0001);
            }
        }

        return res.status(200).json({
            success: true,
            count: list.length,
            pagination: {
                total: list.length,
                page: 1,
                limit: Math.max(list.length, 10),
                pages: 1
            },
            data: list
        });
    } catch (error) {
        console.error('Error in getCustomerOutstanding:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch customer outstanding.', error: error.message });
    }
};

module.exports = {
    createInvoiceFromSalesOrder,
    getInvoices,
    getInvoiceById,
    recordPayment,
    getReceivablesSummary,
    getCustomerOutstanding
};
