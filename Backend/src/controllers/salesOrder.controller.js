const mongoose = require('mongoose');
const SalesOrder = require('../models/salesOrder.model');
const Customer = require('../models/customer.model');
const Location = require('../models/location.model');
const FinishedGood = require('../models/finishedGood.model');
const OrderEnquiry = require('../models/orderEnquiry.model');
const WorkOrder = require('../models/workOrder.model');
const Dispatch = require('../models/dispatch.model');
const Invoice = require('../models/invoice.model');
const Notification = require('../models/notification.model');
const {
    validateSoStatusTransition,
    SO_DISPATCHED_STATUSES
} = require('../utils/salesOrderStatus');
const {
    getSoLineId,
    convertSoQtyToBags,
    doesWoMatchSoLine,
    notifyProductionOnSoConfirm
} = require('../services/soProduction.service');

/**
 * Helper function to auto-generate unique SO number per tenant & year
 */
const generateSoNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    const lastSo = await SalesOrder.findOne({
        tenant: tenantId,
        soNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ soNumber: -1 });

    let nextNumber = 1001; // Default starting sequence
    if (lastSo && lastSo.soNumber) {
        const parts = lastSo.soNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

const ALLOWED_GST_TREATMENTS = ['TAXABLE', 'EXEMPT'];

const computeSoGstTotals = (subtotal, rawTreatment) => {
    const treatment = rawTreatment ? String(rawTreatment).trim().toUpperCase() : 'TAXABLE';
    if (!ALLOWED_GST_TREATMENTS.includes(treatment)) {
        return { error: `Invalid gstTreatment '${rawTreatment}'. Allowed values: TAXABLE, EXEMPT.` };
    }
    const cleanSubtotal = Math.max(0, Number(subtotal || 0));
    if (treatment === 'EXEMPT') {
        return {
            gstTreatment: 'EXEMPT',
            gstRate: 0,
            gstAmount: 0,
            grandTotal: cleanSubtotal
        };
    }
    const gstRate = 18;
    const gstAmount = Math.round((cleanSubtotal * gstRate) / 100);
    return {
        gstTreatment: 'TAXABLE',
        gstRate,
        gstAmount,
        grandTotal: cleanSubtotal + gstAmount
    };
};

const getSoDependencies = async (salesOrderId, tenantId) => {
    const [linkedWOs, linkedDispatches, linkedInvoices] = await Promise.all([
        WorkOrder.find({
            tenant: tenantId,
            salesOrder: salesOrderId,
            status: { $ne: 'CANCELLED' },
            isActive: true
        }).select('workOrderNumber status completedQuantity targetQuantity').lean(),
        Dispatch.find({
            tenant: tenantId,
            salesOrder: salesOrderId,
            deliveryStatus: { $ne: 'CANCELLED' },
            status: { $ne: 'CANCELLED' },
            isActive: true
        }).select('dispatchNumber deliveryStatus').lean(),
        Invoice.find({
            tenant: tenantId,
            salesOrder: salesOrderId,
            isActive: true
        }).select('invoiceNumber paymentStatus grandTotal').lean()
    ]);

    const blockingWOs = linkedWOs.filter((w) => w.status === 'IN_PROGRESS' || w.status === 'COMPLETED' || Number(w.completedQuantity || 0) > 0);
    const plannedWOs = linkedWOs.filter((w) => !blockingWOs.includes(w));

    return {
        linkedWOs,
        blockingWOs,
        plannedWOs,
        linkedDispatches,
        linkedInvoices,
        hasLinkedWo: linkedWOs.length > 0,
        hasDispatch: linkedDispatches.length > 0,
        hasInvoice: linkedInvoices.length > 0
    };
};

const createSoModuleNotification = async ({ tenantId, module, title, message, link, referenceId }) => {
    try {
        await Notification.create({
            tenant: tenantId,
            module,
            title,
            message,
            link,
            referenceId,
            isRead: false
        });
    } catch (err) {
        console.error('Notification creation error (SO):', err.message);
    }
};

const applySoStatusTransition = async ({
    salesOrder,
    targetStatus,
    remark = '',
    cancelLinkedWorkOrders,
    user,
    tenantId,
    deps
}) => {
    const currStatus = salesOrder.status || 'DRAFT';
    const nextStatus = String(targetStatus || '').trim().toUpperCase();

    const validation = validateSoStatusTransition({
        currentStatus: currStatus,
        targetStatus: nextStatus,
        remark,
        hasLinkedWo: deps.hasLinkedWo,
        hasDispatch: deps.hasDispatch,
        hasInvoice: deps.hasInvoice
    });

    if (!validation.valid) {
        return { error: validation.error, statusCode: 400 };
    }
    if (validation.unchanged) {
        return { unchanged: true };
    }

    if (nextStatus === 'CANCELLED') {
        const blockers = [];
        if (deps.blockingWOs.length > 0) {
            blockers.push(`Active/Completed Work Orders: ${deps.blockingWOs.map((w) => w.workOrderNumber).join(', ')}`);
        }
        if (deps.linkedDispatches.length > 0) {
            blockers.push(`Dispatches: ${deps.linkedDispatches.map((d) => d.dispatchNumber).join(', ')}`);
        }
        if (deps.linkedInvoices.length > 0) {
            blockers.push(`Invoices: ${deps.linkedInvoices.map((i) => i.invoiceNumber).join(', ')}`);
        }
        if (blockers.length > 0) {
            return {
                statusCode: 400,
                error: `Cannot cancel ${salesOrder.soNumber} because linked records exist (${blockers.join('; ')}). Please cancel them first.`
            };
        }

        if (deps.plannedWOs.length > 0 && cancelLinkedWorkOrders === undefined) {
            return {
                statusCode: 409,
                requiresWoDecision: true,
                plannedWorkOrders: deps.plannedWOs.map((w) => ({ _id: w._id, workOrderNumber: w.workOrderNumber, status: w.status })),
                error: `Linked planned Work Orders exist (${deps.plannedWOs.map((w) => w.workOrderNumber).join(', ')}). Choose whether to cancel or release them.`
            };
        }

        if (deps.plannedWOs.length > 0) {
            const woIds = deps.plannedWOs.map((w) => w._id);
            if (cancelLinkedWorkOrders === true) {
                await WorkOrder.updateMany(
                    { _id: { $in: woIds }, tenant: tenantId },
                    {
                        $set: {
                            status: 'CANCELLED',
                            remarks: `[SO CANCELLED: ${salesOrder.soNumber}] Cancelled together with Sales Order (${String(remark).trim()})`
                        }
                    }
                );
            } else {
                await WorkOrder.updateMany(
                    { _id: { $in: woIds }, tenant: tenantId },
                    {
                        $set: {
                            salesOrder: null,
                            salesOrderLineId: null,
                            salesOrderNumber: '',
                            remarks: `[Released from cancelled SO ${salesOrder.soNumber}]`
                        }
                    }
                );
            }
        }

        salesOrder.cancelledAt = new Date();
        salesOrder.cancelledBy = user?._id || user?.id || null;
        salesOrder.cancellationReason = String(remark || '').trim();
        salesOrder.productionStatus = 'Not Planned';
        if (Array.isArray(salesOrder.items)) {
            salesOrder.items.forEach((it) => {
                it.plannedQuantity = 0;
            });
        }

        await OrderEnquiry.updateMany(
            {
                tenant: tenantId,
                $or: [
                    ...(salesOrder.sourceEnquiry ? [{ _id: salesOrder.sourceEnquiry }] : []),
                    { salesOrder: salesOrder._id },
                    { salesOrderNo: salesOrder.soNumber }
                ]
            },
            { $set: { orderConfirmed: false, status: 'Approved', salesOrder: null, salesOrderNo: '' } }
        );
    }

    salesOrder.status = nextStatus;
    salesOrder.statusHistory = Array.isArray(salesOrder.statusHistory) ? salesOrder.statusHistory : [];
    salesOrder.statusHistory.push({
        from: currStatus,
        to: nextStatus,
        changedBy: user?._id || user?.id || null,
        changedByName: user?.name || user?.email || '',
        changedAt: new Date(),
        remark: String(remark || '').trim()
    });

    return { changed: true, from: currStatus, to: nextStatus };
};

/**
 * @desc    Create a new Sales Order
 * @route   POST /api/sales-orders
 * @access  Private (SALES:CREATE permission)
 */
const createSalesOrder = async (req, res) => {
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
        delete req.body.soNumber;
        delete req.body.totalValue;
        delete req.body.gstAmount;
        delete req.body.grandTotal;
        delete req.body.gstRate;

        const {
            customer,
            orderDate,
            deliveryDue,
            items,
            dispatchLocation,
            notes,
            status,
            gstTreatment,
            exemptionReason
        } = req.body;

        // 1. Validation
        if (!customer || !deliveryDue || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer, deliveryDue date, and at least one item.'
            });
        }

        // 1b. Check if linked NSL exists, is Pending Approval, Rejected, or already Confirmed
        let linkedEnquiry = null;
        let cancelledSo = null;
        const linkedNslId = req.body.nslId || req.body.enquiryId;
        if (linkedNslId) {
            const isObjectId = mongoose.Types.ObjectId.isValid(linkedNslId);
            linkedEnquiry = await OrderEnquiry.findOne({
                tenant: tenantId,
                $or: [
                    ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(linkedNslId) }] : []),
                    { nslNumber: String(linkedNslId).trim() }
                ]
            });
            if (linkedEnquiry) {
                const isPending = linkedEnquiry.status === 'Pending Approval' || linkedEnquiry.soApprovalStatus === 'Pending Approval';
                const isRejected = linkedEnquiry.status === 'Rejected' || linkedEnquiry.soApprovalStatus === 'Rejected';
                if (isPending) {
                    return res.status(400).json({
                        success: false,
                        message: 'NSL is waiting for Tenant Admin approval'
                    });
                }
                if (isRejected) {
                    return res.status(400).json({
                        success: false,
                        message: 'NSL was rejected'
                    });
                }

                // Check if an active (non-cancelled) Sales Order already exists for this enquiry
                const existingActiveSo = await SalesOrder.findOne({
                    tenant: tenantId,
                    isActive: true,
                    status: { $ne: 'CANCELLED' },
                    $or: [
                        { sourceEnquiry: linkedEnquiry._id },
                        ...(linkedEnquiry.salesOrder ? [{ _id: linkedEnquiry.salesOrder }] : []),
                        ...(linkedEnquiry.nslNumber ? [{ notes: { $regex: linkedEnquiry.nslNumber } }] : [])
                    ]
                });
                if (existingActiveSo) {
                    return res.status(409).json({
                        success: false,
                        message: 'Sales Order already generated for this enquiry'
                    });
                }

                // Check if the enquiry had a previous cancelled SO (so generating again is allowed)
                cancelledSo = await SalesOrder.findOne({
                    tenant: tenantId,
                    status: 'CANCELLED',
                    $or: [
                        { sourceEnquiry: linkedEnquiry._id },
                        ...(linkedEnquiry.salesOrder ? [{ _id: linkedEnquiry.salesOrder }] : []),
                        ...(linkedEnquiry.nslNumber ? [{ notes: { $regex: linkedEnquiry.nslNumber } }] : [])
                    ]
                });

                if ((linkedEnquiry.status === 'Confirmed' || linkedEnquiry.orderConfirmed) && !cancelledSo) {
                    return res.status(409).json({
                        success: false,
                        message: 'Sales Order already generated for this enquiry'
                    });
                }
                // Legacy NSLs (no approval status field) and Approved NSLs are allowed to proceed
            }
        }

        // 2. Validate tenant-ownership of Customer
        const customerDoc = await Customer.findOne({ _id: customer, tenant: tenantId });
        if (!customerDoc) {
            return res.status(400).json({
                success: false,
                message: 'Customer does not exist or does not belong to your organization.'
            });
        }

        // TODO: Customer credit limit check can be added here in the future
        // if (customerDoc.creditLimit > 0 && customerDoc.outstandingAmount > customerDoc.creditLimit) { ... }

        if (dispatchLocation) {
            const locationDoc = await Location.findOne({ _id: dispatchLocation, tenant: tenantId });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Dispatch location does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Validate items array & check duplicate finishedGoods
        const finishedGoodIds = new Set();
        let computedTotalValue = 0;
        const cleanedItems = [];

        for (const item of items) {
            if (!item.finishedGood || !item.quantity || Number(item.quantity) <= 0 || item.ratePerUnit === undefined || Number(item.ratePerUnit) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each item must have a valid finishedGood, positive quantity (>0), and non-negative ratePerUnit.'
                });
            }

            const fgIdStr = String(item.finishedGood);
            if (finishedGoodIds.has(fgIdStr)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate finishedGood '${fgIdStr}' found in items array.`
                });
            }
            finishedGoodIds.add(fgIdStr);

            const qty = Number(item.quantity);
            const rate = Number(item.ratePerUnit);
            computedTotalValue += qty * rate;

            cleanedItems.push({
                finishedGood: item.finishedGood,
                quantity: qty,
                unit: item.unit || item.uom || '',
                dispatchedQuantity: 0, // Always 0 on creation
                ratePerUnit: rate
            });
        }

        // Batch verify Finished Goods exist and belong to tenant
        const foundFGs = await FinishedGood.find({
            _id: { $in: Array.from(finishedGoodIds) },
            tenant: tenantId
        }).populate('uom');

        if (foundFGs.length !== finishedGoodIds.size) {
            return res.status(400).json({
                success: false,
                message: 'One or more specified Finished Goods do not exist or do not belong to your organization.'
            });
        }

        for (const it of cleanedItems) {
            if (!it.unit) {
                const fgDoc = foundFGs.find(f => String(f._id) === String(it.finishedGood));
                const fgUom = (fgDoc?.uom && typeof fgDoc.uom === 'object') ? (fgDoc.uom.symbol || fgDoc.uom.name) : (fgDoc?.uom || 'Pcs');
                it.unit = fgUom || 'Pcs';
            }
        }

        let claimedEnquiryId = null;
        let prevEnquiryStatus = null;
        let prevEnquiryConfirmed = false;

        if (linkedEnquiry) {
            prevEnquiryStatus = linkedEnquiry.status;
            prevEnquiryConfirmed = linkedEnquiry.orderConfirmed;

            // Atomic conditional update to block race conditions (double clicks / parallel tabs)
            const claimed = await OrderEnquiry.findOneAndUpdate(
                {
                    _id: linkedEnquiry._id,
                    tenant: tenantId,
                    $or: [
                        { orderConfirmed: { $ne: true }, status: { $ne: 'Confirmed' } },
                        ...(cancelledSo ? [{ _id: linkedEnquiry._id }] : [])
                    ]
                },
                {
                    $set: {
                        status: 'Confirmed',
                        orderConfirmed: true
                    }
                },
                { new: true }
            );

            if (!claimed) {
                return res.status(409).json({
                    success: false,
                    message: 'Sales Order already generated for this enquiry'
                });
            }
            claimedEnquiryId = linkedEnquiry._id;
        }

        const soNumber = await generateSoNumber(tenantId);
        const initialStatus = (status === 'CONFIRMED') ? 'CONFIRMED' : 'DRAFT';

        const gstCalc = computeSoGstTotals(computedTotalValue, gstTreatment);
        if (gstCalc.error) {
            return res.status(400).json({ success: false, message: gstCalc.error });
        }

        const salesOrder = new SalesOrder({
            tenant: tenantId,
            soNumber,
            customer,
            orderDate: orderDate ? new Date(orderDate) : new Date(),
            deliveryDue: deliveryDue ? new Date(deliveryDue) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            items: cleanedItems,
            totalValue: computedTotalValue,
            gstTreatment: gstCalc.gstTreatment,
            exemptionReason: gstCalc.gstTreatment === 'EXEMPT' ? String(exemptionReason || '').trim() : '',
            gstRate: gstCalc.gstRate,
            gstAmount: gstCalc.gstAmount,
            grandTotal: gstCalc.grandTotal,
            status: initialStatus,
            statusHistory: [
                {
                    from: '',
                    to: initialStatus,
                    changedBy: req.user?._id || req.user?.id || null,
                    changedByName: req.user?.name || req.user?.email || '',
                    changedAt: new Date(),
                    remark: 'Order created'
                }
            ],
            dispatchLocation: dispatchLocation || null,
            notes,
            sourceEnquiry: linkedEnquiry ? linkedEnquiry._id : null,
            nslNumber: linkedEnquiry ? (linkedEnquiry.nslNumber || '') : '',
            isActive: true
        });

        await salesOrder.save();

        if (salesOrder.status === 'CONFIRMED') {
            await notifyProductionOnSoConfirm(salesOrder, tenantId);
        } else if (salesOrder.status === 'CANCELLED') {
            // Flag existing active linked Work Orders so shop floor knows SO was cancelled
            await WorkOrder.updateMany(
                {
                    tenant: tenantId,
                    salesOrder: salesOrder._id,
                    status: { $ne: 'CANCELLED' },
                    isActive: true
                },
                {
                    $set: {
                        remarks: `[SO CANCELLED: ${salesOrder.soNumber}] Sales Order was cancelled`
                    }
                }
            );
        }

        if (linkedEnquiry) {
            await OrderEnquiry.findByIdAndUpdate(linkedEnquiry._id, {
                status: 'Confirmed',
                orderConfirmed: true,
                salesOrder: salesOrder._id,
                salesOrderNo: salesOrder.soNumber
            });
        }

        if (salesOrder.status === 'CONFIRMED') {
            await notifyProductionOnSoConfirm(salesOrder, tenantId);
        }

        await salesOrder.populate([
            { path: 'customer', select: 'companyName code contactPerson phone' },
            { path: 'dispatchLocation', select: 'name code type' },
            { path: 'items.finishedGood', select: 'name code uom currentStock' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Sales Order '${soNumber}' created successfully.`,
            data: salesOrder
        });
    } catch (error) {
        console.error('Error in createSalesOrder:', error);

        if (claimedEnquiryId) {
            await OrderEnquiry.updateOne(
                { _id: claimedEnquiryId, salesOrder: null },
                { $set: { status: prevEnquiryStatus, orderConfirmed: prevEnquiryConfirmed } }
            ).catch(() => {});
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create Sales Order.'
        });
    }
};

/**
 * @desc    Get all Sales Orders scoped to user's tenant
 * @route   GET /api/sales-orders
 * @access  Private (SALES:READ permission)
 */
const getSalesOrders = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, productionStatus, customer, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status) {
            filter.status = status;
        }

        if (productionStatus && productionStatus !== 'All' && productionStatus !== 'All Statuses') {
            if (productionStatus === 'Not Planned') {
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { productionStatus: 'Not Planned' },
                        { productionStatus: { $exists: false } },
                        { productionStatus: null }
                    ]
                });
            } else {
                filter.productionStatus = productionStatus;
            }
        }

        if (customer) {
            filter.customer = customer;
        }

        if (search) {
            filter.soNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [salesOrders, total] = await Promise.all([
            SalesOrder.find(filter)
                .populate('customer', 'companyName name code contactPerson phone city state address gstin')
                .populate('dispatchLocation', 'name code type')
                .populate({
                    path: 'items.finishedGood',
                    select: 'name code uom currentStock pricePerBag title productName bagName specification dimensions dimensionUnit fabricGSM',
                    populate: { path: 'uom', select: 'name symbol abbreviation' }
                })
                .populate({
                    path: 'items.product',
                    select: 'title productName name bagName specification',
                    strictPopulate: false
                })
                .populate({
                    path: 'sourceEnquiry',
                    select: 'customer customerRef newCustomerDetails nslNumber',
                    populate: { path: 'customer customerRef', select: 'companyName name code contactPerson phone city state address gstin' }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            SalesOrder.countDocuments(filter)
        ]);

        // Find any unpopulated customer references to guarantee real customer names
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

        const enrichedSalesOrders = salesOrders.map((so) => {
            const soObj = so.toObject ? so.toObject() : so;
            const cId = String(soObj.customer?._id || soObj.customer || '');
            const fallbackCust = fallbackCustomerMap.get(cId);
            const se = soObj.sourceEnquiry;
            const seCust = se?.customer || se?.customerRef;
            const resolvedCust = (soObj.customer && typeof soObj.customer === 'object' && (soObj.customer.companyName || soObj.customer.name))
                ? soObj.customer
                : (fallbackCust || seCust || null);

            const resolvedCustName =
                resolvedCust?.companyName ||
                resolvedCust?.name ||
                se?.newCustomerDetails?.company ||
                se?.newCustomerDetails?.name ||
                soObj.customerName ||
                '-';

            soObj.customerName = resolvedCustName;
            if (!soObj.customer || typeof soObj.customer !== 'object') {
                soObj.customer = resolvedCust || { companyName: resolvedCustName, name: resolvedCustName };
            } else if (!soObj.customer.companyName) {
                soObj.customer.companyName = resolvedCustName;
            }

            if (Array.isArray(soObj.items)) {
                soObj.items.forEach((it) => {
                    if (!it.unit && it.finishedGood) {
                        const fg = it.finishedGood;
                        it.unit = (fg.uom && typeof fg.uom === 'object')
                            ? (fg.uom.symbol || fg.uom.name)
                            : (fg.uom || 'Pcs');
                    }
                });
            }

            const readGstCalc = computeSoGstTotals(soObj.totalValue || 0, soObj.gstTreatment || 'TAXABLE');
            soObj.gstTreatment = readGstCalc.gstTreatment;
            soObj.exemptionReason = soObj.gstTreatment === 'EXEMPT' ? (soObj.exemptionReason || '') : '';
            soObj.gstRate = soObj.gstTreatment === 'EXEMPT' ? 0 : (soObj.gstRate ?? readGstCalc.gstRate);
            soObj.gstAmount = soObj.gstTreatment === 'EXEMPT' ? 0 : (soObj.gstAmount ?? readGstCalc.gstAmount);
            soObj.grandTotal = soObj.gstTreatment === 'EXEMPT' ? (soObj.totalValue || 0) : (soObj.grandTotal ?? readGstCalc.grandTotal);
            return soObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedSalesOrders.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: enrichedSalesOrders
        });
    } catch (error) {
        console.error('Error in getSalesOrders:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Sales Orders.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Sales Order by ID scoped to user's tenant
 * @route   GET /api/sales-orders/:id
 * @access  Private (SALES:READ permission)
 */
const getSalesOrderById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const salesOrder = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName name code contactPerson phone email address city gstin creditLimit')
            .populate('cancelledBy', 'name email')
            .populate({
                path: 'sourceEnquiry',
                select: 'customer customerRef newCustomerDetails nslNumber',
                populate: { path: 'customer customerRef', select: 'companyName name code contactPerson phone email address city gstin creditLimit' }
            })
            .populate('dispatchLocation', 'name code type')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock pricePerBag title productName bagName specification dimensions dimensionUnit fabricGSM',
                populate: { path: 'uom', select: 'name symbol abbreviation' }
            })
            .populate({
                path: 'items.product',
                select: 'title productName name bagName specification',
                strictPopulate: false
            });

        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found.'
            });
        }

        const responseData = salesOrder.toObject ? salesOrder.toObject() : salesOrder;

        let resolvedCust = (responseData.customer && typeof responseData.customer === 'object' && (responseData.customer.companyName || responseData.customer.name))
            ? responseData.customer
            : null;

        if (!resolvedCust) {
            const cId = responseData.customer?._id || responseData.customer;
            if (cId && mongoose.isValidObjectId(cId)) {
                resolvedCust = await Customer.findById(cId).select('companyName name code contactPerson phone email address city gstin creditLimit').lean();
            }
        }

        const se = responseData.sourceEnquiry;
        const seCust = se?.customer || se?.customerRef;
        const finalCust = resolvedCust || seCust;
        const resolvedCustName =
            finalCust?.companyName ||
            finalCust?.name ||
            se?.newCustomerDetails?.company ||
            se?.newCustomerDetails?.name ||
            responseData.customerName ||
            '-';

        responseData.customerName = resolvedCustName;
        if (!responseData.customer || typeof responseData.customer !== 'object') {
            responseData.customer = finalCust || { companyName: resolvedCustName, name: resolvedCustName };
        } else if (!responseData.customer.companyName) {
            responseData.customer.companyName = resolvedCustName;
        }
        if (Array.isArray(responseData.items)) {
            responseData.items.forEach((it) => {
                if (!it.unit && it.finishedGood) {
                    const fg = it.finishedGood;
                    it.unit = (fg.uom && typeof fg.uom === 'object')
                        ? (fg.uom.symbol || fg.uom.name)
                        : (fg.uom || 'Pcs');
                }
            });
        }

        // Attach Production Plan (line-by-line ordered/planned/remaining & linked Work Orders)
        const linkedWOs = await WorkOrder.find({
            tenant: tenantId,
            salesOrder: responseData._id,
            status: { $ne: 'CANCELLED' },
            isActive: true
        })
            .select('workOrderNumber salesOrderLineId finishedGood targetQuantity completedQuantity status createdAt')
            .sort({ createdAt: -1 })
            .lean();

        responseData.productionStatus = responseData.productionStatus || 'Not Planned';
        responseData.productionPlan = (responseData.items || []).map((item, idx) => {
            const lineId = getSoLineId(item, idx);
            const lineWOs = linkedWOs.filter((wo) => doesWoMatchSoLine(wo, item, idx));
            const plannedQuantity = lineWOs.reduce((sum, w) => sum + Number(w.targetQuantity || 0), 0);
            const orderedQuantity = Number(item.quantity || 0);
            const unit = item.unit || 'Pcs';
            const conv = convertSoQtyToBags(orderedQuantity, unit, item.finishedGood);
            const orderedBags = conv.hasConversion && conv.convertedBags !== null ? conv.convertedBags : orderedQuantity;
            const remainingQuantity = Math.max(0, Number((orderedBags - plannedQuantity).toFixed(3)));

            return {
                lineId,
                lineIndex: idx + 1,
                finishedGood: item.finishedGood,
                orderedQuantity,
                unit,
                convertedOrderedBags: orderedBags,
                hasUnitConversion: conv.hasConversion,
                conversionNote: conv.conversionNote,
                plannedQuantity,
                remainingQuantity,
                linkedWorkOrders: lineWOs.map((w) => ({
                    _id: w._id,
                    workOrderNumber: w.workOrderNumber,
                    targetQuantity: w.targetQuantity,
                    completedQuantity: w.completedQuantity || 0,
                    status: w.status
                }))
            };
        });

        const deps = await getSoDependencies(responseData._id, tenantId);
        responseData.dependencies = {
            hasLinkedWo: deps.hasLinkedWo,
            hasDispatch: deps.hasDispatch,
            hasInvoice: deps.hasInvoice,
            workOrdersCount: deps.linkedWOs.length,
            dispatchesCount: deps.linkedDispatches.length,
            invoicesCount: deps.linkedInvoices.length,
            plannedWorkOrders: deps.plannedWOs.map((w) => ({ _id: w._id, workOrderNumber: w.workOrderNumber, status: w.status }))
        };

        return res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error in getSalesOrderById:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Sales Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Sales Order (Allowed ONLY when status === 'DRAFT' or 'CONFIRMED')
 * @route   PUT /api/sales-orders/:id
 * @access  Private (SALES:UPDATE permission)
 */
const updateSalesOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const salesOrder = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found.'
            });
        }

        if (salesOrder.status === 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: 'Cancelled Sales Orders are read-only and cannot be edited.'
            });
        }

        const deps = await getSoDependencies(salesOrder._id, tenantId);
        const isDispatchedState = SO_DISPATCHED_STATUSES.includes(salesOrder.status);
        const isLockedByDeps = deps.hasLinkedWo || deps.hasDispatch || deps.hasInvoice;

        delete req.body.tenant;
        delete req.body.soNumber;
        delete req.body.totalValue;
        delete req.body.gstAmount;
        delete req.body.grandTotal;
        delete req.body.gstRate;

        const {
            customer,
            orderDate,
            deliveryDue,
            items,
            dispatchLocation,
            notes,
            gstTreatment,
            exemptionReason,
            status: requestedStatus,
            statusRemark,
            cancellationReason,
            cancelLinkedWorkOrders
        } = req.body;

        if (isDispatchedState) {
            // Only allow notes update or DISPATCHED -> DELIVERED transition
            if (notes !== undefined) salesOrder.notes = notes;
            if (requestedStatus && requestedStatus !== salesOrder.status) {
                const tr = await applySoStatusTransition({
                    salesOrder,
                    targetStatus: requestedStatus,
                    remark: statusRemark || cancellationReason || '',
                    cancelLinkedWorkOrders,
                    user: req.user,
                    tenantId,
                    deps
                });
                if (tr.error) {
                    return res.status(tr.statusCode || 400).json({
                        success: false,
                        message: tr.error,
                        ...(tr.requiresWoDecision ? { requiresWoDecision: true, plannedWorkOrders: tr.plannedWorkOrders } : {})
                    });
                }
            }
            await salesOrder.save();
            await salesOrder.populate([
                { path: 'customer', select: 'companyName code contactPerson phone' },
                { path: 'dispatchLocation', select: 'name code type' },
                { path: 'items.finishedGood', select: 'name code uom currentStock' }
            ]);
            return res.status(200).json({
                success: true,
                message: 'Sales Order updated successfully.',
                data: salesOrder
            });
        }

        if (customer && String(customer) !== String(salesOrder.customer)) {
            if (isLockedByDeps) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer cannot be changed once Work Orders, Dispatches, or Invoices exist for this Sales Order.'
                });
            }
            const customerDoc = await Customer.findOne({ _id: customer, tenant: tenantId });
            if (!customerDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer does not exist or does not belong to your organization.'
                });
            }
            salesOrder.customer = customer;
        }

        if (dispatchLocation !== undefined) {
            if (dispatchLocation) {
                const locationDoc = await Location.findOne({ _id: dispatchLocation, tenant: tenantId });
                if (!locationDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Dispatch location does not exist or does not belong to your organization.'
                    });
                }
                salesOrder.dispatchLocation = dispatchLocation;
            } else {
                salesOrder.dispatchLocation = null;
            }
        }

        if (orderDate && !isLockedByDeps) salesOrder.orderDate = orderDate;
        if (deliveryDue) salesOrder.deliveryDue = deliveryDue;
        if (notes !== undefined) salesOrder.notes = notes;

        if (items !== undefined) {
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'items must be a non-empty array.'
                });
            }

            if (isLockedByDeps) {
                if (items.length !== salesOrder.items.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'Products cannot be added or removed once Work Orders, Dispatches, or Invoices exist.'
                    });
                }
                for (let idx = 0; idx < items.length; idx++) {
                    const inc = items[idx];
                    const existing = salesOrder.items.find((i) => String(i.finishedGood) === String(inc.finishedGood));
                    if (!existing) {
                        return res.status(400).json({
                            success: false,
                            message: 'Products cannot be changed once Work Orders, Dispatches, or Invoices exist.'
                        });
                    }
                    if (inc.unit && existing.unit && String(inc.unit).toLowerCase() !== String(existing.unit).toLowerCase()) {
                        return res.status(400).json({
                            success: false,
                            message: `Unit for product cannot be changed from '${existing.unit}' once Work Orders, Dispatches, or Invoices exist.`
                        });
                    }
                    if (Number(inc.quantity) < Number(existing.quantity)) {
                        return res.status(400).json({
                            success: false,
                            message: `Quantity cannot be reduced below ${existing.quantity} ${existing.unit || 'Pcs'} once Work Orders, Dispatches, or Invoices exist.`
                        });
                    }
                }
            }

            const finishedGoodIds = new Set();
            let computedTotalValue = 0;
            const cleanedItems = [];

            for (const item of items) {
                if (!item.finishedGood || !item.quantity || Number(item.quantity) <= 0 || item.ratePerUnit === undefined || Number(item.ratePerUnit) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each item must have a valid finishedGood, positive quantity (>0), and non-negative ratePerUnit.'
                    });
                }

                const fgIdStr = String(item.finishedGood);
                if (finishedGoodIds.has(fgIdStr)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate finishedGood '${fgIdStr}' found in items array.`
                    });
                }
                finishedGoodIds.add(fgIdStr);

                const qty = Number(item.quantity);
                const rate = Number(item.ratePerUnit);
                computedTotalValue += qty * rate;

                // Preserve existing dispatchedQuantity if item matches
                const existingItem = salesOrder.items.find(i => String(i.finishedGood) === fgIdStr);
                const existingDispatched = existingItem ? existingItem.dispatchedQuantity : 0;

                cleanedItems.push({
                    finishedGood: item.finishedGood,
                    quantity: qty,
                    unit: item.unit || item.uom || existingItem?.unit || '',
                    dispatchedQuantity: existingDispatched,
                    ratePerUnit: rate
                });
            }

            const foundFGs = await FinishedGood.find({
                _id: { $in: Array.from(finishedGoodIds) },
                tenant: tenantId
            }).populate('uom');

            if (foundFGs.length !== finishedGoodIds.size) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more specified Finished Goods do not exist or do not belong to your organization.'
                });
            }

            for (const it of cleanedItems) {
                if (!it.unit) {
                    const fgDoc = foundFGs.find(f => String(f._id) === String(it.finishedGood));
                    const fgUom = (fgDoc?.uom && typeof fgDoc.uom === 'object') ? (fgDoc.uom.symbol || fgDoc.uom.name) : (fgDoc?.uom || 'Pcs');
                    it.unit = fgUom || 'Pcs';
                }
            }

            salesOrder.items = cleanedItems;
            salesOrder.totalValue = computedTotalValue;
        }

        const effectiveTreatment = gstTreatment !== undefined ? gstTreatment : (salesOrder.gstTreatment || 'TAXABLE');
        const gstCalc = computeSoGstTotals(salesOrder.totalValue || 0, effectiveTreatment);
        if (gstCalc.error) {
            return res.status(400).json({ success: false, message: gstCalc.error });
        }
        salesOrder.gstTreatment = gstCalc.gstTreatment;
        salesOrder.gstRate = gstCalc.gstRate;
        salesOrder.gstAmount = gstCalc.gstAmount;
        salesOrder.grandTotal = gstCalc.grandTotal;
        if (gstCalc.gstTreatment === 'EXEMPT') {
            if (exemptionReason !== undefined) {
                salesOrder.exemptionReason = String(exemptionReason || '').trim();
            }
        } else {
            salesOrder.exemptionReason = '';
        }

        let transitionResult = null;
        if (requestedStatus && String(requestedStatus).trim().toUpperCase() !== salesOrder.status) {
            transitionResult = await applySoStatusTransition({
                salesOrder,
                targetStatus: requestedStatus,
                remark: statusRemark || cancellationReason || '',
                cancelLinkedWorkOrders,
                user: req.user,
                tenantId,
                deps
            });
            if (transitionResult.error) {
                return res.status(transitionResult.statusCode || 400).json({
                    success: false,
                    message: transitionResult.error,
                    ...(transitionResult.requiresWoDecision
                        ? { requiresWoDecision: true, plannedWorkOrders: transitionResult.plannedWorkOrders }
                        : {})
                });
            }
        }

        await salesOrder.save();

        if (transitionResult?.changed) {
            if (salesOrder.status === 'CONFIRMED') {
                await notifyProductionOnSoConfirm(salesOrder, tenantId);
            } else if (salesOrder.status === 'READY_FOR_DISPATCH') {
                await createSoModuleNotification({
                    tenantId,
                    module: 'DISPATCH',
                    title: 'Sales Order Ready for Dispatch',
                    message: `Sales Order ${salesOrder.soNumber} is marked Ready for Dispatch.`,
                    link: '/dispatch',
                    referenceId: salesOrder._id
                });
            } else if (salesOrder.status === 'CANCELLED') {
                await createSoModuleNotification({
                    tenantId,
                    module: 'PRODUCTION',
                    title: 'Sales Order Cancelled',
                    message: `Sales Order ${salesOrder.soNumber} was cancelled. Reason: ${salesOrder.cancellationReason || 'N/A'}`,
                    link: '/production?tab=work-orders',
                    referenceId: salesOrder._id
                });
            }
        }

        await salesOrder.populate([
            { path: 'customer', select: 'companyName code contactPerson phone' },
            { path: 'dispatchLocation', select: 'name code type' },
            { path: 'items.finishedGood', select: 'name code uom currentStock' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Sales Order updated successfully.',
            data: salesOrder
        });
    } catch (error) {
        console.error('Error in updateSalesOrder:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update Sales Order.'
        });
    }
};

/**
 * @desc    Update Sales Order Status (DRAFT -> CONFIRMED -> READY_FOR_DISPATCH, or CANCELLED)
 * @route   PATCH /api/sales-orders/:id/status
 * @access  Private (SALES:UPDATE permission)
 */
const updateStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, remark, cancellationReason, cancelLinkedWorkOrders } = req.body;
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Please provide status in request body.'
            });
        }

        const salesOrder = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found.'
            });
        }

        const deps = await getSoDependencies(salesOrder._id, tenantId);
        const tr = await applySoStatusTransition({
            salesOrder,
            targetStatus: status,
            remark: remark || cancellationReason || '',
            cancelLinkedWorkOrders,
            user: req.user,
            tenantId,
            deps
        });

        if (tr.error) {
            return res.status(tr.statusCode || 400).json({
                success: false,
                message: tr.error,
                ...(tr.requiresWoDecision
                    ? { requiresWoDecision: true, plannedWorkOrders: tr.plannedWorkOrders }
                    : {})
            });
        }

        await salesOrder.save();

        if (tr.changed) {
            if (salesOrder.status === 'CONFIRMED') {
                await notifyProductionOnSoConfirm(salesOrder, tenantId);
            } else if (salesOrder.status === 'READY_FOR_DISPATCH') {
                await createSoModuleNotification({
                    tenantId,
                    module: 'DISPATCH',
                    title: 'Sales Order Ready for Dispatch',
                    message: `Sales Order ${salesOrder.soNumber} is marked Ready for Dispatch.`,
                    link: '/dispatch',
                    referenceId: salesOrder._id
                });
            } else if (salesOrder.status === 'CANCELLED') {
                await createSoModuleNotification({
                    tenantId,
                    module: 'PRODUCTION',
                    title: 'Sales Order Cancelled',
                    message: `Sales Order ${salesOrder.soNumber} was cancelled. Reason: ${salesOrder.cancellationReason || 'N/A'}`,
                    link: '/production?tab=work-orders',
                    referenceId: salesOrder._id
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Sales Order status updated to '${salesOrder.status}'.`,
            data: salesOrder
        });
    } catch (error) {
        console.error('Error in updateStatus:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update Sales Order status.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Sales Order (Allowed ONLY if status === 'DRAFT' or 'CANCELLED')
 * @route   DELETE /api/sales-orders/:id
 * @access  Private (SALES:DELETE permission)
 */
const deleteSalesOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const salesOrder = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found.'
            });
        }

        if (salesOrder.status !== 'DRAFT' && salesOrder.status !== 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: `Cannot delete Sales Order with status '${salesOrder.status}'. Only DRAFT or CANCELLED sales orders can be deleted.`
            });
        }

        salesOrder.isActive = false;
        await salesOrder.save();

        if (salesOrder.status === 'CONFIRMED') {
            await notifyProductionOnSoConfirm(salesOrder, tenantId);
        } else if (salesOrder.status === 'CANCELLED') {
            // Flag existing active linked Work Orders so shop floor knows SO was cancelled
            await WorkOrder.updateMany(
                {
                    tenant: tenantId,
                    salesOrder: salesOrder._id,
                    status: { $ne: 'CANCELLED' },
                    isActive: true
                },
                {
                    $set: {
                        remarks: `[SO CANCELLED: ${salesOrder.soNumber}] Sales Order was cancelled`
                    }
                }
            );
        }

        if (salesOrder.status === 'CANCELLED' || salesOrder.status === 'DRAFT') {
            await OrderEnquiry.updateMany(
                {
                    tenant: tenantId,
                    $or: [
                        ...(salesOrder.sourceEnquiry ? [{ _id: salesOrder.sourceEnquiry }] : []),
                        { salesOrder: salesOrder._id },
                        { salesOrderNo: salesOrder.soNumber }
                    ]
                },
                { $set: { orderConfirmed: false, status: 'Approved', salesOrder: null, salesOrderNo: '' } }
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Sales Order deactivated successfully.',
            data: salesOrder
        });
    } catch (error) {
        console.error('Error in deleteSalesOrder:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to delete Sales Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Get the last agreed rate for a customer + finishedGood
 * @route   GET /api/sales-orders/last-rate
 * @access  Private (SALES:READ permission)
 */
const getLastCustomerRate = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context missing.' });
        }
        const { customerId, finishedGoodId } = req.query;
        if (!customerId || !finishedGoodId) {
            return res.status(200).json({ success: true, data: null });
        }

        const lastSo = await SalesOrder.findOne({
            tenant: tenantId,
            customer: customerId,
            status: { $ne: 'CANCELLED' },
            'items.finishedGood': finishedGoodId,
            isActive: true
        })
            .sort({ orderDate: -1, createdAt: -1 })
            .select('soNumber orderDate items')
            .lean();

        if (!lastSo) {
            return res.status(200).json({ success: true, data: null });
        }

        const matchedItem = (lastSo.items || []).find((i) => String(i.finishedGood) === String(finishedGoodId));
        if (!matchedItem) {
            return res.status(200).json({ success: true, data: null });
        }

        return res.status(200).json({
            success: true,
            data: {
                ratePerUnit: Number(matchedItem.ratePerUnit || 0),
                unit: matchedItem.unit || 'Pcs',
                soNumber: lastSo.soNumber,
                orderDate: lastSo.orderDate
            }
        });
    } catch (error) {
        console.error('Error in getLastCustomerRate:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch last customer rate.' });
    }
};

module.exports = {
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    updateSalesOrder,
    updateStatus,
    deleteSalesOrder,
    getLastCustomerRate
};
