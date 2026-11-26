const PurchaseOrder = require('../models/purchaseOrder.model');
const Supplier = require('../models/supplier.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const PartyAdvance = require('../models/partyAdvance.model');
const { createPoApprovalNotification, resolvePoApprovalNotification } = require('../services/notification.service');
const { createPoApprovalRequest } = require('../services/approval.service');
const { isTenantAdmin } = require('../middlewares/rbac.middleware');
const { computeDocumentTotals } = require('../utils/gstHelper');
const { computeOverdueInfo, computePoPayableValues } = require('../utils/overdueHelper');

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
 * Helper function to auto-generate unique PO number per tenant & year
 */
const generatePoNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    const lastPo = await PurchaseOrder.findOne({
        tenant: tenantId,
        poNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ poNumber: -1 });

    let nextNumber = 1001; // Default starting sequence
    if (lastPo && lastPo.poNumber) {
        const parts = lastPo.poNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Create a new Purchase Order
 * @route   POST /api/purchase-orders
 * @access  Private (PROCUREMENT:CREATE permission)
 */
const createPurchaseOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Strip auto-generated / read-only fields
        delete req.body.tenant;
        delete req.body.poNumber;
        delete req.body.totalValue;

        const {
            supplier,
            poDate,
            expectedDelivery,
            items,
            deliveryLocation,
            notes,
            status,
            discountType,
            discountValue,
            freightAmount,
            insuranceAmount,
            otherChargesAmount,
            otherChargesLabel,
            gstTreatment,
            gstRate,
            autoRoundOff
        } = req.body;

        // 1. Validation
        if (!supplier || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide supplier and at least one item.'
            });
        }

        // 2. Validate tenant-ownership of Supplier
        const supplierDoc = await Supplier.findOne({ _id: supplier, tenant: tenantId });
        if (!supplierDoc) {
            return res.status(400).json({
                success: false,
                message: 'Supplier does not exist or does not belong to your organization.'
            });
        }

        if (deliveryLocation) {
            const locationDoc = await Location.findOne({ _id: deliveryLocation, tenant: tenantId });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Delivery location does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Validate items array & check duplicate rawMaterials
        const rawMaterialIds = new Set();
        let computedTotalValue = 0;
        const cleanedItems = [];

        for (const item of items) {
            if (!item.rawMaterial || !item.orderedQuantity || Number(item.orderedQuantity) <= 0 || item.ratePerUnit === undefined || Number(item.ratePerUnit) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each item must have a valid rawMaterial, positive orderedQuantity (>0), and non-negative ratePerUnit.'
                });
            }

            const rmIdStr = String(item.rawMaterial);
            if (rawMaterialIds.has(rmIdStr)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate rawMaterial '${rmIdStr}' found in items array.`
                });
            }
            rawMaterialIds.add(rmIdStr);

            const qty = Number(item.orderedQuantity);
            const rate = Number(item.ratePerUnit);
            computedTotalValue += qty * rate;

            cleanedItems.push({
                rawMaterial: item.rawMaterial,
                orderedQuantity: qty,
                unit: item.unit || 'Kg',
                receivedQuantity: 0, // Always 0 on creation
                ratePerUnit: rate
            });
        }

        // Batch verify raw materials exist and belong to tenant
        const foundRMs = await RawMaterial.find({
            _id: { $in: Array.from(rawMaterialIds) },
            tenant: tenantId
        });

        if (foundRMs.length !== rawMaterialIds.size) {
            return res.status(400).json({
                success: false,
                message: 'One or more specified Raw Materials do not exist or do not belong to your organization.'
            });
        }

        const poNumber = await generatePoNumber(tenantId);
        if (status === 'SENT_TO_SUPPLIER') {
            return res.status(400).json({
                success: false,
                message: 'Direct creation as SENT_TO_SUPPLIER is not allowed. Purchase Orders must be approved by Tenant Admin through the central Approvals module.'
            });
        }
        const initialStatus = (status === 'DRAFT') ? 'DRAFT' : 'PENDING_APPROVAL';

        const totalsCalc = computeDocumentTotals({
            itemsSubtotal: computedTotalValue,
            discountType,
            discountValue,
            freightAmount,
            insuranceAmount,
            otherChargesAmount,
            otherChargesLabel,
            gstTreatment: gstTreatment || 'TAXABLE',
            gstRate: gstRate !== undefined ? gstRate : 18,
            autoRoundOff
        });
        if (totalsCalc.error) {
            return res.status(400).json({ success: false, message: totalsCalc.error });
        }

        const purchaseOrder = new PurchaseOrder({
            tenant: tenantId,
            poNumber,
            supplier,
            poDate: poDate ? new Date(poDate) : new Date(),
            expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            items: cleanedItems,
            itemsSubtotal: totalsCalc.itemsSubtotal,
            discountType: totalsCalc.discountType,
            discountValue: totalsCalc.discountValue,
            discountAmount: totalsCalc.discountAmount,
            freightAmount: totalsCalc.freightAmount,
            insuranceAmount: totalsCalc.insuranceAmount,
            otherChargesAmount: totalsCalc.otherChargesAmount,
            otherChargesLabel: totalsCalc.otherChargesLabel,
            taxableValue: totalsCalc.taxableValue,
            gstTreatment: totalsCalc.gstTreatment,
            gstRate: totalsCalc.gstRate,
            gstAmount: totalsCalc.gstAmount,
            taxAmount: totalsCalc.taxAmount,
            autoRoundOff: totalsCalc.autoRoundOff,
            roundOff: totalsCalc.roundOff,
            grandTotal: totalsCalc.grandTotal,
            totalValue: totalsCalc.grandTotal,
            paidAmount: 0,
            balanceAmount: totalsCalc.grandTotal,
            dueDate: req.body.dueDate || (expectedDelivery ? new Date(expectedDelivery) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            paymentStatus: 'UNPAID',
            payments: [],
            status: initialStatus,
            deliveryLocation: deliveryLocation || null,
            notes,
            isActive: true,
            createdBy: req.user?._id
        });

        await purchaseOrder.save();

        if (purchaseOrder.status === 'PENDING_APPROVAL') {
            await createPoApprovalRequest(purchaseOrder, req.user);
        }

        await purchaseOrder.populate([
            { path: 'supplier', select: 'name contactPerson phone' },
            { path: 'deliveryLocation', select: 'name code type' },
            { path: 'items.rawMaterial', select: 'name code uom' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Purchase Order '${poNumber}' created successfully.`,
            data: purchaseOrder
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createPurchaseOrder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Purchase Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Purchase Orders scoped to user's tenant
 * @route   GET /api/purchase-orders
 * @access  Private (PROCUREMENT:READ permission)
 */
const getPurchaseOrders = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, supplier, search, startDate, endDate, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status) {
            filter.status = status;
        }

        if (req.query.paymentStatus) {
            const ps = req.query.paymentStatus;
            if (ps === 'OUTSTANDING' || ps === 'UNPAID') {
                filter.paymentStatus = { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] };
            } else {
                filter.paymentStatus = ps;
            }
        }

        if (supplier) {
            filter.supplier = supplier;
        }

        if (search) {
            filter.poNumber = { $regex: search, $options: 'i' };
        }

        if (startDate || endDate) {
            filter.poDate = {};
            if (startDate && startDate.trim()) {
                filter.poDate.$gte = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
            }
            if (endDate && endDate.trim()) {
                filter.poDate.$lte = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [purchaseOrders, total] = await Promise.all([
            PurchaseOrder.find(filter)
                .populate('supplier', 'name code contactPerson phone email address city gstin paymentTerms advanceBalance')
                .populate('deliveryLocation', 'name code type')
                .populate({
                    path: 'items.rawMaterial',
                    select: 'name code uom materialGrade materialQualityFabric materialQualityBags fabricGrammage fabricAverage fabricSize hsnCode'
                })
                .sort({ poDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            PurchaseOrder.countDocuments(filter)
        ]);

        const now = new Date();
        const enrichedPOs = purchaseOrders.map((po) => {
            const poObj = po.toObject ? po.toObject() : { ...po };
            const payable = computePoPayableValues(poObj);
            const payableBase = Math.max(Number(poObj.grandTotal || poObj.totalValue || poObj.totalAmount || 0), payable.receivedValue);
            const totalPaid = Math.min(payableBase, Number(poObj.paidAmount || poObj.amountPaid || 0));
            const balanceDue = Math.max(0, Number((payableBase - totalPaid).toFixed(2)));
            const overdue = computeOverdueInfo({
                totalAmount: payableBase,
                paidAmount: totalPaid,
                docDate: poObj.poDate || poObj.createdAt,
                docDueDate: poObj.dueDate || null,
                paymentTerms: poObj.supplier?.paymentTerms,
                now
            });

            let computedPaymentStatus = overdue.paymentStatus;
            if (payableBase > 0) {
                if (balanceDue <= 0.01) {
                    computedPaymentStatus = 'PAID';
                } else if (overdue.isOverdue) {
                    computedPaymentStatus = 'OVERDUE';
                } else if (totalPaid > 0) {
                    computedPaymentStatus = 'PARTIALLY_PAID';
                } else {
                    computedPaymentStatus = 'UNPAID';
                }
            }

            poObj.poValue = payable.poValue;
            poObj.receivedValue = payable.receivedValue;
            poObj.payableBalance = payable.payableBalance;
            poObj.paidAmount = totalPaid;
            poObj.balanceAmount = balanceDue;
            poObj.balanceDue = balanceDue;
            poObj.effectiveDueDate = overdue.effectiveDueDate;
            poObj.dueDate = overdue.effectiveDueDate;
            poObj.isOverdue = balanceDue > 0.01 ? overdue.isOverdue : false;
            poObj.daysOverdue = balanceDue > 0.01 ? overdue.daysOverdue : 0;
            poObj.paymentStatus = computedPaymentStatus;

            return poObj;
        });

        return res.status(200).json({
            success: true,
            count: enrichedPOs.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: enrichedPOs
        });
    } catch (error) {
        console.error('Error in getPurchaseOrders:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Purchase Orders.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Purchase Order by ID scoped to user's tenant
 * @route   GET /api/purchase-orders/:id
 * @access  Private (PROCUREMENT:READ permission)
 */
const getPurchaseOrderById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('supplier', 'name contactPerson phone email address city gstin')
            .populate('deliveryLocation', 'name code type')
            .populate({
                path: 'items.rawMaterial',
                select: 'name code uom',
                populate: { path: 'uom', select: 'name symbol' }
            });

        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found.'
            });
        }

        // Fetch date-wise receipt history (all GRNs created against this PO)
        const GRN = require('../models/grn.model');
        const grns = await GRN.find({ purchaseOrder: purchaseOrder._id, tenant: tenantId })
            .populate({
                path: 'items.rawMaterial',
                select: 'name code uom',
                populate: { path: 'uom', select: 'name symbol' }
            })
            .populate('receivingLocation', 'name code type')
            .populate('receivedBy', 'name email')
            .sort({ receivedDate: 1, createdAt: 1 })
            .lean();

        const poObj = purchaseOrder.toObject ? purchaseOrder.toObject() : { ...purchaseOrder };
        poObj.receiptHistory = grns || [];

        return res.status(200).json({
            success: true,
            data: poObj
        });
    } catch (error) {
        console.error('Error in getPurchaseOrderById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Purchase Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Purchase Order (Allowed ONLY when status === 'DRAFT')
 * @route   PUT /api/purchase-orders/:id
 * @access  Private (PROCUREMENT:UPDATE permission)
 */
const updatePurchaseOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant || req.tenantId;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found.'
            });
        }

        // Prevent editing if any items have already been received, or if CANCELLED
        const hasReceivedQty = Array.isArray(purchaseOrder.items) && purchaseOrder.items.some((it) => Number(it.receivedQuantity || 0) > 0);
        if (hasReceivedQty || ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'].includes(purchaseOrder.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot edit Purchase Order with status '${purchaseOrder.status}' or with received items. Please use GRN to adjust receipts.`
            });
        }

        // Restrict PENDING_APPROVAL and SENT_TO_SUPPLIER PO editing to Tenant Admin
        if (['PENDING_APPROVAL', 'SENT_TO_SUPPLIER'].includes(purchaseOrder.status)) {
            if (!isTenantAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    message: 'Only Tenant Admins can edit Purchase Orders that are Pending Approval or Sent to Supplier.'
                });
            }
        } else if (purchaseOrder.status !== 'DRAFT') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit Purchase Order with status '${purchaseOrder.status}'.`
            });
        }

        delete req.body.tenant;
        delete req.body.poNumber;
        delete req.body.totalValue;

        const {
            supplier,
            poDate,
            expectedDelivery,
            items,
            deliveryLocation,
            notes,
            status,
            discountType,
            discountValue,
            freightAmount,
            insuranceAmount,
            otherChargesAmount,
            otherChargesLabel,
            gstTreatment,
            gstRate,
            autoRoundOff
        } = req.body;

        if (supplier) {
            const supplierDoc = await Supplier.findOne({ _id: supplier, tenant: tenantId });
            if (!supplierDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Supplier does not exist or does not belong to your organization.'
                });
            }
            purchaseOrder.supplier = supplier;
        }

        if (deliveryLocation !== undefined) {
            if (deliveryLocation) {
                const locationDoc = await Location.findOne({ _id: deliveryLocation, tenant: tenantId });
                if (!locationDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Delivery location does not exist or does not belong to your organization.'
                    });
                }
                purchaseOrder.deliveryLocation = deliveryLocation;
            } else {
                purchaseOrder.deliveryLocation = null;
            }
        }

        if (poDate) purchaseOrder.poDate = poDate;
        if (expectedDelivery) purchaseOrder.expectedDelivery = expectedDelivery;
        if (notes !== undefined) purchaseOrder.notes = notes;
        if (status) {
            if (status === 'SENT_TO_SUPPLIER' && purchaseOrder.status !== 'SENT_TO_SUPPLIER') {
                return res.status(400).json({
                    success: false,
                    message: 'Direct transition to SENT_TO_SUPPLIER is not allowed. Purchase Orders must be approved by Tenant Admin through the central Approvals module.'
                });
            }
            const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'];
            if (validStatuses.includes(status)) {
                const oldStatus = purchaseOrder.status;
                purchaseOrder.status = status;
                if (status === 'PENDING_APPROVAL' && oldStatus === 'DRAFT') {
                    await createPoApprovalRequest(purchaseOrder, req.user);
                }
            }
        }

        if (items !== undefined) {
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'items must be a non-empty array.'
                });
            }

            const rawMaterialIds = new Set();
            let computedTotalValue = 0;
            const cleanedItems = [];

            for (const item of items) {
                if (!item.rawMaterial || !item.orderedQuantity || Number(item.orderedQuantity) <= 0 || item.ratePerUnit === undefined || Number(item.ratePerUnit) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each item must have a valid rawMaterial, positive orderedQuantity (>0), and non-negative ratePerUnit.'
                    });
                }

                const rmIdStr = String(item.rawMaterial);
                if (rawMaterialIds.has(rmIdStr)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate rawMaterial '${rmIdStr}' found in items array.`
                    });
                }
                rawMaterialIds.add(rmIdStr);

                const qty = Number(item.orderedQuantity);
                const rate = Number(item.ratePerUnit);
                computedTotalValue += qty * rate;

                cleanedItems.push({
                    rawMaterial: item.rawMaterial,
                    orderedQuantity: qty,
                    unit: item.unit || 'Kg',
                    receivedQuantity: 0,
                    ratePerUnit: rate
                });
            }

            const foundRMs = await RawMaterial.find({
                _id: { $in: Array.from(rawMaterialIds) },
                tenant: tenantId
            });

            if (foundRMs.length !== rawMaterialIds.size) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more specified Raw Materials do not exist or do not belong to your organization.'
                });
            }

            purchaseOrder.items = cleanedItems;
            purchaseOrder.itemsSubtotal = computedTotalValue;
        }

        const existingItemsSubtotal = (purchaseOrder.items || []).reduce((s, it) => s + (Number(it.orderedQuantity || 0) * Number(it.ratePerUnit || 0)), 0);
        const totalsCalc = computeDocumentTotals({
            itemsSubtotal: purchaseOrder.itemsSubtotal > 0 ? purchaseOrder.itemsSubtotal : existingItemsSubtotal,
            discountType: discountType !== undefined ? discountType : (purchaseOrder.discountType || 'FIXED'),
            discountValue: discountValue !== undefined ? discountValue : (purchaseOrder.discountValue || 0),
            freightAmount: freightAmount !== undefined ? freightAmount : (purchaseOrder.freightAmount || 0),
            insuranceAmount: insuranceAmount !== undefined ? insuranceAmount : (purchaseOrder.insuranceAmount || 0),
            otherChargesAmount: otherChargesAmount !== undefined ? otherChargesAmount : (purchaseOrder.otherChargesAmount || 0),
            otherChargesLabel: otherChargesLabel !== undefined ? otherChargesLabel : (purchaseOrder.otherChargesLabel || ''),
            gstTreatment: gstTreatment !== undefined ? gstTreatment : (purchaseOrder.gstTreatment || 'TAXABLE'),
            gstRate: gstRate !== undefined ? gstRate : (purchaseOrder.gstRate ?? 18),
            autoRoundOff: autoRoundOff !== undefined ? autoRoundOff : (purchaseOrder.autoRoundOff !== false)
        });
        if (totalsCalc.error) {
            return res.status(400).json({ success: false, message: totalsCalc.error });
        }
        purchaseOrder.itemsSubtotal = totalsCalc.itemsSubtotal;
        purchaseOrder.discountType = totalsCalc.discountType;
        purchaseOrder.discountValue = totalsCalc.discountValue;
        purchaseOrder.discountAmount = totalsCalc.discountAmount;
        purchaseOrder.freightAmount = totalsCalc.freightAmount;
        purchaseOrder.insuranceAmount = totalsCalc.insuranceAmount;
        purchaseOrder.otherChargesAmount = totalsCalc.otherChargesAmount;
        purchaseOrder.otherChargesLabel = totalsCalc.otherChargesLabel;
        purchaseOrder.taxableValue = totalsCalc.taxableValue;
        purchaseOrder.gstTreatment = totalsCalc.gstTreatment;
        purchaseOrder.gstRate = totalsCalc.gstRate;
        purchaseOrder.gstAmount = totalsCalc.gstAmount;
        purchaseOrder.taxAmount = totalsCalc.taxAmount;
        purchaseOrder.autoRoundOff = totalsCalc.autoRoundOff;
        purchaseOrder.roundOff = totalsCalc.roundOff;
        purchaseOrder.grandTotal = totalsCalc.grandTotal;
        purchaseOrder.totalValue = totalsCalc.grandTotal;
        purchaseOrder.balanceAmount = Math.max(0, totalsCalc.grandTotal - Number(purchaseOrder.paidAmount || 0));

        await purchaseOrder.save();

        // If PO is PENDING_APPROVAL, ensure linked Approval record reflects updated summary and value
        if (purchaseOrder.status === 'PENDING_APPROVAL') {
            try {
                const Approval = require('../models/approval.model');
                const supplierDoc = await Supplier.findById(purchaseOrder.supplier).lean();
                const supplierName = supplierDoc?.companyName || supplierDoc?.name || 'Supplier';
                const formattedTotal = Number(purchaseOrder.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
                const summary = `${supplierName} | ₹${formattedTotal}`;

                await Approval.updateOne(
                    {
                        tenant: tenantId,
                        type: 'PO',
                        referenceId: purchaseOrder._id,
                        status: 'Pending'
                    },
                    {
                        $set: {
                            summary,
                            title: `PO Approval: ${purchaseOrder.poNumber}`,
                            referenceNo: purchaseOrder.poNumber
                        }
                    }
                );
            } catch (apprErr) {
                console.warn('[updatePurchaseOrder] Approval sync note:', apprErr.message);
            }
        }

        await purchaseOrder.populate([
            { path: 'supplier', select: 'name contactPerson phone' },
            { path: 'deliveryLocation', select: 'name code type' },
            { path: 'items.rawMaterial', select: 'name code uom' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Purchase Order updated successfully.',
            data: purchaseOrder
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updatePurchaseOrder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Purchase Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Purchase Order Status (DRAFT -> SENT_TO_SUPPLIER, or CANCELLED)
 * @route   PATCH /api/purchase-orders/:id/status
 * @access  Private (PROCUREMENT:UPDATE permission)
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

        const { status } = req.body;
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Please provide status in request body.'
            });
        }

        const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found.'
            });
        }

        if (status === 'PARTIALLY_RECEIVED' || status === 'FULLY_RECEIVED') {
            return res.status(400).json({
                success: false,
                message: `Status '${status}' cannot be set manually. It is automatically set when receiving goods via GRN.`
            });
        }

        if (purchaseOrder.status === 'PENDING_APPROVAL' && status !== 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: 'This Purchase Order is Pending Approval. Please approve or reject it through the central Approvals module.'
            });
        }

        if (status === 'CANCELLED') {
            if (purchaseOrder.status === 'FULLY_RECEIVED' || purchaseOrder.status === 'PARTIALLY_RECEIVED') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot cancel a Purchase Order that is already ${purchaseOrder.status}.`
                });
            }
            purchaseOrder.status = 'CANCELLED';
        } else if (status === 'PENDING_APPROVAL') {
            if (purchaseOrder.status !== 'DRAFT') {
                return res.status(400).json({
                    success: false,
                    message: `Can only submit for approval from DRAFT status. Current status is ${purchaseOrder.status}.`
                });
            }
            purchaseOrder.status = 'PENDING_APPROVAL';
        } else if (status === 'SENT_TO_SUPPLIER') {
            return res.status(400).json({
                success: false,
                message: 'Direct transition to SENT_TO_SUPPLIER is not allowed. Purchase Orders must be approved by Tenant Admin through the central Approvals module.'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition to '${status}'.`
            });
        }

        await purchaseOrder.save();

        if (purchaseOrder.status === 'PENDING_APPROVAL') {
            await createPoApprovalRequest(purchaseOrder, req.user);
        }

        if (status === 'SENT_TO_SUPPLIER' || status === 'CANCELLED') {
            await resolvePoApprovalNotification(purchaseOrder._id, tenantId);
        }

        return res.status(200).json({
            success: true,
            message: `Purchase Order status updated to '${purchaseOrder.status}'.`,
            data: purchaseOrder
        });
    } catch (error) {
        console.error('Error in updateStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Purchase Order status.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Purchase Order (Allowed ONLY if status === 'DRAFT' or 'CANCELLED')
 * @route   DELETE /api/purchase-orders/:id
 * @access  Private (PROCUREMENT:DELETE permission)
 */
const deletePurchaseOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found.'
            });
        }

        if (purchaseOrder.status !== 'DRAFT' && purchaseOrder.status !== 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: `Cannot delete Purchase Order with status '${purchaseOrder.status}'. Only DRAFT or CANCELLED purchase orders can be deleted.`
            });
        }

        purchaseOrder.isActive = false;
        await purchaseOrder.save();

        return res.status(200).json({
            success: true,
            message: 'Purchase Order deactivated successfully.',
            data: purchaseOrder
        });
    } catch (error) {
        console.error('Error in deletePurchaseOrder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Purchase Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Get detailed line-item level Purchase Register with linked GRN inward receipts
 * @route   GET /api/purchase-orders/purchase-register
 * @access  Private (PROCUREMENT:READ permission)
 */
const getPurchaseRegister = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, supplier, search, startDate, endDate } = req.query;
        const filter = { tenant: tenantId };

        if (status && status !== 'All' && status !== 'All Statuses') {
            filter.status = status;
        }

        if (supplier) {
            filter.supplier = supplier;
        }

        if (search) {
            filter.poNumber = { $regex: search, $options: 'i' };
        }

        if (startDate || endDate) {
            filter.poDate = {};
            if (startDate && startDate.trim()) {
                filter.poDate.$gte = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
            }
            if (endDate && endDate.trim()) {
                filter.poDate.$lte = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
            }
        }

        const GRN = require('../models/grn.model');

        // Fetch all matching POs with populated supplier, deliveryLocation, and rawMaterials
        const [purchaseOrders, allGrns] = await Promise.all([
            PurchaseOrder.find(filter)
                .populate('supplier', 'name code contactPerson phone email address city state gstin paymentTerms')
                .populate('deliveryLocation', 'name code type')
                .populate({
                    path: 'items.rawMaterial',
                    select: 'name code uom materialGrade materialQualityFabric materialQualityBags fabricGrammage fabricAverage fabricSize hsnCode'
                })
                .sort({ poDate: -1, createdAt: -1 })
                .lean(),
            GRN.find({ tenant: tenantId })
                .select('grnNumber purchaseOrder receivedDate items notes')
                .sort({ receivedDate: -1 })
                .lean()
        ]);

        // Map GRNs by PO ID
        const poGrnMap = new Map();
        (allGrns || []).forEach((g) => {
            if (!g || !g.purchaseOrder) return;
            const poId = String(g.purchaseOrder);
            if (!poGrnMap.has(poId)) poGrnMap.set(poId, []);
            poGrnMap.get(poId).push(g);
        });

        // Flatten to 1 row per Purchase Line Item
        const lineItems = [];
        let lineItemIndex = 1;

        for (const po of (purchaseOrders || [])) {
            const poIdStr = String(po?._id || '');
            const linkedGrns = poGrnMap.get(poIdStr) || [];
            const grnNumbers = linkedGrns.map((g) => g?.grnNumber).filter(Boolean).join(', ');
            const latestGrnDate = linkedGrns[0]?.receivedDate || null;

            const supp = po?.supplier || {};
            const suppName = supp?.name || supp?.companyName || 'Unknown Supplier';
            const suppCode = supp?.code || 'N/A';
            const suppGstin = supp?.gstin || 'N/A';
            const suppCity = supp?.city || 'N/A';
            const suppState = supp?.state || 'N/A';
            const paymentTerms = supp?.paymentTerms || 'N/A';
            const deliveryLocation = po?.deliveryLocation?.name || 'N/A';

            const items = Array.isArray(po?.items) ? po.items : [];

            for (const item of items) {
                const rm = item?.rawMaterial || {};
                const matName = rm?.name || 'Raw Material';
                const matCode = rm?.code || 'N/A';
                const rawUom = item?.unit || (typeof rm?.uom === 'object' ? rm?.uom?.name : rm?.uom);
                const uom = (typeof rawUom === 'string' && !/^[0-9a-fA-F]{24}$/.test(rawUom.trim())) ? rawUom : 'Kg';
                const orderedQty = Number(item?.orderedQuantity || 0);
                const receivedQty = Number(item?.receivedQuantity || 0);
                const pendingQty = Math.max(0, orderedQty - receivedQty);
                const rate = Number(item?.ratePerUnit || 0);
                const taxableValue = Number((orderedQty * rate).toFixed(2));
                const receivedTaxableValue = Number((receivedQty * rate).toFixed(2));

                // GST breakdown (Standard 18% for industrial polymer fabric & masterbatch)
                const gstRate = 18;
                const gstAmount = Number(((taxableValue * gstRate) / 100).toFixed(2));
                const totalValueWithTax = Number((taxableValue + gstAmount).toFixed(2));

                lineItems.push({
                    id: `${po?._id || 'po'}_${matCode}_${lineItemIndex++}`,
                    poId: po?._id,
                    poNumber: po?.poNumber || 'N/A',
                    poDate: po?.poDate || po?.createdAt || null,
                    expectedDelivery: po?.expectedDelivery || null,
                    actualReceivedDate: latestGrnDate,
                    status: po?.status || 'N/A',
                    supplierName: suppName,
                    supplierCode: suppCode,
                    supplierGstin: suppGstin,
                    supplierCity: suppCity,
                    supplierState: suppState,
                    paymentTerms,
                    deliveryLocation,
                    materialName: matName,
                    materialCode: matCode,
                    materialGrade: rm?.materialGrade || 'N/A',
                    qualitySpec: rm?.materialQualityFabric || rm?.materialQualityBags || 'N/A',
                    grammage: rm?.fabricGrammage ? `${rm.fabricGrammage} GSM` : 'N/A',
                    sizeSpec: rm?.fabricSize || 'N/A',
                    hsnCode: rm?.hsnCode || '39012000',
                    orderedQuantity: orderedQty,
                    receivedQuantity: receivedQty,
                    pendingQuantity: pendingQty,
                    unit: uom,
                    ratePerUnit: rate,
                    taxableValue,
                    receivedTaxableValue,
                    gstRate,
                    gstAmount,
                    totalValueWithTax,
                    poTotalValue: po?.totalValue || 0,
                    linkedGrns: grnNumbers || 'N/A',
                    remarks: po?.notes || po?.approvalRemarks || 'N/A'
                });
            }
        }

        return res.status(200).json({
            success: true,
            count: lineItems.length,
            totalPOs: (purchaseOrders || []).length,
            data: lineItems
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const exportPurchaseRegisterCsv = getPurchaseRegister;

/**
 * @desc    Record payment against a Purchase Order
 * @route   PATCH /api/purchase-orders/:id/payment
 * @access  Private (PROCUREMENT:UPDATE permission)
 */
const recordPoPayment = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const rawAmt = req.body.amount !== undefined ? req.body.amount : (req.body.paymentAmount !== undefined ? req.body.paymentAmount : req.body.paidAmount);
        const numAmount = Number(rawAmt || 0);
        const applyAdvanceReq = Math.max(0, Number(req.body.applyAdvanceAmount || 0));

        if ((isNaN(numAmount) || numAmount <= 0) && applyAdvanceReq <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid payment amount or advance amount greater than 0.' });
        }

        const po = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId }).populate('supplier', 'name paymentTerms advanceBalance');
        if (!po) {
            return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
        }

        const poStatusUpper = String(po.status || '').trim().toUpperCase().replace(/\s+/g, '_');
        if (['PENDING_APPROVAL', 'DRAFT', 'REJECTED', 'CANCELLED'].includes(poStatusUpper)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot record payment for an unapproved Purchase Order. Please approve the PO first.'
            });
        }

        const totalValue = Number(po.grandTotal ?? po.totalValue ?? po.totalAmount ?? 0);
        const currentPaid = Number(po.paidAmount || 0);
        let remainingBalance = Math.max(0, Math.round((totalValue - currentPaid) * 100) / 100);

        if (remainingBalance <= 0.0001 && applyAdvanceReq > 0) {
            return res.status(400).json({ success: false, message: 'Purchase Order is already fully paid.' });
        }

        const payDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
        const payRef = String(req.body.reference || '').trim();
        const payNotes = String(req.body.notes || '').trim();
        if (!Array.isArray(po.payments)) po.payments = [];

        let appliedFromAdvance = 0;
        const supplierDoc = po.supplier?._id ? await Supplier.findOne({ _id: po.supplier._id, tenant: tenantId }) : null;

        if (applyAdvanceReq > 0) {
            if (!supplierDoc) {
                return res.status(400).json({ success: false, message: 'Supplier record not found for advance adjustment.' });
            }
            const availableAdv = Number(supplierDoc.advanceBalance || 0);
            if (applyAdvanceReq > availableAdv + 0.001) {
                return res.status(400).json({ success: false, message: `Requested advance (₹${applyAdvanceReq}) exceeds available supplier advance (₹${availableAdv.toFixed(2)}).` });
            }
            appliedFromAdvance = Math.min(applyAdvanceReq, remainingBalance);
            if (appliedFromAdvance > 0) {
                supplierDoc.advanceBalance = Math.max(0, Math.round((availableAdv - appliedFromAdvance) * 100) / 100);
                remainingBalance = Math.max(0, Math.round((remainingBalance - appliedFromAdvance) * 100) / 100);
                const adjPaymentId = `SUPP-ADJ-${Date.now()}`;
                po.payments.push({
                    amount: appliedFromAdvance,
                    paymentDate: payDate,
                    paymentMode: 'ADVANCE_ADJUSTMENT',
                    reference: payRef || adjPaymentId,
                    notes: payNotes || 'Adjusted from Supplier Advance',
                    recordedBy: req.user?._id || req.user?.id || null,
                    recordedAt: new Date()
                });
                await PartyAdvance.create({
                    tenant: tenantId,
                    partyType: 'SUPPLIER',
                    partyId: supplierDoc._id,
                    entryType: 'ADJUSTMENT',
                    amount: appliedFromAdvance,
                    date: payDate,
                    paymentMode: 'ADVANCE_ADJUSTMENT',
                    reference: payRef || adjPaymentId,
                    notes: payNotes || `Applied to PO ${po.poNumber}`,
                    paymentId: adjPaymentId,
                    documentModel: 'PurchaseOrder',
                    documentId: po._id,
                    documentNumber: po.poNumber,
                    recordedBy: req.user?._id || req.user?.id || null
                });
            }
        }

        let appliedCashToDoc = 0;
        let excessToAdvance = 0;
        if (numAmount > 0) {
            appliedCashToDoc = Math.min(numAmount, remainingBalance);
            excessToAdvance = Math.max(0, Math.round((numAmount - appliedCashToDoc) * 100) / 100);

            if (appliedCashToDoc > 0) {
                po.payments.push({
                    amount: appliedCashToDoc,
                    paymentDate: payDate,
                    paymentMode: req.body.paymentMode || 'UPI',
                    reference: payRef,
                    notes: payNotes,
                    recordedBy: req.user?._id || req.user?.id || null,
                    recordedAt: new Date()
                });
            }

            if (excessToAdvance > 0 && supplierDoc) {
                supplierDoc.advanceBalance = Math.round((Number(supplierDoc.advanceBalance || 0) + excessToAdvance) * 100) / 100;
                const advPayId = `SUPP-CR-${Date.now()}`;
                await PartyAdvance.create({
                    tenant: tenantId,
                    partyType: 'SUPPLIER',
                    partyId: supplierDoc._id,
                    entryType: 'CREDIT',
                    amount: excessToAdvance,
                    date: payDate,
                    paymentMode: req.body.paymentMode || 'UPI',
                    reference: payRef || advPayId,
                    notes: payNotes || `Excess payment from PO ${po.poNumber}`,
                    paymentId: advPayId,
                    documentModel: 'PurchaseOrder',
                    documentId: po._id,
                    documentNumber: po.poNumber,
                    recordedBy: req.user?._id || req.user?.id || null
                });
            }
        }

        if (supplierDoc) {
            await supplierDoc.save();
        }

        const totalApplied = Math.round((appliedFromAdvance + appliedCashToDoc) * 100) / 100;
        po.paidAmount = Math.min(totalValue, Math.round((currentPaid + totalApplied) * 100) / 100);
        po.balanceAmount = Math.max(0, Number((totalValue - po.paidAmount).toFixed(2)));

        const overdue = computeOverdueInfo({
            totalAmount: totalValue,
            paidAmount: po.paidAmount,
            docDate: po.poDate || po.createdAt,
            docDueDate: po.dueDate || null,
            paymentTerms: supplierDoc?.paymentTerms || po.supplier?.paymentTerms
        });
        if (totalValue > 0 && po.balanceAmount <= 0.01) {
            po.paymentStatus = 'PAID';
        } else if (overdue.isOverdue) {
            po.paymentStatus = 'OVERDUE';
        } else if (po.paidAmount > 0) {
            po.paymentStatus = 'PARTIALLY_PAID';
        } else {
            po.paymentStatus = 'UNPAID';
        }

        await po.save();

        await po.populate([
            { path: 'supplier', select: 'name code contactPerson phone email paymentTerms advanceBalance' },
            { path: 'deliveryLocation', select: 'name code' }
        ]);

        return res.status(200).json({
            success: true,
            message: excessToAdvance > 0
                ? `Applied ₹${appliedCashToDoc.toLocaleString('en-IN')} to ${po.poNumber} and saved ₹${excessToAdvance.toLocaleString('en-IN')} as Supplier Advance.`
                : `Payment recorded successfully. Remaining balance: ₹${po.balanceAmount.toFixed(2)}.`,
            appliedAmount: totalApplied,
            appliedFromAdvance,
            excessToAdvance,
            data: po
        });
    } catch (error) {
        console.error('Error in recordPoPayment:', error);
        return res.status(500).json({ success: false, message: 'Failed to record payment on Purchase Order.', error: error.message });
    }
};

/**
 * @desc    Get Accounts Payable Summary (Total payable, overdue, supplier count)
 * @route   GET /api/purchase-orders/payables-summary
 * @access  Private (PROCUREMENT:READ permission)
 */
const getPayablesSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const [pos, suppliersWithAdv] = await Promise.all([
            PurchaseOrder.find({
                tenant: tenantId,
                isActive: true,
                status: { $nin: ['CANCELLED', 'REJECTED'] }
            })
                .populate('supplier', 'paymentTerms advanceBalance')
                .select('status items totalValue grandTotal paidAmount balanceAmount dueDate poDate createdAt paymentStatus supplier')
                .lean(),
            Supplier.find({ tenant: tenantId, isActive: true, advanceBalance: { $gt: 0 } })
                .select('advanceBalance')
                .lean()
        ]);

        let totalPayable = 0;
        let overdueAmount = 0;
        const suppliersWithDues = new Set();
        const now = new Date();

        pos.forEach((po) => {
            const payable = computePoPayableValues(po);
            const overdue = computeOverdueInfo({
                totalAmount: payable.receivedValue,
                paidAmount: payable.paidAmount,
                docDate: po.poDate || po.createdAt,
                docDueDate: po.dueDate || null,
                paymentTerms: po.supplier?.paymentTerms,
                now
            });

            if (payable.payableBalance > 0.0001) {
                totalPayable += payable.payableBalance;
                if (po.supplier) {
                    suppliersWithDues.add(String(po.supplier._id || po.supplier));
                }
                if (overdue.isOverdue) {
                    overdueAmount += payable.payableBalance;
                }
            }
        });

        const totalAdvance = suppliersWithAdv.reduce((s, sup) => s + Number(sup.advanceBalance || 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                totalPayable: Math.round(totalPayable * 100) / 100,
                overduePayable: Math.round(overdueAmount * 100) / 100,
                overdueAmount: Math.round(overdueAmount * 100) / 100,
                totalAdvance: Math.round(totalAdvance * 100) / 100,
                suppliersWithDues: suppliersWithDues.size
            }
        });
    } catch (error) {
        console.error('Error in getPayablesSummary:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch payables summary.', error: error.message });
    }
};

/**
 * @desc    Get Supplier-Wise Outstanding Accounts Payable
 * @route   GET /api/purchase-orders/supplier-outstanding
 * @access  Private (PROCUREMENT:READ permission)
 */
const getSupplierOutstanding = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const [pos, advanceSuppliers] = await Promise.all([
            PurchaseOrder.find({
                tenant: tenantId,
                isActive: true,
                status: { $nin: ['CANCELLED', 'REJECTED'] }
            })
                .populate('supplier', 'name code contactPerson phone email paymentTerms advanceBalance')
                .sort({ poDate: -1, createdAt: -1 })
                .lean(),
            Supplier.find({ tenant: tenantId, isActive: true, advanceBalance: { $gt: 0 } })
                .select('name code contactPerson phone email paymentTerms advanceBalance')
                .lean()
        ]);

        const supplierMap = {};
        const now = new Date();

        const ensureSuppEntry = (suppId, suppObj) => {
            if (!supplierMap[suppId]) {
                supplierMap[suppId] = {
                    supplierId: suppObj?._id || suppId,
                    supplierName: suppObj?.name || suppObj?.companyName || 'Unknown Supplier',
                    supplierCode: suppObj?.code || '-',
                    phone: suppObj?.phone || '-',
                    paymentTerms: suppObj?.paymentTerms || '',
                    advanceBalance: Number(suppObj?.advanceBalance || 0),
                    totalPurchased: 0,
                    totalReceived: 0,
                    totalPaid: 0,
                    balance: 0,
                    overdueAmount: 0,
                    poCount: 0,
                    unpaidPoCount: 0
                };
            }
        };

        advanceSuppliers.forEach((s) => ensureSuppEntry(String(s._id), s));

        pos.forEach((po) => {
            const suppId = po.supplier ? String(po.supplier._id || po.supplier) : 'Unknown';
            ensureSuppEntry(suppId, po.supplier);

            const payable = computePoPayableValues(po);
            const overdue = computeOverdueInfo({
                totalAmount: payable.receivedValue,
                paidAmount: payable.paidAmount,
                docDate: po.poDate || po.createdAt,
                docDueDate: po.dueDate || null,
                paymentTerms: po.supplier?.paymentTerms,
                now
            });

            supplierMap[suppId].totalPurchased += payable.poValue;
            supplierMap[suppId].totalReceived += payable.receivedValue;
            supplierMap[suppId].totalPaid += payable.paidAmount;
            supplierMap[suppId].balance += payable.payableBalance;
            supplierMap[suppId].poCount += 1;

            if (payable.payableBalance > 0.0001) {
                supplierMap[suppId].unpaidPoCount += 1;
                if (overdue.isOverdue) {
                    supplierMap[suppId].overdueAmount += payable.payableBalance;
                }
            }
        });

        let list = Object.values(supplierMap).map((s) => ({
            ...s,
            advanceBalance: Math.round(s.advanceBalance * 100) / 100,
            totalPurchased: Math.round(s.totalPurchased * 100) / 100,
            totalReceived: Math.round(s.totalReceived * 100) / 100,
            totalPaid: Math.round(s.totalPaid * 100) / 100,
            balance: Math.round(s.balance * 100) / 100,
            overdueAmount: Math.round(s.overdueAmount * 100) / 100
        })).sort((a, b) => (b.balance - a.balance) || (b.advanceBalance - a.advanceBalance));

        const searchQ = (req.query.search || '').trim().toLowerCase();
        if (searchQ) {
            list = list.filter((item) =>
                (item.supplierName && item.supplierName.toLowerCase().includes(searchQ)) ||
                (item.supplierCode && item.supplierCode.toLowerCase().includes(searchQ)) ||
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
        console.error('Error in getSupplierOutstanding:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch supplier outstanding.', error: error.message });
    }
};

/**
 * @desc    Record an Advance Payment to a Supplier (without a specific PO)
 * @route   POST /api/purchase-orders/supplier-advance
 * @access  Private (PROCUREMENT:UPDATE permission)
 */
const recordSupplierAdvance = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ success: false, message: 'Tenant context is missing.' });

        const { supplierId, amount, paymentDate, paymentMode, reference, notes } = req.body;
        const numAmt = Number(amount || 0);
        if (!supplierId || isNaN(numAmt) || numAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide supplierId and a positive amount.' });
        }

        const supplier = await Supplier.findOne({ _id: supplierId, tenant: tenantId });
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        supplier.advanceBalance = Math.round((Number(supplier.advanceBalance || 0) + numAmt) * 100) / 100;
        await supplier.save();

        const paymentId = `SUPP-ADV-${Date.now()}`;
        const entry = await PartyAdvance.create({
            tenant: tenantId,
            partyType: 'SUPPLIER',
            partyId: supplier._id,
            entryType: 'CREDIT',
            amount: numAmt,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            paymentMode: paymentMode || 'UPI',
            reference: String(reference || paymentId).trim(),
            notes: String(notes || 'Supplier Advance Payment').trim(),
            paymentId,
            documentModel: null,
            documentId: null,
            documentNumber: '',
            recordedBy: req.user?._id || req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: `Supplier advance of ₹${numAmt.toLocaleString('en-IN')} recorded.`,
            data: { supplier, entry }
        });
    } catch (error) {
        console.error('Error in recordSupplierAdvance:', error);
        return res.status(500).json({ success: false, message: 'Failed to record supplier advance.', error: error.message });
    }
};

/**
 * @desc    Get Supplier Advance & Payment Ledger
 * @route   GET /api/purchase-orders/supplier-ledger/:supplierId
 * @access  Private (PROCUREMENT:READ permission)
 */
const getSupplierLedger = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ success: false, message: 'Tenant context is missing.' });

        const { supplierId } = req.params;
        const [supplier, ledger, purchaseOrders] = await Promise.all([
            Supplier.findOne({ _id: supplierId, tenant: tenantId }).select('name code phone email paymentTerms advanceBalance').lean(),
            PartyAdvance.find({ tenant: tenantId, partyType: 'SUPPLIER', partyId: supplierId }).sort({ date: -1, createdAt: -1 }).lean(),
            PurchaseOrder.find({ tenant: tenantId, supplier: supplierId, isActive: true, status: { $nin: ['CANCELLED', 'REJECTED'] } }).select('poNumber poDate dueDate totalValue grandTotal paidAmount balanceAmount paymentStatus status payments items').sort({ poDate: -1 }).lean()
        ]);

        if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

        return res.status(200).json({
            success: true,
            data: {
                supplier,
                advanceBalance: Number(supplier.advanceBalance || 0),
                ledger,
                purchaseOrders
            }
        });
    } catch (error) {
        console.error('Error in getSupplierLedger:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch supplier ledger.', error: error.message });
    }
};

module.exports = {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseRegister,
    exportPurchaseRegisterCsv,
    getPurchaseOrderById,
    updatePurchaseOrder,
    updateStatus,
    deletePurchaseOrder,
    recordPoPayment,
    recordSupplierAdvance,
    getSupplierLedger,
    getPayablesSummary,
    getSupplierOutstanding
};
