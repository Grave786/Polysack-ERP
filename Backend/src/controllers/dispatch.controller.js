const mongoose = require('mongoose');
const Dispatch = require('../models/dispatch.model');
const SalesOrder = require('../models/salesOrder.model');
const Location = require('../models/location.model');
const FinishedGood = require('../models/finishedGood.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');

/**
 * Helper function to auto-generate unique Dispatch number per tenant & year
 */
const generateDispatchNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `DISP-${year}-`;

    const lastDispatch = await Dispatch.findOne({
        tenant: tenantId,
        dispatchNumber: { $regex: `^${prefix}\\d{3,}$` }
    }).sort({ dispatchNumber: -1 });

    let nextNumber = 101; // Default starting sequence
    if (lastDispatch && lastDispatch.dispatchNumber) {
        const parts = lastDispatch.dispatchNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(3, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Get combined list of dispatchable Sales Orders & POS Invoices
 * @route   GET /api/dispatches/dispatchable-sources
 * @access  Private (SALES:READ permission)
 */
const getDispatchableSources = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const Invoice = require('../models/invoice.model');

        // 1. Fetch active Sales Orders in CONFIRMED, READY_FOR_DISPATCH, or PARTIALLY_DISPATCHED
        const salesOrders = await SalesOrder.find({
            tenant: tenantId,
            status: { $in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED'] }
        })
            .populate('customer', 'companyName code contactPerson phone city state address')
            .populate('items.finishedGood', 'name code uom currentStock')
            .sort({ createdAt: -1 });

        const dispatchableSOList = [];
        for (const so of salesOrders) {
            const items = (so.items || []).map((it) => {
                const fg = it.finishedGood || {};
                const orderedQty = Number(it.quantity || 0);
                const alreadyDispatched = Number(it.dispatchedQuantity || 0);
                const remainingQty = Math.max(0, orderedQty - alreadyDispatched);
                return {
                    finishedGood: fg._id || it.finishedGood,
                    name: fg.name || 'Finished Goods Bag',
                    code: fg.code || '',
                    uom: fg.uom?.name || 'BAGS',
                    orderedQuantity: orderedQty,
                    alreadyDispatched,
                    remainingQuantity: remainingQty
                };
            });

            const totalRemaining = items.reduce((acc, it) => acc + it.remainingQuantity, 0);
            const totalOrdered = items.reduce((acc, it) => acc + it.orderedQuantity, 0);

            if (totalRemaining > 0) {
                const custName = so.customer?.companyName || so.customer?.name || 'Customer';
                dispatchableSOList.push({
                    sourceType: 'SALES_ORDER',
                    id: so._id,
                    salesOrderId: so._id,
                    invoiceId: null,
                    referenceNumber: so.soNumber,
                    label: `${so.soNumber} — ${custName} (Sales Order, ${totalRemaining.toLocaleString()} Bags remaining)`,
                    customerName: custName,
                    customerId: so.customer?._id || null,
                    customerPhone: so.customer?.phone || '',
                    deliveryAddress: so.customer?.city ? `${so.customer.city}, ${so.customer.state || ''}` : '',
                    totalQuantity: totalOrdered,
                    remainingQuantity: totalRemaining,
                    items
                });
            }
        }

        // 2. Fetch POS Invoices (where salesOrder is null/undefined)
        const posInvoices = await Invoice.find({
            tenant: tenantId,
            salesOrder: null,
            isActive: true
        })
            .populate('customer', 'companyName code contactPerson phone city state address')
            .populate('items.finishedGood', 'name code uom currentStock')
            .sort({ createdAt: -1 });

        const posInvoiceIds = posInvoices.map((inv) => inv._id);
        const existingPosDispatches = await Dispatch.find({
            tenant: tenantId,
            invoice: { $in: posInvoiceIds }
        }).select('invoice items');

        // Map invoiceId -> { [fgId]: totalDispatched }
        const dispatchedByInvoiceMap = new Map();
        for (const disp of existingPosDispatches) {
            const invIdStr = String(disp.invoice);
            if (!dispatchedByInvoiceMap.has(invIdStr)) {
                dispatchedByInvoiceMap.set(invIdStr, {});
            }
            const itemMap = dispatchedByInvoiceMap.get(invIdStr);
            for (const it of disp.items || []) {
                const fgStr = String(it.finishedGood);
                itemMap[fgStr] = (itemMap[fgStr] || 0) + Number(it.dispatchedQuantity || 0);
            }
        }

        const dispatchablePOSList = [];
        for (const inv of posInvoices) {
            const invIdStr = String(inv._id);
            const itemDispatchedMap = dispatchedByInvoiceMap.get(invIdStr) || {};

            const items = (inv.items || []).map((it) => {
                const fg = it.finishedGood || {};
                const fgId = fg._id || it.finishedGood;
                const orderedQty = Number(it.quantity || 0);
                const alreadyDispatched = itemDispatchedMap[String(fgId)] || 0;
                const remainingQty = Math.max(0, orderedQty - alreadyDispatched);
                return {
                    finishedGood: fgId,
                    name: fg.name || it.description || 'Finished Goods Bag',
                    code: fg.code || '',
                    uom: fg.uom?.name || 'BAGS',
                    orderedQuantity: orderedQty,
                    alreadyDispatched,
                    remainingQuantity: remainingQty
                };
            });

            const totalRemaining = items.reduce((acc, it) => acc + it.remainingQuantity, 0);
            const totalOrdered = items.reduce((acc, it) => acc + it.orderedQuantity, 0);

            if (totalRemaining > 0) {
                const custName = inv.customer?.companyName || inv.walkInCustomer?.name || 'Counter Retail Customer';
                dispatchablePOSList.push({
                    sourceType: 'POS_INVOICE',
                    id: inv._id,
                    salesOrderId: null,
                    invoiceId: inv._id,
                    referenceNumber: inv.invoiceNumber,
                    label: `${inv.invoiceNumber} — ${custName} (POS Sale, ${totalRemaining.toLocaleString()} Bags remaining)`,
                    customerName: custName,
                    customerId: inv.customer?._id || null,
                    customerPhone: inv.customer?.phone || inv.walkInCustomer?.phone || '',
                    deliveryAddress: inv.customer?.city || 'Counter / Walk-in Delivery',
                    totalQuantity: totalOrdered,
                    remainingQuantity: totalRemaining,
                    items
                });
            }
        }

        const combined = [...dispatchableSOList, ...dispatchablePOSList];

        return res.status(200).json({
            success: true,
            count: combined.length,
            data: combined,
            meta: {
                salesOrdersCount: dispatchableSOList.length,
                posInvoicesCount: dispatchablePOSList.length
            }
        });
    } catch (error) {
        console.error('Error in getDispatchableSources:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dispatchable orders.',
            error: error.message
        });
    }
};

/**
 * @desc    Create a new Goods Dispatch Note (Fulfill SalesOrder or POS Invoice)
 * @route   POST /api/dispatches
 * @access  Private (SALES:CREATE permission)
 */
const createDispatch = async (req, res) => {
    let session = null;
    let useTransaction = true;

    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Strip read-only and system fields
        delete req.body.tenant;
        delete req.body.dispatchNumber;
        delete req.body.dispatchedBy;
        delete req.body.deliveryStatus;
        delete req.body.podConfirmedAt;

        const {
            salesOrder,
            invoice,
            sourceType = (invoice && !salesOrder ? 'POS_INVOICE' : 'SALES_ORDER'),
            dispatchDate,
            items,
            dispatchLocation,
            vehicleNumber,
            transporter,
            driverName,
            driverPhone,
            notes
        } = req.body;

        // 1. Validation
        if ((!salesOrder && !invoice) || !dispatchLocation || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide salesOrder or invoice reference, dispatchLocation, and at least one item.'
            });
        }

        // 2. Verify Dispatch Location exists and belongs to tenant
        const locationDoc = await Location.findOne({ _id: dispatchLocation, tenant: tenantId });
        if (!locationDoc) {
            return res.status(400).json({
                success: false,
                message: 'Dispatch location does not exist or does not belong to your organization.'
            });
        }

        const dispatchNumber = await generateDispatchNumber(tenantId);
        const Invoice = require('../models/invoice.model');

        // BRANCH A: POS Invoice Dispatch
        if (sourceType === 'POS_INVOICE' || (invoice && !salesOrder)) {
            const invId = invoice || req.body.invoiceId;
            const invoiceDoc = await Invoice.findOne({ _id: invId, tenant: tenantId });
            if (!invoiceDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'POS Invoice not found or does not belong to your organization.'
                });
            }

            // Calculate already dispatched quantities across prior dispatches for this POS Invoice
            const existingDispatches = await Dispatch.find({ tenant: tenantId, invoice: invoiceDoc._id });
            const itemDispatchedMap = {};
            for (const d of existingDispatches) {
                for (const it of d.items || []) {
                    const fgStr = String(it.finishedGood);
                    itemDispatchedMap[fgStr] = (itemDispatchedMap[fgStr] || 0) + Number(it.dispatchedQuantity || 0);
                }
            }

            const cleanedItems = [];
            for (const dispatchItem of items) {
                const numQty = Number(dispatchItem.dispatchedQuantity);
                if (!dispatchItem.finishedGood || isNaN(numQty) || numQty <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each dispatch item must have a valid finishedGood ObjectId and a positive dispatchedQuantity > 0.'
                    });
                }

                const fgIdStr = String(dispatchItem.finishedGood);
                const invItem = invoiceDoc.items.find((i) => String(i.finishedGood) === fgIdStr);

                if (!invItem) {
                    return res.status(400).json({
                        success: false,
                        message: `Finished Good '${fgIdStr}' is not part of POS Invoice ${invoiceDoc.invoiceNumber}.`
                    });
                }

                const alreadyDispatched = itemDispatchedMap[fgIdStr] || 0;
                const remainingAllowed = invItem.quantity - alreadyDispatched;

                if (numQty > remainingAllowed + 0.0001) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot dispatch ${numQty} units of item. Invoiced: ${invItem.quantity}, Already dispatched: ${alreadyDispatched}, Remaining allowed: ${remainingAllowed}.`
                    });
                }

                cleanedItems.push({
                    finishedGood: dispatchItem.finishedGood,
                    dispatchedQuantity: numQty,
                    batchNumber: dispatchItem.batchNumber ? String(dispatchItem.batchNumber).trim() : undefined
                });
            }

            const dispatchDocs = await Dispatch.create([{
                tenant: tenantId,
                dispatchNumber,
                salesOrder: null,
                invoice: invoiceDoc._id,
                sourceType: 'POS_INVOICE',
                dispatchDate: dispatchDate || new Date(),
                items: cleanedItems,
                dispatchLocation,
                vehicleNumber: vehicleNumber ? String(vehicleNumber).trim().toUpperCase() : '',
                transporter: transporter ? String(transporter).trim() : 'Self Transport',
                driverName: driverName ? String(driverName).trim() : '',
                driverPhone: driverPhone ? String(driverPhone).trim() : '',
                deliveryStatus: 'IN_TRANSIT',
                notes,
                dispatchedBy: req.user._id || req.user.id
            }]);

            const dispatch = dispatchDocs[0];

            await dispatch.populate([
                {
                    path: 'invoice',
                    select: 'invoiceNumber customer walkInCustomer grandTotal paymentStatus paymentMode dueAmount',
                    populate: { path: 'customer', select: 'companyName code contactPerson phone' }
                },
                { path: 'dispatchLocation', select: 'name code type' },
                { path: 'items.finishedGood', select: 'name code uom currentStock' },
                { path: 'dispatchedBy', select: 'name email' }
            ]);

            return res.status(201).json({
                success: true,
                message: `Dispatch '${dispatchNumber}' created successfully for POS Invoice '${invoiceDoc.invoiceNumber}'.`,
                data: {
                    dispatch,
                    sourceType: 'POS_INVOICE',
                    stockTransactionsCreated: []
                }
            });
        }

        // BRANCH B: Sales Order Dispatch (with inventory deduction & SO fulfillment tracking)
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false; // Fallback for standalone MongoDB
        }

        const createdStockTransactions = [];
        const sessionOption = useTransaction ? { session } : {};

        // Fetch SalesOrder in session
        const soQuery = SalesOrder.findOne({ _id: salesOrder, tenant: tenantId });
        if (useTransaction && session) soQuery.session(session);
        const soDoc = await soQuery;

        if (!soDoc) {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found or does not belong to your organization.'
            });
        }

        if (soDoc.status !== 'CONFIRMED' && soDoc.status !== 'READY_FOR_DISPATCH' && soDoc.status !== 'DISPATCHED' && soDoc.status !== 'PARTIALLY_DISPATCHED') {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: `Cannot dispatch goods against Sales Order with status '${soDoc.status}'. Goods can only be dispatched for orders that are 'CONFIRMED', 'READY_FOR_DISPATCH', or 'DISPATCHED'.`
            });
        }

        const cleanedItems = [];

        // 4. Validate items against SalesOrder and Physical Current Stock
        for (const dispatchItem of items) {
            const numQty = Number(dispatchItem.dispatchedQuantity);
            if (!dispatchItem.finishedGood || isNaN(numQty) || numQty <= 0) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'Each dispatch item must have a valid finishedGood ObjectId and a positive dispatchedQuantity > 0.'
                });
            }

            const fgIdStr = String(dispatchItem.finishedGood);
            const soItem = soDoc.items.find((i) => String(i.finishedGood) === fgIdStr);

            if (!soItem) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Finished Good '${fgIdStr}' is not part of Sales Order ${soDoc.soNumber}.`
                });
            }

            const currentDispatched = soItem.dispatchedQuantity || 0;
            const remainingAllowed = soItem.quantity - currentDispatched;

            if (numQty > remainingAllowed + 0.0001) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Cannot dispatch ${numQty} units of item. Ordered: ${soItem.quantity}, Already dispatched: ${currentDispatched}, Remaining allowed: ${remainingAllowed}.`
                });
            }

            // Verify physical sellable currentStock on FinishedGood
            const fgQuery = FinishedGood.findOne({ _id: dispatchItem.finishedGood, tenant: tenantId });
            if (useTransaction && session) fgQuery.session(session);
            const fgDoc = await fgQuery;

            if (!fgDoc) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Finished Good '${fgIdStr}' does not exist or does not belong to your organization.`
                });
            }

            if (fgDoc.currentStock < numQty) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Insufficient sellable current stock for '${fgDoc.name}'. Current sellable stock: ${fgDoc.currentStock}, requested dispatch: ${numQty}.`
                });
            }

            cleanedItems.push({
                finishedGood: dispatchItem.finishedGood,
                dispatchedQuantity: numQty,
                batchNumber: dispatchItem.batchNumber ? String(dispatchItem.batchNumber).trim() : undefined
            });
        }

        // Step A: Create Dispatch Document
        const dispatchDocs = await Dispatch.create([{
            tenant: tenantId,
            dispatchNumber,
            salesOrder: soDoc._id,
            invoice: null,
            sourceType: 'SALES_ORDER',
            dispatchDate: dispatchDate || new Date(),
            items: cleanedItems,
            dispatchLocation,
            vehicleNumber,
            transporter,
            driverName,
            driverPhone,
            deliveryStatus: 'IN_TRANSIT',
            notes,
            dispatchedBy: req.user._id || req.user.id
        }], sessionOption);

        const dispatch = dispatchDocs[0];

        // Step B: Create STOCK_OUT StockTransactions for each item & update SalesOrder item dispatchedQuantity
        for (const item of cleanedItems) {
            const txnResult = await executeStockTransactionCore({
                tenantId,
                referenceNumber: dispatchNumber,
                itemType: 'FINISHED_GOOD',
                item: item.finishedGood,
                transactionType: 'STOCK_OUT',
                quantity: item.dispatchedQuantity,
                fromLocation: dispatchLocation,
                batchNumber: item.batchNumber,
                notes: notes || `Goods dispatched via Dispatch ${dispatchNumber} for SO ${soDoc.soNumber}`,
                performedBy: req.user._id || req.user.id
            }, sessionOption);

            createdStockTransactions.push(txnResult.transaction);

            // Increment SalesOrder item dispatchedQuantity
            const soItem = soDoc.items.find((i) => String(i.finishedGood) === String(item.finishedGood));
            if (soItem) {
                soItem.dispatchedQuantity += item.dispatchedQuantity;
            }
        }

        // Step C: Recompute SalesOrder Status (Set 'DISPATCHED' if ALL items fully dispatched)
        const allFullyDispatched = soDoc.items.every((i) => i.dispatchedQuantity >= i.quantity - 0.0001);
        if (allFullyDispatched) {
            soDoc.status = 'DISPATCHED';
        } else {
            soDoc.status = 'PARTIALLY_DISPATCHED';
        }

        await soDoc.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await dispatch.populate([
            { path: 'salesOrder', select: 'soNumber status totalValue' },
            { path: 'dispatchLocation', select: 'name code type' },
            { path: 'items.finishedGood', select: 'name code uom currentStock' },
            { path: 'dispatchedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Dispatch '${dispatchNumber}' processed successfully. Inventory deducted and SO status updated to '${soDoc.status}'.`,
            data: {
                dispatch,
                sourceType: 'SALES_ORDER',
                updatedSalesOrder: {
                    id: soDoc._id,
                    soNumber: soDoc.soNumber,
                    status: soDoc.status,
                    items: soDoc.items
                },
                stockTransactionsCreated: createdStockTransactions
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in createDispatch:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to process Dispatch.'
        });
    }
};

/**
 * @desc    Update Delivery Status / POD Workflow of a Dispatch (IN_TRANSIT -> POD_PENDING_APPROVAL -> DELIVERED / RETURNED)
 * @route   PATCH /api/dispatches/:id/delivery-status
 * @access  Private (SALES:UPDATE permission)
 */
const updateDeliveryStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { action, deliveryStatus, receiverName, receiverPhone, proofDocument, proofImage, notes, rejectionReason } = req.body;
        const requestedStatus = action || deliveryStatus;

        if (!requestedStatus) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid action ('UPLOAD_POD', 'APPROVE_POD', 'REJECT_POD', 'RETURNED')."
            });
        }

        const dispatch = await Dispatch.findOne({ _id: req.params.id, tenant: tenantId });
        if (!dispatch) {
            return res.status(404).json({
                success: false,
                message: 'Dispatch record not found.'
            });
        }

        const Invoice = require('../models/invoice.model');
        const Notification = require('../models/notification.model');

        // STEP 1: Upload POD (Transitions IN_TRANSIT -> POD_PENDING_APPROVAL)
        if (requestedStatus === 'UPLOAD_POD' || requestedStatus === 'POD_PENDING_APPROVAL') {
            if (dispatch.deliveryStatus === 'DELIVERED') {
                return res.status(400).json({
                    success: false,
                    message: 'This dispatch is already marked as DELIVERED.'
                });
            }

            dispatch.deliveryStatus = 'POD_PENDING_APPROVAL';
            dispatch.pod = {
                receiverName: receiverName || req.body.pod?.receiverName || dispatch.pod?.receiverName || '',
                receiverPhone: receiverPhone || req.body.pod?.receiverPhone || dispatch.pod?.receiverPhone || '',
                proofDocument: proofDocument || req.body.pod?.proofDocument || dispatch.pod?.proofDocument || '',
                proofImage: proofImage || req.body.pod?.proofImage || dispatch.pod?.proofImage || '',
                notes: notes || req.body.pod?.notes || dispatch.pod?.notes || '',
                uploadedBy: req.user._id || req.user.id,
                uploadedAt: new Date(),
                rejectionReason: null,
                rejectedAt: null
            };

            await dispatch.save();

            // Notify Admin / Approvers of pending POD approval
            try {
                await Notification.create({
                    tenant: tenantId,
                    type: 'DISPATCH_ALERT',
                    module: 'SALES',
                    priority: 'HIGH',
                    title: `POD Uploaded: ${dispatch.dispatchNumber}`,
                    message: `Proof of Delivery uploaded for Dispatch ${dispatch.dispatchNumber}. Awaiting Admin Approval.`,
                    link: `/dispatch`,
                    data: { dispatchId: dispatch._id, dispatchNumber: dispatch.dispatchNumber }
                });
            } catch (notifErr) {
                console.warn('Non-critical notification creation error:', notifErr.message);
            }

            await dispatch.populate([
                { path: 'salesOrder', select: 'soNumber status' },
                { path: 'dispatchLocation', select: 'name code' },
                { path: 'items.finishedGood', select: 'name code uom' },
                { path: 'dispatchedBy', select: 'name email' },
                { path: 'pod.uploadedBy', select: 'name email' }
            ]);

            return res.status(200).json({
                success: true,
                message: `Proof of Delivery uploaded for Dispatch '${dispatch.dispatchNumber}'. Status updated to 'POD_PENDING_APPROVAL'.`,
                data: dispatch
            });
        }

        // STEP 2A: Approve POD / Mark DELIVERED (Gated by mandatory POD upload & Payment Settlement)
        if (requestedStatus === 'APPROVE_POD' || requestedStatus === 'DELIVERED') {
            if (dispatch.deliveryStatus === 'DELIVERED') {
                return res.status(400).json({
                    success: false,
                    message: 'This dispatch is already marked as DELIVERED.'
                });
            }

            // GATED CHECK 1: Ensure POD was uploaded first (no shortcuts to DELIVERED)
            if (!dispatch.pod || (!dispatch.pod.proofImage && !dispatch.pod.proofDocument && !dispatch.pod.receiverName)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot mark as DELIVERED directly. Driver/dispatcher must upload Proof of Delivery (POD) photo/details first.'
                });
            }

            // GATED CHECK 2: Verify linked Invoice Payment Status is PAID
            let linkedInvoice = null;
            if (dispatch.salesOrder) {
                linkedInvoice = await Invoice.findOne({ salesOrder: dispatch.salesOrder, tenant: tenantId });
            } else if (dispatch.invoice) {
                linkedInvoice = await Invoice.findOne({ _id: dispatch.invoice, tenant: tenantId });
            }

            if (linkedInvoice && (linkedInvoice.paymentStatus !== 'PAID' || (linkedInvoice.dueAmount && linkedInvoice.dueAmount > 0.001))) {
                const outstandingDue = (linkedInvoice.dueAmount !== undefined ? linkedInvoice.dueAmount : linkedInvoice.grandTotal).toLocaleString();
                return res.status(400).json({
                    success: false,
                    message: `Cannot approve delivery — outstanding payment of ₹${outstandingDue} remains on Invoice ${linkedInvoice.invoiceNumber}.`
                });
            }

            dispatch.deliveryStatus = 'DELIVERED';
            dispatch.podConfirmedAt = new Date();

            if (!dispatch.pod) dispatch.pod = {};
            if (receiverName) dispatch.pod.receiverName = receiverName;
            if (receiverPhone) dispatch.pod.receiverPhone = receiverPhone;
            if (proofDocument) dispatch.pod.proofDocument = proofDocument;
            if (proofImage) dispatch.pod.proofImage = proofImage;
            if (notes) dispatch.pod.notes = notes;
            dispatch.pod.approvedBy = req.user._id || req.user.id;
            dispatch.pod.approvedAt = new Date();

            await dispatch.save();

            await dispatch.populate([
                { path: 'salesOrder', select: 'soNumber status' },
                { path: 'invoice', select: 'invoiceNumber paymentStatus customer walkInCustomer' },
                { path: 'dispatchLocation', select: 'name code' },
                { path: 'items.finishedGood', select: 'name code uom' },
                { path: 'dispatchedBy', select: 'name email' },
                { path: 'pod.uploadedBy', select: 'name email' },
                { path: 'pod.approvedBy', select: 'name email' }
            ]);

            return res.status(200).json({
                success: true,
                message: `Dispatch '${dispatch.dispatchNumber}' delivery approved and marked as 'DELIVERED'.`,
                data: dispatch
            });
        }

        // STEP 2B: Reject POD (Reverts to IN_TRANSIT with reason)
        if (requestedStatus === 'REJECT_POD') {
            dispatch.deliveryStatus = 'IN_TRANSIT';
            if (!dispatch.pod) dispatch.pod = {};
            dispatch.pod.rejectionReason = rejectionReason || notes || 'Proof of Delivery rejected by Admin. Please re-upload.';
            dispatch.pod.rejectedAt = new Date();

            await dispatch.save();

            await dispatch.populate([
                { path: 'salesOrder', select: 'soNumber status' },
                { path: 'invoice', select: 'invoiceNumber paymentStatus customer walkInCustomer' },
                { path: 'dispatchLocation', select: 'name code' },
                { path: 'items.finishedGood', select: 'name code uom' },
                { path: 'dispatchedBy', select: 'name email' }
            ]);

            return res.status(200).json({
                success: true,
                message: `Proof of Delivery rejected for Dispatch '${dispatch.dispatchNumber}'. Status reverted to 'IN_TRANSIT'.`,
                data: dispatch
            });
        }

        // Return handling
        if (requestedStatus === 'RETURNED') {
            dispatch.deliveryStatus = 'RETURNED';
            await dispatch.save();

            await dispatch.populate([
                { path: 'salesOrder', select: 'soNumber status' },
                { path: 'invoice', select: 'invoiceNumber paymentStatus customer walkInCustomer' },
                { path: 'dispatchLocation', select: 'name code' },
                { path: 'items.finishedGood', select: 'name code uom' },
                { path: 'dispatchedBy', select: 'name email' }
            ]);

            return res.status(200).json({
                success: true,
                message: `Dispatch '${dispatch.dispatchNumber}' marked as 'RETURNED'. Stock/SO status reversal must be processed via manual Stock Adjustment.`,
                data: dispatch
            });
        }

        return res.status(400).json({
            success: false,
            message: `Unsupported action '${requestedStatus}'.`
        });
    } catch (error) {
        console.error('Error in updateDeliveryStatus:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update delivery status.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Dispatches scoped to user's tenant
 * @route   GET /api/dispatches
 * @access  Private (SALES:READ permission)
 */
const getDispatches = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { salesOrder, invoice, sourceType, deliveryStatus, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (salesOrder) filter.salesOrder = salesOrder;
        if (invoice) filter.invoice = invoice;
        if (sourceType) filter.sourceType = sourceType;

        const resolvedDeliveryStatus = deliveryStatus || req.query.status;
        if (resolvedDeliveryStatus && resolvedDeliveryStatus !== 'All' && resolvedDeliveryStatus !== 'All Statuses') {
            filter.deliveryStatus = resolvedDeliveryStatus;
        }

        if (search) {
            filter.$or = [
                { dispatchNumber: { $regex: search, $options: 'i' } },
                { vehicleNumber: { $regex: search, $options: 'i' } },
                { transporter: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [dispatches, total] = await Promise.all([
            Dispatch.find(filter)
                .populate({
                    path: 'salesOrder',
                    select: 'soNumber status customer totalValue',
                    populate: {
                        path: 'customer',
                        select: 'companyName code contactPerson phone'
                    }
                })
                .populate({
                    path: 'invoice',
                    select: 'invoiceNumber customer walkInCustomer grandTotal paymentStatus paymentMode dueAmount',
                    populate: {
                        path: 'customer',
                        select: 'companyName code contactPerson phone'
                    }
                })
                .populate('dispatchLocation', 'name code type')
                .populate('items.finishedGood', 'name code uom')
                .populate('dispatchedBy', 'name email')
                .populate('pod.uploadedBy', 'name email')
                .populate('pod.approvedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Dispatch.countDocuments(filter)
        ]);

        // Attach linked invoice payment status to each sales-order-based dispatch
        const Invoice = require('../models/invoice.model');
        const soIds = dispatches.map((d) => d.salesOrder?._id || d.salesOrder).filter(Boolean);
        const soInvoices = await Invoice.find({ salesOrder: { $in: soIds }, tenant: tenantId })
            .select('invoiceNumber paymentStatus dueAmount grandTotal paidAmount salesOrder');

        const soInvoiceMap = new Map();
        soInvoices.forEach((inv) => soInvoiceMap.set(String(inv.salesOrder), inv));

        const enrichedDispatches = dispatches.map((d) => {
            const dObj = d.toObject ? d.toObject() : d;
            if (!dObj.invoice && dObj.salesOrder) {
                const soIdStr = String(dObj.salesOrder?._id || dObj.salesOrder);
                dObj.invoice = soInvoiceMap.get(soIdStr) || null;
            }
            return dObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedDispatches.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: enrichedDispatches
        });
    } catch (error) {
        console.error('Error in getDispatches:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Dispatches.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Dispatch by ID scoped to user's tenant
 * @route   GET /api/dispatches/:id
 * @access  Private (SALES:READ permission)
 */
const getDispatchById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const dispatch = await Dispatch.findOne({ _id: req.params.id, tenant: tenantId })
            .populate({
                path: 'salesOrder',
                select: 'soNumber status orderDate deliveryDue customer totalValue',
                populate: { path: 'customer', select: 'companyName code contactPerson phone address' }
            })
            .populate({
                path: 'invoice',
                select: 'invoiceNumber invoiceDate customer walkInCustomer grandTotal paymentStatus paymentMode dueAmount',
                populate: { path: 'customer', select: 'companyName code contactPerson phone address' }
            })
            .populate('dispatchLocation', 'name code type')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock pricePerBag',
                populate: { path: 'uom', select: 'name symbol' }
            })
            .populate('dispatchedBy', 'name email')
            .populate('pod.uploadedBy', 'name email')
            .populate('pod.approvedBy', 'name email');

        if (!dispatch) {
            return res.status(404).json({
                success: false,
                message: 'Dispatch record not found.'
            });
        }

        const Invoice = require('../models/invoice.model');
        let linkedInvoice = dispatch.invoice;
        if (!linkedInvoice && dispatch.salesOrder) {
            linkedInvoice = await Invoice.findOne({ salesOrder: dispatch.salesOrder?._id || dispatch.salesOrder, tenant: tenantId })
                .select('invoiceNumber paymentStatus dueAmount grandTotal paidAmount');
        }

        const responseData = dispatch.toObject();
        responseData.invoice = linkedInvoice || null;

        return res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error in getDispatchById:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Dispatch record.',
            error: error.message
        });
    }
};

module.exports = {
    getDispatchableSources,
    createDispatch,
    updateDeliveryStatus,
    getDispatches,
    getDispatchById
};
