const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model');
const FinishedGood = require('../models/finishedGood.model');
const Customer = require('../models/customer.model');
const Tenant = require('../models/tenant.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');
const { calculateGstBreakdown } = require('../utils/gstHelper');

/**
 * Helper function to auto-generate unique Invoice number per tenant & year within transaction session
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
 * @desc    Direct Checkout (POS Counter Sale)
 * @route   POST /api/pos/checkout
 * @access  Private (SALES:CREATE permission)
 */
const directCheckout = async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (sessionErr) {
        console.error('Failed to start transaction session:', sessionErr);
        return res.status(503).json({
            success: false,
            message: 'Unable to start a database transaction. Please try again.'
        });
    }

    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Fetch Tenant inside transaction session to verify configured GST stateCode
        const tenantDoc = await Tenant.findById(tenantId).session(session);
        console.log(`[POS Checkout] Tenant check for ${tenantId}: GSTIN=${tenantDoc?.gstin}, StateCode=${tenantDoc?.stateCode}, StateName=${tenantDoc?.stateName}`);

        if (!tenantDoc || !tenantDoc.stateCode) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Seller state (GST) is not configured for this organization. Please set it up in Company Profile & GST Settings before processing sales.'
            });
        }

        const {
            customerType,
            customerRef,
            walkInDetails,
            cartItems,
            paymentMode
        } = req.body;

        // 1. Customer Payload Validation
        if (!customerType || (customerType !== 'WALK_IN' && customerType !== 'REGISTERED')) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Please specify customerType as 'WALK_IN' or 'REGISTERED'."
            });
        }

        if (customerType === 'REGISTERED') {
            if (!customerRef) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: "customerRef (Customer ID) is required when customerType is 'REGISTERED'."
                });
            }
            if (walkInDetails && Object.keys(walkInDetails).length > 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: "Do not provide walkInDetails when customerType is 'REGISTERED'."
                });
            }
        }

        if (customerType === 'WALK_IN' && customerRef) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Do not provide customerRef when customerType is 'WALK_IN'."
            });
        }

        // 2. Cart Payload Validation
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Cart cannot be empty. Please provide at least one item.'
            });
        }

        const fgIds = new Set();
        for (const item of cartItems) {
            const numQty = Number(item.quantity);
            if (!item.finishedGood || isNaN(numQty) || numQty <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Each cart item must have a valid finishedGood ObjectId and a positive quantity > 0.'
                });
            }
            const fgIdStr = String(item.finishedGood);
            if (fgIds.has(fgIdStr)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Duplicate finishedGood '${fgIdStr}' in cart payload.`
                });
            }
            fgIds.add(fgIdStr);
        }

        // 3. Read Registered Customer INSIDE session if applicable
        let customerDoc = null;
        if (customerType === 'REGISTERED') {
            customerDoc = await Customer.findOne({ _id: customerRef, tenant: tenantId }).session(session);
            if (!customerDoc) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Registered Customer does not exist or does not belong to your organization.'
                });
            }
        }

        // 4. Fetch FinishedGoods INSIDE session & validate live stock & selling price (pricePerBag)
        let totalTaxable = 0;
        const invoiceItems = [];

        for (const cartItem of cartItems) {
            const fgIdStr = String(cartItem.finishedGood);
            const numQty = Number(cartItem.quantity);

            const fgDoc = await FinishedGood.findOne({ _id: fgIdStr, tenant: tenantId }).session(session);

            if (!fgDoc) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Finished Good '${fgIdStr}' does not exist or does not belong to your organization.`
                });
            }

            if (fgDoc.currentStock < numQty) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient sellable stock for '${fgDoc.name}'. Current sellable stock: ${fgDoc.currentStock}, requested in cart: ${numQty}.`
                });
            }

            const ratePerUnit = Number(fgDoc.pricePerBag || 0);
            if (!ratePerUnit || ratePerUnit <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `'${fgDoc.name}' has no valid selling price configured (pricePerBag must be > 0). Cannot process sale.`
                });
            }

            const taxableValue = numQty * ratePerUnit;
            totalTaxable += taxableValue;

            invoiceItems.push({
                finishedGood: fgDoc._id,
                description: `${fgDoc.name} (${fgDoc.code})`,
                quantity: numQty,
                ratePerUnit,
                taxableValue
            });
        }

        // Calculate GST breakdown using real Tenant.stateCode
        const gstResult = calculateGstBreakdown({
            totalTaxable,
            gstRate: 18,
            sellerStateCode: tenantDoc.stateCode,
            customerGstin: customerDoc?.gstin,
            customerState: customerDoc?.state,
            isWalkIn: customerType === 'WALK_IN'
        });

        const grandTotal = totalTaxable + gstResult.gstAmount;

        const invoiceNumber = await generateInvoiceNumber(tenantId, session);

        // 5. Stock Deduction via executeStockTransactionCore INSIDE session
        const createdStockTransactions = [];
        for (const item of invoiceItems) {
            const txnResult = await executeStockTransactionCore({
                tenantId,
                referenceNumber: invoiceNumber,
                itemType: 'FINISHED_GOOD',
                item: item.finishedGood,
                transactionType: 'POS_SALE',
                quantity: item.quantity,
                notes: `POS Counter Sale (Invoice ${invoiceNumber})`,
                performedBy: req.user._id || req.user.id
            }, { session });

            createdStockTransactions.push(txnResult.transaction);
        }

        // 6. Create Invoice Document INSIDE session (Immediately settled: PAID)
        const invoiceDocs = await Invoice.create([{
            tenant: tenantId,
            invoiceNumber,
            salesOrder: null,
            customerType,
            customer: customerType === 'REGISTERED' ? customerRef : null,
            walkInCustomer: customerType === 'WALK_IN' ? {
                name: walkInDetails?.name || 'Counter Retail Customer',
                gstin: walkInDetails?.gstin || 'UNREGISTERED',
                phone: walkInDetails?.phone || ''
            } : undefined,
            invoiceDate: new Date(),
            items: invoiceItems,
            gstRate: gstResult.gstRate,
            gstAmount: gstResult.gstAmount,
            cgstAmount: gstResult.cgstAmount,
            sgstAmount: gstResult.sgstAmount,
            igstAmount: gstResult.igstAmount,
            grandTotal,
            paidAmount: grandTotal,
            dueAmount: 0,
            paymentStatus: 'PAID',
            paymentMode: paymentMode || 'CASH',
            isActive: true
        }], { session });

        const invoice = invoiceDocs[0];

        await session.commitTransaction();
        session.endSession();

        await invoice.populate([
            { path: 'customer', select: 'companyName code contactPerson phone gstin' },
            { path: 'items.finishedGood', select: 'name code uom currentStock' }
        ]);

        return res.status(201).json({
            success: true,
            message: `POS direct checkout sale completed successfully. Invoice '${invoiceNumber}' generated.`,
            data: {
                invoice,
                stockTransactions: createdStockTransactions
            }
        });
    } catch (error) {
        if (session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in POS directCheckout:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to complete POS direct checkout.'
        });
    }
};

module.exports = {
    directCheckout
};
