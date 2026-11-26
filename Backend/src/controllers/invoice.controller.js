const Invoice = require('../models/invoice.model');
const SalesOrder = require('../models/salesOrder.model');
const Tenant = require('../models/tenant.model');
const Customer = require('../models/customer.model');
const PartyAdvance = require('../models/partyAdvance.model');
const { calculateGstBreakdown, computeDocumentTotals } = require('../utils/gstHelper');
const { computeOverdueInfo } = require('../utils/overdueHelper');

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

        if (salesOrder.soApprovalStatus === 'Pending Approval' || salesOrder.soApprovalStatus === 'Rejected') {
            return res.status(400).json({
                success: false,
                message: `Cannot generate an invoice while Sales Order approval status is '${salesOrder.soApprovalStatus}'.`
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

        const isExempt = salesOrder.gstTreatment === 'EXEMPT';
        const effectiveGstRate = isExempt
            ? 0
            : ((gstRate !== undefined && !isNaN(Number(gstRate))) ? Number(gstRate) : (salesOrder.gstRate ?? 18));

        if (effectiveGstRate < 0 || effectiveGstRate > 100) {
            return res.status(400).json({
                success: false,
                message: 'GST rate must be between 0% and 100%.'
            });
        }

        const totalsCalc = computeDocumentTotals({
            itemsSubtotal: totalTaxable,
            discountType: salesOrder.discountType || 'FIXED',
            discountValue: salesOrder.discountValue || 0,
            freightAmount: salesOrder.freightAmount || 0,
            insuranceAmount: salesOrder.insuranceAmount || 0,
            otherChargesAmount: salesOrder.otherChargesAmount || 0,
            otherChargesLabel: salesOrder.otherChargesLabel || '',
            gstTreatment: isExempt ? 'EXEMPT' : 'TAXABLE',
            gstRate: effectiveGstRate,
            autoRoundOff: salesOrder.autoRoundOff !== false
        });
        if (totalsCalc.error) {
            return res.status(400).json({
                success: false,
                message: totalsCalc.error
            });
        }

        const customerDoc = salesOrder.customer;
        const gstResult = isExempt
            ? { gstRate: 0, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 }
            : calculateGstBreakdown({
                totalTaxable: totalsCalc.taxableValue,
                gstRate: totalsCalc.gstRate,
                sellerStateCode: tenantDoc.stateCode,
                customerGstin: customerDoc?.gstin,
                customerState: customerDoc?.state,
                isWalkIn: false
            });

        const grandTotal = totalsCalc.grandTotal;
        const invoiceNumber = await generateInvoiceNumber(tenantId);

        // 3. Create Invoice Document
        const invoice = new Invoice({
            tenant: tenantId,
            invoiceNumber,
            salesOrder: salesOrder._id,
            customer: salesOrder.customer._id || salesOrder.customer,
            invoiceDate: new Date(),
            items: invoiceItems,
            itemsSubtotal: totalsCalc.itemsSubtotal,
            discountType: totalsCalc.discountType,
            discountValue: totalsCalc.discountValue,
            discountAmount: totalsCalc.discountAmount,
            freightAmount: totalsCalc.freightAmount,
            insuranceAmount: totalsCalc.insuranceAmount,
            otherChargesAmount: totalsCalc.otherChargesAmount,
            otherChargesLabel: totalsCalc.otherChargesLabel,
            taxableValue: totalsCalc.taxableValue,
            gstTreatment: isExempt ? 'EXEMPT' : 'TAXABLE',
            exemptionReason: isExempt ? (salesOrder.exemptionReason || '') : '',
            gstRate: gstResult.gstRate,
            gstAmount: totalsCalc.taxAmount,
            taxAmount: totalsCalc.taxAmount,
            cgstAmount: gstResult.cgstAmount,
            sgstAmount: gstResult.sgstAmount,
            igstAmount: gstResult.igstAmount,
            autoRoundOff: totalsCalc.autoRoundOff,
            roundOff: totalsCalc.roundOff,
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
                .populate('customer', 'companyName code contactPerson phone paymentTerms advanceBalance')
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
            const paid = Math.min(grandTotal, Number(invObj.paidAmount || 0));
            const overdue = computeOverdueInfo({
                totalAmount: grandTotal,
                paidAmount: paid,
                docDate: invObj.invoiceDate || invObj.createdAt,
                docDueDate: invObj.dueDate || null,
                paymentTerms: invObj.customer?.paymentTerms,
                now
            });

            invObj.paidAmount = paid;
            invObj.balanceAmount = overdue.balance;
            invObj.dueAmount = overdue.balance;
            invObj.effectiveDueDate = overdue.effectiveDueDate;
            invObj.dueDate = overdue.effectiveDueDate;
            invObj.isOverdue = overdue.isOverdue;
            invObj.daysOverdue = overdue.daysOverdue;
            invObj.paymentStatus = overdue.paymentStatus;

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
        const numAmount = Number(rawAmt || 0);
        const applyAdvanceReq = Math.max(0, Number(req.body.applyAdvanceAmount || 0));

        if ((isNaN(numAmount) || numAmount <= 0) && applyAdvanceReq <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid payment amount or advance amount greater than 0.'
            });
        }

        const invoice = await Invoice.findOne({ _id: req.params.id, tenant: tenantId }).populate('customer', 'companyName paymentTerms advanceBalance');
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found.'
            });
        }

        const grandTotal = Number(invoice.grandTotal !== undefined ? invoice.grandTotal : (invoice.totalAmount || 0));
        const currentPaid = Number(invoice.paidAmount || 0);
        let remainingBalance = Math.max(0, Math.round((grandTotal - currentPaid) * 100) / 100);

        if (remainingBalance <= 0.0001 && applyAdvanceReq > 0) {
            return res.status(400).json({
                success: false,
                message: 'Invoice is already fully paid.'
            });
        }

        const payDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
        const payRef = String(req.body.reference || '').trim();
        const payNotes = String(req.body.notes || '').trim();
        if (!Array.isArray(invoice.payments)) invoice.payments = [];

        let appliedFromAdvance = 0;
        let customerDoc = invoice.customer?._id ? await Customer.findOne({ _id: invoice.customer._id, tenant: tenantId }) : null;

        if (applyAdvanceReq > 0) {
            if (!customerDoc) {
                return res.status(400).json({ success: false, message: 'Advance adjustment is only supported for registered customers.' });
            }
            const availableAdv = Number(customerDoc.advanceBalance || 0);
            if (applyAdvanceReq > availableAdv + 0.001) {
                return res.status(400).json({ success: false, message: `Requested advance (₹${applyAdvanceReq}) exceeds available customer advance (₹${availableAdv.toFixed(2)}).` });
            }
            appliedFromAdvance = Math.min(applyAdvanceReq, remainingBalance);
            if (appliedFromAdvance > 0) {
                customerDoc.advanceBalance = Math.max(0, Math.round((availableAdv - appliedFromAdvance) * 100) / 100);
                remainingBalance = Math.max(0, Math.round((remainingBalance - appliedFromAdvance) * 100) / 100);
                const adjPaymentId = `ADV-ADJ-${Date.now()}`;
                invoice.payments.push({
                    amount: appliedFromAdvance,
                    paymentDate: payDate,
                    paymentMode: 'ADVANCE_ADJUSTMENT',
                    reference: payRef || adjPaymentId,
                    notes: payNotes || 'Adjusted from Customer Advance',
                    recordedBy: req.user?._id || req.user?.id || null,
                    recordedAt: new Date()
                });
                await PartyAdvance.create({
                    tenant: tenantId,
                    partyType: 'CUSTOMER',
                    partyId: customerDoc._id,
                    entryType: 'ADJUSTMENT',
                    amount: appliedFromAdvance,
                    date: payDate,
                    paymentMode: 'ADVANCE_ADJUSTMENT',
                    reference: payRef || adjPaymentId,
                    notes: payNotes || `Applied to Invoice ${invoice.invoiceNumber}`,
                    paymentId: adjPaymentId,
                    documentModel: 'Invoice',
                    documentId: invoice._id,
                    documentNumber: invoice.invoiceNumber,
                    recordedBy: req.user?._id || req.user?.id || null
                });
            }
        }

        let appliedCashToDoc = 0;
        let excessToAdvance = 0;
        if (numAmount > 0) {
            appliedCashToDoc = Math.min(numAmount, remainingBalance);
            excessToAdvance = Math.max(0, Math.round((numAmount - appliedCashToDoc) * 100) / 100);

            if (excessToAdvance > 0 && !customerDoc) {
                return res.status(400).json({
                    success: false,
                    message: `Payment amount (₹${numAmount}) exceeds remaining balance (₹${remainingBalance.toFixed(2)}). Overpayment as advance requires a registered customer.`
                });
            }

            if (appliedCashToDoc > 0) {
                invoice.payments.push({
                    amount: appliedCashToDoc,
                    paymentDate: payDate,
                    paymentMode: req.body.paymentMode || 'UPI',
                    reference: payRef,
                    notes: payNotes,
                    recordedBy: req.user?._id || req.user?.id || null,
                    recordedAt: new Date()
                });
            }

            if (excessToAdvance > 0 && customerDoc) {
                customerDoc.advanceBalance = Math.round((Number(customerDoc.advanceBalance || 0) + excessToAdvance) * 100) / 100;
                const advPayId = `ADV-CR-${Date.now()}`;
                await PartyAdvance.create({
                    tenant: tenantId,
                    partyType: 'CUSTOMER',
                    partyId: customerDoc._id,
                    entryType: 'CREDIT',
                    amount: excessToAdvance,
                    date: payDate,
                    paymentMode: req.body.paymentMode || 'UPI',
                    reference: payRef || advPayId,
                    notes: payNotes || `Excess payment from Invoice ${invoice.invoiceNumber}`,
                    paymentId: advPayId,
                    documentModel: 'Invoice',
                    documentId: invoice._id,
                    documentNumber: invoice.invoiceNumber,
                    recordedBy: req.user?._id || req.user?.id || null
                });
            }
        }

        if (customerDoc) {
            await customerDoc.save();
        }

        const totalApplied = Math.round((appliedFromAdvance + appliedCashToDoc) * 100) / 100;
        invoice.paidAmount = Math.min(grandTotal, Math.round((currentPaid + totalApplied) * 100) / 100);
        const overdue = computeOverdueInfo({
            totalAmount: grandTotal,
            paidAmount: invoice.paidAmount,
            docDate: invoice.invoiceDate || invoice.createdAt,
            docDueDate: invoice.dueDate || null,
            paymentTerms: customerDoc?.paymentTerms || invoice.customer?.paymentTerms
        });
        invoice.balanceAmount = overdue.balance;
        invoice.dueAmount = overdue.balance;
        invoice.paymentStatus = overdue.paymentStatus;

        await invoice.save();

        await invoice.populate([
            { path: 'customer', select: 'companyName code contactPerson phone paymentTerms advanceBalance' },
            { path: 'salesOrder', select: 'soNumber' }
        ]);

        return res.status(200).json({
            success: true,
            message: excessToAdvance > 0
                ? `Applied ₹${appliedCashToDoc.toLocaleString('en-IN')} to ${invoice.invoiceNumber} and saved ₹${excessToAdvance.toLocaleString('en-IN')} as Customer Advance.`
                : `Payment recorded successfully. Remaining balance: ₹${invoice.balanceAmount.toFixed(2)}.`,
            appliedAmount: totalApplied,
            appliedFromAdvance,
            excessToAdvance,
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

        const [invoices, customersWithAdv] = await Promise.all([
            Invoice.find({ tenant: tenantId, isActive: true })
                .populate('customer', 'paymentTerms advanceBalance')
                .select('grandTotal totalAmount paidAmount balanceAmount dueAmount dueDate invoiceDate createdAt paymentStatus customer')
                .lean(),
            Customer.find({ tenant: tenantId, isActive: true, advanceBalance: { $gt: 0 } })
                .select('advanceBalance')
                .lean()
        ]);

        let totalReceivable = 0;
        let overdueAmount = 0;
        const customersWithDues = new Set();
        const now = new Date();

        invoices.forEach((inv) => {
            const grandTotal = Number(inv.grandTotal !== undefined ? inv.grandTotal : (inv.totalAmount || 0));
            const paid = Math.min(grandTotal, Number(inv.paidAmount || 0));
            const overdue = computeOverdueInfo({
                totalAmount: grandTotal,
                paidAmount: paid,
                docDate: inv.invoiceDate || inv.createdAt,
                docDueDate: inv.dueDate || null,
                paymentTerms: inv.customer?.paymentTerms,
                now
            });

            if (overdue.balance > 0.0001) {
                totalReceivable += overdue.balance;
                if (inv.customer) {
                    customersWithDues.add(String(inv.customer._id || inv.customer));
                }
                if (overdue.isOverdue) {
                    overdueAmount += overdue.balance;
                }
            }
        });

        const totalAdvance = customersWithAdv.reduce((s, c) => s + Number(c.advanceBalance || 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                totalReceivable: Math.round(totalReceivable * 100) / 100,
                overduePayable: Math.round(overdueAmount * 100) / 100,
                overdueReceivable: Math.round(overdueAmount * 100) / 100,
                overdueAmount: Math.round(overdueAmount * 100) / 100,
                totalAdvance: Math.round(totalAdvance * 100) / 100,
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

        const [invoices, advanceCustomers] = await Promise.all([
            Invoice.find({ tenant: tenantId, isActive: true })
                .populate('customer', 'companyName code contactPerson phone email paymentTerms advanceBalance')
                .sort({ createdAt: -1 })
                .lean(),
            Customer.find({ tenant: tenantId, isActive: true, advanceBalance: { $gt: 0 } })
                .select('companyName code contactPerson phone email paymentTerms advanceBalance')
                .lean()
        ]);

        const customerMap = {};
        const now = new Date();

        const ensureCustEntry = (custId, custObj, fallbackName, fallbackPhone) => {
            if (!customerMap[custId]) {
                customerMap[custId] = {
                    customerId: custObj?._id || custId,
                    customerName: custObj?.companyName || fallbackName || 'Walk-in Customer',
                    customerCode: custObj?.code || '-',
                    phone: custObj?.phone || fallbackPhone || '-',
                    paymentTerms: custObj?.paymentTerms || '',
                    advanceBalance: Number(custObj?.advanceBalance || 0),
                    totalBilled: 0,
                    totalPaid: 0,
                    balance: 0,
                    overdueAmount: 0,
                    invoiceCount: 0,
                    unpaidInvoiceCount: 0
                };
            }
        };

        advanceCustomers.forEach((c) => {
            ensureCustEntry(String(c._id), c, c.companyName, c.phone);
        });

        invoices.forEach((inv) => {
            const custId = inv.customer ? String(inv.customer._id || inv.customer) : (inv.walkInCustomer?.name || 'Walk-In');
            ensureCustEntry(custId, inv.customer, inv.walkInCustomer?.name, inv.walkInCustomer?.phone);

            const grandTotal = Number(inv.grandTotal !== undefined ? inv.grandTotal : (inv.totalAmount || 0));
            const paid = Math.min(grandTotal, Number(inv.paidAmount || 0));
            const overdue = computeOverdueInfo({
                totalAmount: grandTotal,
                paidAmount: paid,
                docDate: inv.invoiceDate || inv.createdAt,
                docDueDate: inv.dueDate || null,
                paymentTerms: inv.customer?.paymentTerms,
                now
            });

            customerMap[custId].totalBilled += grandTotal;
            customerMap[custId].totalPaid += paid;
            customerMap[custId].balance += overdue.balance;
            customerMap[custId].invoiceCount += 1;

            if (overdue.balance > 0.0001) {
                customerMap[custId].unpaidInvoiceCount += 1;
                if (overdue.isOverdue) {
                    customerMap[custId].overdueAmount += overdue.balance;
                }
            }
        });

        let list = Object.values(customerMap).map((c) => ({
            ...c,
            advanceBalance: Math.round(c.advanceBalance * 100) / 100,
            totalBilled: Math.round(c.totalBilled * 100) / 100,
            totalPaid: Math.round(c.totalPaid * 100) / 100,
            balance: Math.round(c.balance * 100) / 100,
            overdueAmount: Math.round(c.overdueAmount * 100) / 100
        })).sort((a, b) => (b.balance - a.balance) || (b.advanceBalance - a.advanceBalance));

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

/**
 * @desc    Record an Advance Payment from a Customer (without a specific Invoice)
 * @route   POST /api/invoices/customer-advance
 * @access  Private (SALES:UPDATE permission)
 */
const recordCustomerAdvance = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ success: false, message: 'Tenant context is missing.' });

        const { customerId, amount, paymentDate, paymentMode, reference, notes } = req.body;
        const numAmt = Number(amount || 0);
        if (!customerId || isNaN(numAmt) || numAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide customerId and a positive amount.' });
        }

        const customer = await Customer.findOne({ _id: customerId, tenant: tenantId });
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        customer.advanceBalance = Math.round((Number(customer.advanceBalance || 0) + numAmt) * 100) / 100;
        await customer.save();

        const paymentId = `CUST-ADV-${Date.now()}`;
        const entry = await PartyAdvance.create({
            tenant: tenantId,
            partyType: 'CUSTOMER',
            partyId: customer._id,
            entryType: 'CREDIT',
            amount: numAmt,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            paymentMode: paymentMode || 'UPI',
            reference: String(reference || paymentId).trim(),
            notes: String(notes || 'Customer Advance Receipt').trim(),
            paymentId,
            documentModel: null,
            documentId: null,
            documentNumber: '',
            recordedBy: req.user?._id || req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: `Customer advance of ₹${numAmt.toLocaleString('en-IN')} recorded.`,
            data: { customer, entry }
        });
    } catch (error) {
        console.error('Error in recordCustomerAdvance:', error);
        return res.status(500).json({ success: false, message: 'Failed to record customer advance.', error: error.message });
    }
};

/**
 * @desc    Get Customer Advance & Payment Ledger
 * @route   GET /api/invoices/customer-ledger/:customerId
 * @access  Private (SALES:READ permission)
 */
const getCustomerLedger = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ success: false, message: 'Tenant context is missing.' });

        const { customerId } = req.params;
        const [customer, ledger, invoices] = await Promise.all([
            Customer.findOne({ _id: customerId, tenant: tenantId }).select('companyName code phone email paymentTerms advanceBalance').lean(),
            PartyAdvance.find({ tenant: tenantId, partyType: 'CUSTOMER', partyId: customerId }).sort({ date: -1, createdAt: -1 }).lean(),
            Invoice.find({ tenant: tenantId, customer: customerId, isActive: true }).select('invoiceNumber invoiceDate dueDate grandTotal paidAmount balanceAmount paymentStatus payments').sort({ invoiceDate: -1 }).lean()
        ]);

        if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

        return res.status(200).json({
            success: true,
            data: {
                customer,
                advanceBalance: Number(customer.advanceBalance || 0),
                ledger,
                invoices
            }
        });
    } catch (error) {
        console.error('Error in getCustomerLedger:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch customer ledger.', error: error.message });
    }
};

module.exports = {
    createInvoiceFromSalesOrder,
    getInvoices,
    getInvoiceById,
    recordPayment,
    recordCustomerAdvance,
    getCustomerLedger,
    getReceivablesSummary,
    getCustomerOutstanding
};
