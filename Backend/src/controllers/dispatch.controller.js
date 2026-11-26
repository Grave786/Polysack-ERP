const mongoose = require('mongoose');
const Dispatch = require('../models/dispatch.model');
const SalesOrder = require('../models/salesOrder.model');
const Location = require('../models/location.model');
const FinishedGood = require('../models/finishedGood.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');
const { isTenantAdmin } = require('../middlewares/rbac.middleware');
const { resolveEmptyBagWeightGms } = require('../utils/bagWeightHelper');

/**
 * Helper to convert quantity between SO line UOM and Finished Good stock UOM
 * Blocks incompatible conversions with clear descriptive errors.
 */
const convertUomQuantity = (qty, fromUom, toUom, fgDoc) => {
    const numQty = Number(qty);
    if (isNaN(numQty) || numQty <= 0) {
        return { convertedQty: 0, matched: true };
    }

    const from = String(fromUom || 'Pcs').trim().toLowerCase();
    const to = String(toUom || 'Pcs').trim().toLowerCase();

    const isCountUnit = (u) => ['pcs', 'pc', 'pieces', 'piece', 'bags', 'bag', 'nos', 'no', 'units', 'unit'].includes(u);
    const isWeightUnit = (u) => ['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(u);

    // Case 1: Exact match or count-to-count or weight-to-weight
    if (from === to || (isCountUnit(from) && isCountUnit(to)) || (isWeightUnit(from) && isWeightUnit(to))) {
        return { convertedQty: numQty, matched: true };
    }

    // Case 2: Weight to Count (e.g. SO in Kg, FG stock in Pcs/Bags)
    if (isWeightUnit(from) && isCountUnit(to)) {
        const bagWeightGms = resolveEmptyBagWeightGms(fgDoc);
        if (bagWeightGms > 0) {
            const bagWeightKg = bagWeightGms / 1000;
            return {
                convertedQty: Number((numQty / bagWeightKg).toFixed(4)),
                matched: true,
                factorDescription: `${bagWeightGms}g/bag`
            };
        }
        return {
            convertedQty: null,
            matched: false,
            error: `UOM mismatch: cannot convert ${fromUom} to ${toUom} for '${fgDoc?.name || 'product'}' (bag weight is not configured or derivable in Finished Good master).`
        };
    }

    // Case 3: Count to Weight (e.g. SO in Pcs/Bags, FG stock in Kg)
    if (isCountUnit(from) && isWeightUnit(to)) {
        const bagWeightGms = resolveEmptyBagWeightGms(fgDoc);
        if (bagWeightGms > 0) {
            const bagWeightKg = bagWeightGms / 1000;
            return {
                convertedQty: Number((numQty * bagWeightKg).toFixed(4)),
                matched: true,
                factorDescription: `${bagWeightGms}g/bag`
            };
        }
        return {
            convertedQty: null,
            matched: false,
            error: `UOM mismatch: cannot convert ${fromUom} to ${toUom} for '${fgDoc?.name || 'product'}' (bag weight is not configured or derivable in Finished Good master).`
        };
    }

    // Case 4: Any other non-convertible UOM
    return {
        convertedQty: null,
        matched: false,
        error: `UOM mismatch: cannot convert ${fromUom} to ${toUom} for '${fgDoc?.name || 'product'}'.`
    };
};

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
        const WorkOrder = require('../models/workOrder.model');
        const ProductionLog = require('../models/productionLog.model');
        const BOM = require('../models/bom.model');
        const Customer = require('../models/customer.model');

        // 1. Fetch active Sales Orders in CONFIRMED, READY_FOR_DISPATCH, or PARTIALLY_DISPATCHED
        const salesOrders = await SalesOrder.find({
            tenant: tenantId,
            status: { $in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED'] }
        })
            .populate('customer', 'companyName name code contactPerson phone city state address gstin')
            .populate({
                path: 'sourceEnquiry',
                select: 'customer customerRef newCustomerDetails nslNumber',
                populate: { path: 'customer customerRef', select: 'companyName name code contactPerson phone city state address' }
            })
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock bagWeightGms tareWeightGram dimensions dimensionUnit fabricGSM bagShape bagCapacity pcsPerBale balingQuantityPcs',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            })
            .sort({ createdAt: -1 });

        // 2. Fetch POS Invoices (where salesOrder is null/undefined)
        const posInvoices = await Invoice.find({
            tenant: tenantId,
            salesOrder: null,
            isActive: true
        })
            .populate('customer', 'companyName name code contactPerson phone city state address gstin')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock bagWeightGms tareWeightGram dimensions dimensionUnit fabricGSM bagShape bagCapacity pcsPerBale balingQuantityPcs',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            })
            .sort({ createdAt: -1 });

        // Lookup any unpopulated or orphan customer references to guarantee real customer names
        const unpopulatedCustomerIds = [];
        for (const so of salesOrders) {
            const cId = so.customer?._id || so.customer;
            if (cId && (!so.customer || typeof so.customer !== 'object' || !so.customer.companyName)) {
                if (mongoose.isValidObjectId(cId)) {
                    unpopulatedCustomerIds.push(cId);
                }
            }
        }
        const fallbackCustomerMap = new Map();
        if (unpopulatedCustomerIds.length > 0) {
            const foundCustomers = await Customer.find({ _id: { $in: unpopulatedCustomerIds } })
                .select('companyName name code contactPerson phone city state address gstin')
                .lean();
            foundCustomers.forEach((c) => fallbackCustomerMap.set(String(c._id), c));
        }

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

        // 3. Collect finished goods and query WorkOrder / BOM for Baling & Weight specs
        const allFgIds = new Set();
        for (const so of salesOrders) {
            for (const it of so.items || []) {
                const fId = it.finishedGood?._id || it.finishedGood;
                if (fId) allFgIds.add(String(fId));
            }
        }
        for (const inv of posInvoices) {
            for (const it of inv.items || []) {
                const fId = it.finishedGood?._id || it.finishedGood;
                if (fId) allFgIds.add(String(fId));
            }
        }

        const fgIdArray = Array.from(allFgIds);
        let workOrders = [];
        let bomMap = new Map();

        if (fgIdArray.length > 0) {
            const [woDocs, bomDocs] = await Promise.all([
                WorkOrder.find({
                    tenant: tenantId,
                    finishedGood: { $in: fgIdArray }
                })
                    .select('_id customer finishedGood stages jobOrderDetails')
                    .sort({ createdAt: -1 })
                    .lean(),
                BOM.find({
                    tenant: tenantId,
                    finishedGood: { $in: fgIdArray },
                    isActive: true
                })
                    .select('finishedGood materials rawMaterials totalWeight')
                    .lean()
            ]);

            workOrders = woDocs || [];
            (bomDocs || []).forEach((b) => {
                if (b.finishedGood) bomMap.set(String(b.finishedGood), b);
            });
        }

        const getBalingSpec = (fgId, customerId, fgDoc, activeBom = null) => {
            const fgStr = String(fgId);
            const custStr = customerId ? String(customerId) : null;

            const matchingWos = workOrders.filter((w) => String(w.finishedGood) === fgStr);
            let targetWos = custStr
                ? matchingWos.filter((w) => String(w.customer) === custStr)
                : [];
            if (targetWos.length === 0) {
                targetWos = matchingWos;
            }

            // Step 1: Real Empty Bag Weight in Kg (Valid range: 15g to 500g -> 0.015kg to 0.500kg)
            let avgBagWeightKg = null;
            const weightGms = resolveEmptyBagWeightGms(fgDoc, activeBom);
            if (weightGms && weightGms >= 15 && weightGms <= 500) {
                avgBagWeightKg = Number((weightGms / 1000).toFixed(4));
            }

            // Step 2: Pcs per Bale must come from finished good or workorder baling specification
            let pcsPerBale = null;
            if (fgDoc?.pcsPerBale > 0 && fgDoc.pcsPerBale <= 5000) {
                pcsPerBale = fgDoc.pcsPerBale;
            } else if (fgDoc?.balingQuantityPcs > 0 && fgDoc.balingQuantityPcs <= 5000) {
                pcsPerBale = fgDoc.balingQuantityPcs;
            }

            if (!pcsPerBale) {
                for (const wo of targetWos) {
                    const balingStage = (wo.stages || []).find(
                        (s) => s.stageName === 'BALING_PACKING' || s.sequence === 8
                    );
                    if (balingStage?.balingQuantityPcs >= 20 && balingStage.balingQuantityPcs <= 5000) {
                        pcsPerBale = balingStage.balingQuantityPcs;
                        break;
                    }
                    if (wo.jobOrderDetails?.balingQuantityPcs >= 20 && wo.jobOrderDetails.balingQuantityPcs <= 5000) {
                        pcsPerBale = wo.jobOrderDetails.balingQuantityPcs;
                        break;
                    }
                }
            }

            return {
                avgBagWeightKg: avgBagWeightKg || null,
                pcsPerBale: pcsPerBale || null
            };
        };

        const dispatchableSOList = [];
        for (const so of salesOrders) {
            const items = (so.items || []).map((it) => {
                const fg = it.finishedGood || {};
                const fgId = fg._id || it.finishedGood;
                const orderedQty = Number(it.quantity || 0);
                const alreadyDispatched = Number(it.dispatchedQuantity || 0);
                const remainingQty = Math.max(0, orderedQty - alreadyDispatched);
                const activeBom = bomMap.get(String(fgId));
                const balingSpec = getBalingSpec(fgId, so.customer?._id || so.customer, fg, activeBom);

                const fgUom = (fg.uom && typeof fg.uom === 'object') ? (fg.uom.symbol || fg.uom.name) : (fg.uom || 'Pcs');
                const soLineUom = it.unit || fgUom || 'Pcs';

                return {
                    finishedGood: fgId,
                    name: fg.name || 'Finished Goods Bag',
                    code: fg.code || '',
                    uom: soLineUom,
                    unit: soLineUom,
                    orderedQuantity: orderedQty,
                    alreadyDispatched,
                    remainingQuantity: remainingQty,
                    currentStock: Number(fg.currentStock !== undefined && fg.currentStock !== null ? fg.currentStock : 0),
                    avgBagWeightKg: balingSpec.avgBagWeightKg,
                    pcsPerBale: balingSpec.pcsPerBale
                };
            });

            const totalRemaining = items.reduce((acc, it) => acc + it.remainingQuantity, 0);
            const totalOrdered = items.reduce((acc, it) => acc + it.orderedQuantity, 0);

            if (totalRemaining > 0) {
                const cId = String(so.customer?._id || so.customer || '');
                const fallbackCust = fallbackCustomerMap.get(cId);
                const se = so.sourceEnquiry;
                const seCust = se?.customer || se?.customerRef;
                const cust = (so.customer && typeof so.customer === 'object' && (so.customer.companyName || so.customer.name))
                    ? so.customer
                    : (fallbackCust || seCust || null);

                const custName =
                    cust?.companyName ||
                    cust?.name ||
                    se?.newCustomerDetails?.company ||
                    se?.newCustomerDetails?.name ||
                    so.customerName ||
                    'Customer';

                const remainingByUnit = items.reduce((acc, it) => {
                    if (it.remainingQuantity > 0) {
                        acc[it.uom] = (acc[it.uom] || 0) + it.remainingQuantity;
                    }
                    return acc;
                }, {});
                const remainingLabelText = Object.entries(remainingByUnit)
                    .map(([u, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(2)).toLocaleString('en-IN')} ${u}`)
                    .join(' + ') || `${totalRemaining.toLocaleString()} Pcs`;

                dispatchableSOList.push({
                    sourceType: 'SALES_ORDER',
                    id: so._id,
                    salesOrderId: so._id,
                    invoiceId: null,
                    referenceNumber: so.soNumber,
                    label: `${so.soNumber} — ${custName} (Sales Order, ${remainingLabelText} remaining)`,
                    customerName: custName,
                    customerId: cust?._id || so.customer?._id || null,
                    customerPhone: cust?.phone || so.customer?.phone || '',
                    deliveryAddress: cust?.city ? `${cust.city}, ${cust.state || ''}` : (so.customer?.city ? `${so.customer.city}, ${so.customer.state || ''}` : ''),
                    totalQuantity: totalOrdered,
                    remainingQuantity: totalRemaining,
                    items
                });
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
                const activeBom = bomMap.get(String(fgId));
                const balingSpec = getBalingSpec(fgId, inv.customer?._id || inv.customer, fg, activeBom);

                const fgUom = (fg.uom && typeof fg.uom === 'object') ? (fg.uom.symbol || fg.uom.name) : (fg.uom || 'Pcs');
                const posLineUom = it.unit || fgUom || 'Pcs';

                return {
                    finishedGood: fgId,
                    name: fg.name || it.description || 'Finished Goods Bag',
                    code: fg.code || '',
                    uom: posLineUom,
                    unit: posLineUom,
                    orderedQuantity: orderedQty,
                    alreadyDispatched,
                    remainingQuantity: remainingQty,
                    avgBagWeightKg: balingSpec.avgBagWeightKg,
                    pcsPerBale: balingSpec.pcsPerBale
                };
            });

            const totalRemaining = items.reduce((acc, it) => acc + it.remainingQuantity, 0);
            const totalOrdered = items.reduce((acc, it) => acc + it.orderedQuantity, 0);

            if (totalRemaining > 0) {
                const custName = inv.customer?.companyName || inv.customer?.name || inv.walkInCustomer?.name || 'Counter Retail Customer';
                const remainingByUnit = items.reduce((acc, it) => {
                    if (it.remainingQuantity > 0) {
                        acc[it.uom] = (acc[it.uom] || 0) + it.remainingQuantity;
                    }
                    return acc;
                }, {});
                const remainingLabelText = Object.entries(remainingByUnit)
                    .map(([u, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(2)).toLocaleString('en-IN')} ${u}`)
                    .join(' + ') || `${totalRemaining.toLocaleString()} Pcs`;

                dispatchablePOSList.push({
                    sourceType: 'POS_INVOICE',
                    id: inv._id,
                    salesOrderId: null,
                    invoiceId: inv._id,
                    referenceNumber: inv.invoiceNumber,
                    label: `${inv.invoiceNumber} — ${custName} (POS Sale, ${remainingLabelText} remaining)`,
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

        const isUserAdmin = await isTenantAdmin(req.user);

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
                const posLineUom = invItem.unit || 'Pcs';

                if (!isUserAdmin && numQty > remainingAllowed + 0.0001) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot dispatch ${numQty} ${posLineUom} of item. Invoiced: ${invItem.quantity} ${posLineUom}, Already dispatched: ${alreadyDispatched} ${posLineUom}, Remaining allowed: ${remainingAllowed} ${posLineUom}.`
                    });
                }

                cleanedItems.push({
                    finishedGood: dispatchItem.finishedGood,
                    dispatchedQuantity: numQty,
                    unit: posLineUom,
                    dispatchedKg: dispatchItem.dispatchedKg !== undefined && dispatchItem.dispatchedKg !== null && dispatchItem.dispatchedKg !== '' && !isNaN(Number(dispatchItem.dispatchedKg))
                        ? Number(dispatchItem.dispatchedKg)
                        : undefined,
                    dispatchedBales: dispatchItem.dispatchedBales !== undefined && dispatchItem.dispatchedBales !== null && dispatchItem.dispatchedBales !== '' && !isNaN(Number(dispatchItem.dispatchedBales))
                        ? Number(dispatchItem.dispatchedBales)
                        : undefined,
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
                message: `Cannot dispatch goods against Sales Order with status '${soDoc.status}'. Goods can only be dispatched for orders that are 'CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED', or 'DISPATCHED'.`
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

            // SO line item UOM is source of truth
            const soLineUom = soItem.unit || 'Pcs';

            const currentDispatched = Number(soItem.dispatchedQuantity || 0);
            const remainingAllowed = Number(soItem.quantity || 0) - currentDispatched;

            if (!isUserAdmin && numQty > remainingAllowed + 0.0001) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Cannot dispatch ${numQty} ${soLineUom} of item. Ordered: ${soItem.quantity} ${soLineUom}, Already dispatched: ${currentDispatched} ${soLineUom}, Remaining allowed: ${remainingAllowed} ${soLineUom}.`
                });
            }

            // Verify physical sellable currentStock on FinishedGood
            const fgQuery = FinishedGood.findOne({ _id: dispatchItem.finishedGood, tenant: tenantId }).populate('uom');
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

            // Stock UOM conversion check
            const fgStockUom = (fgDoc.uom && typeof fgDoc.uom === 'object') ? (fgDoc.uom.symbol || fgDoc.uom.name) : (fgDoc.uom || 'Pcs');
            const conversion = convertUomQuantity(numQty, soLineUom, fgStockUom, fgDoc);

            if (!conversion.matched) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: conversion.error
                });
            }

            const stockDeductQty = conversion.convertedQty;
            const currentStockNum = Number(fgDoc.currentStock || 0);

            if (currentStockNum <= 0 || currentStockNum < stockDeductQty) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: currentStockNum <= 0
                        ? `Cannot dispatch '${fgDoc.name}': Item is out of stock (0 ${fgStockUom} available).`
                        : `Insufficient sellable current stock for '${fgDoc.name}'. Current sellable stock: ${currentStockNum} ${fgStockUom}, requested dispatch requires: ${stockDeductQty % 1 === 0 ? stockDeductQty : stockDeductQty.toFixed(2)} ${fgStockUom} (${numQty} ${soLineUom}).`
                });
            }

            cleanedItems.push({
                finishedGood: dispatchItem.finishedGood,
                dispatchedQuantity: numQty,
                unit: soLineUom,
                stockDeductQty,
                dispatchedKg: dispatchItem.dispatchedKg !== undefined && dispatchItem.dispatchedKg !== null && dispatchItem.dispatchedKg !== '' && !isNaN(Number(dispatchItem.dispatchedKg))
                    ? Number(dispatchItem.dispatchedKg)
                    : undefined,
                dispatchedBales: dispatchItem.dispatchedBales !== undefined && dispatchItem.dispatchedBales !== null && dispatchItem.dispatchedBales !== '' && !isNaN(Number(dispatchItem.dispatchedBales))
                    ? Number(dispatchItem.dispatchedBales)
                    : undefined,
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
            const deductQty = item.stockDeductQty !== undefined ? item.stockDeductQty : item.dispatchedQuantity;
            const txnResult = await executeStockTransactionCore({
                tenantId,
                referenceNumber: dispatchNumber,
                itemType: 'FINISHED_GOOD',
                item: item.finishedGood,
                transactionType: 'STOCK_OUT',
                quantity: deductQty,
                fromLocation: dispatchLocation,
                batchNumber: item.batchNumber,
                notes: notes || `Goods dispatched via Dispatch ${dispatchNumber} for SO ${soDoc.soNumber}`,
                performedBy: req.user._id || req.user.id
            }, sessionOption);

            createdStockTransactions.push(txnResult.transaction);

            // Increment SalesOrder item dispatchedQuantity (in SO line UOM)
            const soItem = soDoc.items.find((i) => String(i.finishedGood) === String(item.finishedGood));
            if (soItem) {
                soItem.dispatchedQuantity = Number(soItem.dispatchedQuantity || 0) + item.dispatchedQuantity;
            }
        }

        // Step C: Recompute SalesOrder Status (Set 'DISPATCHED' if ALL items fully dispatched)
        const allFullyDispatched = soDoc.items.every((i) => Number(i.dispatchedQuantity || 0) >= Number(i.quantity || 0) - 0.0001);
        const anyDispatched = soDoc.items.some((i) => Number(i.dispatchedQuantity || 0) > 0.0001);
        if (allFullyDispatched) {
            soDoc.status = 'DISPATCHED';
        } else if (anyDispatched) {
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
 * @desc    Update an existing Goods Dispatch Note (Tenant Admin only)
 *          Re-adjusts linked Sales Order / Invoice quantities, status, and inventory stock
 * @route   PUT /api/dispatches/:id
 * @access  Private (Tenant Admin only)
 */
const updateDispatch = async (req, res) => {
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

        const isUserAdmin = await isTenantAdmin(req.user);

        const dispatchId = req.params.id;
        const existingDispatch = await Dispatch.findOne({ _id: dispatchId, tenant: tenantId });
        if (!existingDispatch) {
            return res.status(404).json({
                success: false,
                message: 'Dispatch note not found or does not belong to your organization.'
            });
        }

        // 1. Status Check: Do not allow editing if already DELIVERED, RETURNED, or POD-confirmed
        const currentDeliveryStatus = (existingDispatch.deliveryStatus || '').toUpperCase();
        if (currentDeliveryStatus === 'DELIVERED' || currentDeliveryStatus === 'RETURNED' || existingDispatch.podConfirmedAt) {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit a dispatch that has already been marked as Delivered or POD-confirmed.'
            });
        }

        // 2. Validate input fields
        const {
            dispatchLocation,
            transporter,
            vehicleNumber,
            driverName,
            driverPhone,
            dispatchDate,
            notes,
            items
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one dispatch item is required.'
            });
        }

        const targetLocation = dispatchLocation || existingDispatch.dispatchLocation;
        const locationDoc = await Location.findOne({ _id: targetLocation, tenant: tenantId });
        if (!locationDoc) {
            return res.status(400).json({
                success: false,
                message: 'Dispatch location does not exist or does not belong to your organization.'
            });
        }

        // Clean & validate items
        const cleanedItems = [];
        for (const it of items) {
            const fgId = it.finishedGood?._id || it.finishedGood;
            const numQty = Number(it.dispatchedQuantity);
            if (!fgId || isNaN(numQty) || numQty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each dispatch item must have a valid finishedGood and a positive dispatchedQuantity > 0.'
                });
            }

            cleanedItems.push({
                finishedGood: fgId,
                dispatchedQuantity: numQty,
                dispatchedKg: it.dispatchedKg !== undefined && it.dispatchedKg !== null && it.dispatchedKg !== '' && !isNaN(Number(it.dispatchedKg))
                    ? Number(it.dispatchedKg)
                    : undefined,
                dispatchedBales: it.dispatchedBales !== undefined && it.dispatchedBales !== null && it.dispatchedBales !== '' && !isNaN(Number(it.dispatchedBales))
                    ? Number(it.dispatchedBales)
                    : undefined,
                batchNumber: it.batchNumber ? String(it.batchNumber).trim() : undefined
            });
        }

        // Start session / transaction
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false;
        }
        const sessionOption = useTransaction ? { session } : {};

        // 3. Map previous dispatched quantities from existingDispatch
        const oldThisDispatchQtyMap = new Map();
        for (const it of existingDispatch.items || []) {
            const fgStr = String(it.finishedGood?._id || it.finishedGood);
            oldThisDispatchQtyMap.set(fgStr, Number(it.dispatchedQuantity || 0));
        }

        // 4. Branch by Source Type (Sales Order vs POS Invoice)
        if (existingDispatch.salesOrder) {
            const soQuery = SalesOrder.findOne({ _id: existingDispatch.salesOrder, tenant: tenantId });
            if (useTransaction && session) soQuery.session(session);
            const soDoc = await soQuery;

            if (!soDoc) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(404).json({
                    success: false,
                    message: 'Linked Sales Order not found or does not belong to your organization.'
                });
            }

            // Find all other dispatches for this Sales Order (excluding this one)
            const otherDispatches = await Dispatch.find({
                _id: { $ne: existingDispatch._id },
                salesOrder: soDoc._id,
                tenant: tenantId
            });

            // Map dispatched quantity from other dispatches
            const otherDispatchesQtyMap = new Map();
            for (const od of otherDispatches) {
                for (const oi of od.items || []) {
                    const fgStr = String(oi.finishedGood?._id || oi.finishedGood);
                    otherDispatchesQtyMap.set(fgStr, (otherDispatchesQtyMap.get(fgStr) || 0) + Number(oi.dispatchedQuantity || 0));
                }
            }

            // Validate against SO ordered quantities & stock deltas
            for (const item of cleanedItems) {
                const fgStr = String(item.finishedGood);
                const soItem = soDoc.items.find((i) => String(i.finishedGood?._id || i.finishedGood) === fgStr);

                if (!soItem) {
                    if (useTransaction && session) {
                        if (session.inTransaction()) await session.abortTransaction();
                        session.endSession();
                    }
                    return res.status(400).json({
                        success: false,
                        message: `Finished Good '${fgStr}' is not part of Sales Order ${soDoc.soNumber}.`
                    });
                }

                const soLineUom = soItem.unit || 'Pcs';
                const otherDispatched = otherDispatchesQtyMap.get(fgStr) || 0;
                const maxAllowedForThisDispatch = Number(soItem.quantity || 0) - otherDispatched;

                if (!isUserAdmin && item.dispatchedQuantity > maxAllowedForThisDispatch + 0.0001) {
                    if (useTransaction && session) {
                        if (session.inTransaction()) await session.abortTransaction();
                        session.endSession();
                    }
                    return res.status(400).json({
                        success: false,
                        message: `Cannot dispatch ${item.dispatchedQuantity} ${soLineUom} of item '${soItem.name || fgStr}'. Ordered: ${soItem.quantity} ${soLineUom}, Dispatched in other dispatches: ${otherDispatched} ${soLineUom}, Maximum allowed for this dispatch: ${maxAllowedForThisDispatch} ${soLineUom}.`
                    });
                }

                item.unit = soLineUom;

                const oldQty = oldThisDispatchQtyMap.get(fgStr) || 0;
                const delta = item.dispatchedQuantity - oldQty;

                if (delta > 0 || delta < 0) {
                    const fgQuery = FinishedGood.findOne({ _id: item.finishedGood, tenant: tenantId }).populate('uom');
                    if (useTransaction && session) fgQuery.session(session);
                    const fgDoc = await fgQuery;

                    const fgStockUom = (fgDoc?.uom && typeof fgDoc.uom === 'object') ? (fgDoc.uom.symbol || fgDoc.uom.name) : (fgDoc?.uom || 'Pcs');
                    const conversion = convertUomQuantity(Math.abs(delta), soLineUom, fgStockUom, fgDoc);

                    if (!conversion.matched) {
                        if (useTransaction && session) {
                            if (session.inTransaction()) await session.abortTransaction();
                            session.endSession();
                        }
                        return res.status(400).json({
                            success: false,
                            message: conversion.error
                        });
                    }

                    const convertedDelta = conversion.convertedQty;

                    if (delta > 0) {
                        if (!fgDoc || Number(fgDoc.currentStock || 0) < convertedDelta) {
                            if (useTransaction && session) {
                                if (session.inTransaction()) await session.abortTransaction();
                                session.endSession();
                            }
                            return res.status(400).json({
                                success: false,
                                message: `Insufficient sellable current stock for '${fgDoc?.name || fgStr}'. Current stock: ${fgDoc?.currentStock || 0} ${fgStockUom}, additional required: ${convertedDelta % 1 === 0 ? convertedDelta : convertedDelta.toFixed(2)} ${fgStockUom} (+${delta} ${soLineUom}).`
                            });
                        }

                        await executeStockTransactionCore({
                            tenantId,
                            referenceNumber: existingDispatch.dispatchNumber,
                            itemType: 'FINISHED_GOOD',
                            item: item.finishedGood,
                            transactionType: 'STOCK_OUT',
                            quantity: convertedDelta,
                            fromLocation: targetLocation,
                            batchNumber: item.batchNumber,
                            notes: notes || `Quantity increased (+${delta} ${soLineUom}) via Dispatch edit ${existingDispatch.dispatchNumber} for SO ${soDoc.soNumber}`,
                            performedBy: req.user._id || req.user.id
                        }, sessionOption);
                    } else if (delta < 0) {
                        await executeStockTransactionCore({
                            tenantId,
                            referenceNumber: existingDispatch.dispatchNumber,
                            itemType: 'FINISHED_GOOD',
                            item: item.finishedGood,
                            transactionType: 'STOCK_IN',
                            quantity: convertedDelta,
                            toLocation: targetLocation,
                            batchNumber: item.batchNumber,
                            notes: notes || `Quantity reduced (-${Math.abs(delta)} ${soLineUom}) via Dispatch edit ${existingDispatch.dispatchNumber} for SO ${soDoc.soNumber}`,
                            performedBy: req.user._id || req.user.id
                        }, sessionOption);
                    }
                }
            }

            // Handle any items that were removed in the edit
            for (const [oldFgStr, oldQty] of oldThisDispatchQtyMap.entries()) {
                const stillPresent = cleanedItems.some((i) => String(i.finishedGood) === oldFgStr);
                if (!stillPresent && oldQty > 0) {
                    const fgDoc = await FinishedGood.findOne({ _id: oldFgStr, tenant: tenantId }).populate('uom');
                    const soItem = soDoc.items.find((i) => String(i.finishedGood?._id || i.finishedGood) === oldFgStr);
                    const soLineUom = soItem?.unit || 'Pcs';
                    const fgStockUom = (fgDoc?.uom && typeof fgDoc.uom === 'object') ? (fgDoc.uom.symbol || fgDoc.uom.name) : (fgDoc?.uom || 'Pcs');
                    const conversion = convertUomQuantity(oldQty, soLineUom, fgStockUom, fgDoc);
                    const returnStockQty = conversion.matched ? conversion.convertedQty : oldQty;

                    await executeStockTransactionCore({
                        tenantId,
                        referenceNumber: existingDispatch.dispatchNumber,
                        itemType: 'FINISHED_GOOD',
                        item: oldFgStr,
                        transactionType: 'STOCK_IN',
                        quantity: returnStockQty,
                        toLocation: targetLocation,
                        notes: `Item removed: returned ${oldQty} ${soLineUom} to stock via Dispatch edit ${existingDispatch.dispatchNumber}`,
                        performedBy: req.user._id || req.user.id
                    }, sessionOption);
                }
            }

            // Update Sales Order line item dispatched quantities without double counting
            for (const soItem of soDoc.items) {
                const fgStr = String(soItem.finishedGood?._id || soItem.finishedGood);
                const otherDispatched = otherDispatchesQtyMap.get(fgStr) || 0;
                const thisDispatched = cleanedItems
                    .filter((ci) => String(ci.finishedGood) === fgStr)
                    .reduce((sum, ci) => sum + ci.dispatchedQuantity, 0);

                soItem.dispatchedQuantity = otherDispatched + thisDispatched;
            }

            // Recompute Sales Order Status
            const allFullyDispatched = soDoc.items.every((i) => (i.dispatchedQuantity || 0) >= (i.quantity || 0) - 0.0001);
            const anyDispatched = soDoc.items.some((i) => (i.dispatchedQuantity || 0) > 0);

            if (allFullyDispatched) {
                soDoc.status = 'DISPATCHED';
            } else if (anyDispatched) {
                soDoc.status = 'PARTIALLY_DISPATCHED';
            } else {
                soDoc.status = 'READY_FOR_DISPATCH';
            }

            await soDoc.save(sessionOption);
        }

        // 5. Update Dispatch document
        existingDispatch.dispatchLocation = targetLocation;
        if (transporter !== undefined) existingDispatch.transporter = String(transporter).trim() || 'Self Transport';
        if (vehicleNumber !== undefined) existingDispatch.vehicleNumber = String(vehicleNumber).trim().toUpperCase();
        if (driverName !== undefined) existingDispatch.driverName = String(driverName).trim();
        if (driverPhone !== undefined) existingDispatch.driverPhone = String(driverPhone).trim();
        if (dispatchDate) existingDispatch.dispatchDate = new Date(dispatchDate);
        if (notes !== undefined) existingDispatch.notes = String(notes).trim();
        existingDispatch.items = cleanedItems;
        existingDispatch.lastEditedBy = req.user._id || req.user.id;
        existingDispatch.lastEditedAt = new Date();

        await existingDispatch.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await existingDispatch.populate([
            { path: 'salesOrder', select: 'soNumber status totalValue' },
            { path: 'invoice', select: 'invoiceNumber customer walkInCustomer' },
            { path: 'dispatchLocation', select: 'name code type' },
            { path: 'items.finishedGood', select: 'name code uom currentStock' },
            { path: 'dispatchedBy', select: 'name email' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Dispatch '${existingDispatch.dispatchNumber}' updated successfully.`,
            data: existingDispatch
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in updateDispatch:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update Dispatch.'
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

        const { salesOrder, invoice, sourceType, deliveryStatus, search, startDate, endDate, page = 1, limit = 20 } = req.query;

        const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId)
            ? new mongoose.Types.ObjectId(tenantId)
            : tenantId;

        const filter = { tenant: tenantObjId };

        if (salesOrder) filter.salesOrder = salesOrder;
        if (invoice) filter.invoice = invoice;
        if (sourceType) filter.sourceType = sourceType;

        const resolvedDeliveryStatus = deliveryStatus || req.query.status;
        if (resolvedDeliveryStatus && resolvedDeliveryStatus !== 'All' && resolvedDeliveryStatus !== 'All Statuses') {
            filter.deliveryStatus = resolvedDeliveryStatus;
        }

        // IST date boundaries for dispatchDate
        if (startDate || endDate) {
            filter.dispatchDate = {};
            if (startDate && startDate.trim()) {
                filter.dispatchDate.$gte = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
            }
            if (endDate && endDate.trim()) {
                filter.dispatchDate.$lte = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
            }
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
                    select: 'soNumber status customer totalValue orderDate deliveryDue items',
                    populate: {
                        path: 'customer',
                        select: 'companyName code contactPerson phone address city state gstin'
                    }
                })
                .populate({
                    path: 'invoice',
                    select: 'invoiceNumber customer walkInCustomer grandTotal paymentStatus paymentMode dueAmount invoiceDate',
                    populate: {
                        path: 'customer',
                        select: 'companyName code contactPerson phone address city state gstin'
                    }
                })
                .populate('dispatchLocation', 'name code type')
                .populate({
                    path: 'items.finishedGood',
                    select: 'name code uom bagShape dimensions dimensionUnit fabricGSM',
                    populate: { path: 'uom', select: 'name symbol abbreviation' }
                })
                .populate('dispatchedBy', 'name email')
                .populate('pod.uploadedBy', 'name email')
                .populate('pod.approvedBy', 'name email')
                .sort({ dispatchDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Dispatch.countDocuments(filter)
        ]);

        // Attach linked invoice payment status to each sales-order-based dispatch
        const Invoice = require('../models/invoice.model');
        const soIds = dispatches.map((d) => d.salesOrder?._id || d.salesOrder).filter(Boolean);
        const soInvoices = await Invoice.find({ salesOrder: { $in: soIds }, tenant: tenantObjId })
            .select('invoiceNumber paymentStatus dueAmount grandTotal paidAmount salesOrder');

        const soInvoiceMap = new Map();
        soInvoices.forEach((inv) => soInvoiceMap.set(String(inv.salesOrder), inv));

        const enrichedDispatches = dispatches.map((d) => {
            const dObj = d.toObject ? d.toObject() : d;
            if (!dObj.invoice && dObj.salesOrder) {
                const soIdStr = String(dObj.salesOrder?._id || dObj.salesOrder);
                dObj.invoice = soInvoiceMap.get(soIdStr) || null;
            }
            if (Array.isArray(dObj.items)) {
                dObj.items.forEach((it) => {
                    if (!it.unit) {
                        const fgId = it.finishedGood?._id || it.finishedGood;
                        const soItem = dObj.salesOrder?.items?.find((si) => String(si.finishedGood?._id || si.finishedGood) === String(fgId));
                        it.unit = soItem?.unit || it.finishedGood?.uom?.symbol || it.finishedGood?.uom?.name || 'Pcs';
                    }
                });
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
                select: 'soNumber status orderDate deliveryDue customer totalValue items',
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

        if (Array.isArray(responseData.items)) {
            responseData.items.forEach((it) => {
                if (!it.unit) {
                    const fgId = it.finishedGood?._id || it.finishedGood;
                    const soItem = responseData.salesOrder?.items?.find((si) => String(si.finishedGood?._id || si.finishedGood) === String(fgId));
                    it.unit = soItem?.unit || it.finishedGood?.uom?.symbol || it.finishedGood?.uom?.name || 'Pcs';
                }
            });
        }

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

/**
 * @desc    Get detailed line-item level Delivery/Dispatch Register
 * @route   GET /api/dispatches/delivery-register
 * @access  Private (SALES:READ / DISPATCH:READ permission)
 */
const getDeliveryRegister = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId)
            ? new mongoose.Types.ObjectId(tenantId)
            : tenantId;

        const { deliveryStatus, status, search, startDate, endDate } = req.query;
        const filter = { tenant: tenantObjId };

        const resolvedStatus = deliveryStatus || status;
        if (resolvedStatus && resolvedStatus !== 'All' && resolvedStatus !== 'All Statuses') {
            filter.deliveryStatus = resolvedStatus;
        }

        if (startDate || endDate) {
            filter.dispatchDate = {};
            if (startDate && startDate.trim()) {
                filter.dispatchDate.$gte = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
            }
            if (endDate && endDate.trim()) {
                filter.dispatchDate.$lte = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
            }
        }

        if (search) {
            filter.$or = [
                { dispatchNumber: { $regex: search, $options: 'i' } },
                { vehicleNumber: { $regex: search, $options: 'i' } },
                { transporter: { $regex: search, $options: 'i' } }
            ];
        }

        const dispatches = await Dispatch.find(filter)
            .populate({
                path: 'salesOrder',
                select: 'soNumber status customer totalValue orderDate deliveryDue items sourceEnquiry customerName',
                populate: [
                    {
                        path: 'customer',
                        select: 'companyName name code contactPerson phone address city state gstin'
                    },
                    {
                        path: 'sourceEnquiry',
                        select: 'customer customerRef newCustomerDetails nslNumber',
                        populate: { path: 'customer customerRef', select: 'companyName name code contactPerson phone address city state gstin' }
                    },
                    {
                        path: 'items.finishedGood',
                        select: 'uom',
                        populate: { path: 'uom', select: 'name symbol abbreviation' }
                    }
                ]
            })
            .populate({
                path: 'invoice',
                select: 'invoiceNumber customer walkInCustomer grandTotal paymentStatus paymentMode dueAmount invoiceDate items',
                populate: {
                    path: 'customer',
                    select: 'companyName name code contactPerson phone address city state gstin'
                }
            })
            .populate('dispatchLocation', 'name code type')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom bagShape dimensions dimensionUnit fabricGSM',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            })
            .populate('dispatchedBy', 'name email')
            .populate('pod.uploadedBy', 'name email')
            .populate('pod.approvedBy', 'name email')
            .sort({ dispatchDate: -1, createdAt: -1 })
            .lean();

        // Flatten to 1 row per Dispatch Line Item
        const lineItems = [];
        let lineItemIndex = 1;

        for (const d of dispatches) {
            const isPos = d.sourceType === 'POS_INVOICE' || Boolean(d.invoice && !d.salesOrder);
            const refNumber = isPos
                ? (d.invoice?.invoiceNumber || 'POS Invoice')
                : (d.salesOrder?.soNumber || '-');

            const orderDate = isPos
                ? (d.invoice?.invoiceDate || d.createdAt)
                : (d.salesOrder?.orderDate || d.createdAt);

            const deliveryDueDate = isPos
                ? (d.invoice?.invoiceDate || d.createdAt)
                : (d.salesOrder?.deliveryDue || null);

            const se = d.salesOrder?.sourceEnquiry;
            const seCust = se?.customer || se?.customerRef;

            const cust = isPos
                ? (d.invoice?.customer || d.invoice?.walkInCustomer || {})
                : (d.salesOrder?.customer || seCust || {});

            const customerName = isPos
                ? (d.invoice?.customer?.companyName || d.invoice?.customer?.name || d.invoice?.walkInCustomer?.name || 'Walk-in Retail Customer')
                : (d.salesOrder?.customer?.companyName || d.salesOrder?.customer?.name || seCust?.companyName || seCust?.name || se?.newCustomerDetails?.company || se?.newCustomerDetails?.name || d.salesOrder?.customerName || '-');

            const customerCode = cust.code || '-';
            const customerGstin = cust.gstin || '-';
            const customerPhone = cust.phone || d.invoice?.walkInCustomer?.phone || '-';
            const destinationCity = cust.city || '-';
            const destinationAddress = cust.address ? `${cust.address}${cust.city ? ', ' + cust.city : ''}${cust.state ? ', ' + cust.state : ''}` : (cust.city || '-');

            const sourceLocation = d.dispatchLocation?.name || 'Main Warehouse';
            const transporter = d.transporter || 'V-Trans India Ltd';
            const vehicleNumber = d.vehicleNumber || '-';
            const driverName = d.driverName || '-';
            const driverPhone = d.driverPhone || '-';
            const deliveryStatus = d.deliveryStatus || 'IN_TRANSIT';
            const podReceiverName = d.pod?.receiverName || '-';
            const podReceiverPhone = d.pod?.receiverPhone || '-';
            const podConfirmedDate = d.podConfirmedAt || d.pod?.approvedAt || null;
            const dispatchedBy = d.dispatchedBy?.name || 'Dispatch Manager';

            const items = Array.isArray(d.items) && d.items.length > 0
                ? d.items
                : [{ finishedGood: {}, dispatchedQuantity: 0, batchNumber: '' }];

            for (const item of items) {
                const fg = item.finishedGood || {};
                const fgName = fg.name || 'Finished Goods Bag';
                const fgCode = fg.code || '-';
                const fgUom = (fg.uom && typeof fg.uom === 'object' && (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation))
                    ? (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation)
                    : (typeof fg.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(fg.uom) ? fg.uom : null);

                let matchedSoItem = null;
                if (d.salesOrder && Array.isArray(d.salesOrder.items)) {
                    matchedSoItem = d.salesOrder.items.find(soIt =>
                        String(soIt.finishedGood?._id || soIt.finishedGood) === String(fg._id || item.finishedGood)
                    );
                }

                const uom = item.unit || matchedSoItem?.unit || fgUom || 'Pcs';
                const dispatchedQty = Number(item.dispatchedQuantity || 0);
                const batchNumber = item.batchNumber || '-';
                const bagShape = fg.bagShape || '-';
                const fabricGSM = fg.fabricGSM ? `${fg.fabricGSM} GSM` : '-';
                const size = fg.dimensions?.width && fg.dimensions?.length
                    ? `${fg.dimensions.width}x${fg.dimensions.length} ${fg.dimensionUnit || 'cm'}`
                    : '-';

                lineItems.push({
                    id: `${d._id}_${fgCode}_${lineItemIndex++}`,
                    dispatchId: d._id,
                    dispatchNumber: d.dispatchNumber,
                    dispatchDate: d.dispatchDate || d.createdAt,
                    deliveryDueDate,
                    orderDate,
                    sourceType: isPos ? 'POS Sale' : 'Sales Order',
                    referenceNumber: refNumber,
                    customerName,
                    customerCode,
                    customerGstin,
                    customerPhone,
                    destinationCity,
                    destinationAddress,
                    sourceLocation,
                    productName: fgName,
                    productCode: fgCode,
                    bagShape,
                    fabricGSM,
                    size,
                    batchNumber,
                    dispatchedQuantity: dispatchedQty,
                    unit: uom,
                    transporter,
                    vehicleNumber,
                    driverName,
                    driverPhone,
                    deliveryStatus,
                    podReceiverName,
                    podReceiverPhone,
                    podConfirmedDate,
                    dispatchedBy,
                    remarks: d.notes || '-'
                });
            }
        }

        return res.status(200).json({
            success: true,
            count: lineItems.length,
            totalDispatches: dispatches.length,
            data: lineItems
        });
    } catch (error) {
        console.error('Error in getDeliveryRegister:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Delivery Register.',
            error: error.message
        });
    }
};

module.exports = {
    getDispatchableSources,
    createDispatch,
    updateDispatch,
    updateDeliveryStatus,
    getDispatches,
    getDeliveryRegister,
    getDispatchById
};
