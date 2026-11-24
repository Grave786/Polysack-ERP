const PurchaseOrder = require('../models/purchaseOrder.model');
const Supplier = require('../models/supplier.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const { createPoApprovalNotification, resolvePoApprovalNotification } = require('../services/notification.service');
const { createPoApprovalRequest } = require('../services/approval.service');
const { isTenantAdmin } = require('../middlewares/rbac.middleware');

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
            status
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

        const purchaseOrder = new PurchaseOrder({
            tenant: tenantId,
            poNumber,
            supplier,
            poDate: poDate ? new Date(poDate) : new Date(),
            expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            items: cleanedItems,
            totalValue: computedTotalValue,
            paidAmount: 0,
            balanceAmount: computedTotalValue,
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
                .populate('supplier', 'name code contactPerson phone email address city gstin paymentTerms')
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
            const total = Number(poObj.totalValue !== undefined ? poObj.totalValue : (poObj.totalAmount || 0));
            const paid = Number(poObj.paidAmount || 0);
            const balance = Math.max(0, total - paid);

            poObj.paidAmount = paid;
            poObj.balanceAmount = balance;
            poObj.dueDate = poObj.dueDate || poObj.expectedDelivery || poObj.poDate || poObj.createdAt;

            const isOverdue = isDateOverdue(poObj.dueDate, now);

            if (balance <= 0.0001 && (paid > 0 || total > 0)) {
                poObj.paymentStatus = 'PAID';
            } else if (isOverdue || poObj.paymentStatus === 'OVERDUE') {
                poObj.paymentStatus = 'OVERDUE';
            } else if (paid > 0) {
                poObj.paymentStatus = 'PARTIALLY_PAID';
            } else {
                poObj.paymentStatus = 'UNPAID';
            }

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
            status
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
            purchaseOrder.totalValue = computedTotalValue;
            purchaseOrder.totalAmount = computedTotalValue;
        }

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
        const numAmount = Number(rawAmt);

        if (rawAmt === undefined || rawAmt === null || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid payment amount greater than 0.' });
        }

        const po = await PurchaseOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!po) {
            return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
        }

        const totalValue = Number(po.totalValue !== undefined ? po.totalValue : (po.totalAmount || 0));
        const currentPaid = Number(po.paidAmount || 0);
        const currentBalance = Math.max(0, totalValue - currentPaid);

        if (currentBalance <= 0 || po.paymentStatus === 'PAID') {
            return res.status(400).json({ success: false, message: 'Purchase Order is already fully paid.' });
        }

        if (numAmount > currentBalance + 0.001) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (₹${numAmount}) exceeds remaining balance (₹${currentBalance.toFixed(2)}).`
            });
        }

        const newPaidAmount = currentPaid + numAmount;
        po.paidAmount = newPaidAmount;
        po.balanceAmount = Math.max(0, totalValue - newPaidAmount);

        const dueD = po.dueDate || po.expectedDelivery || po.poDate || po.createdAt;
        const now = new Date();

        if (po.balanceAmount <= 0.0001) {
            po.paymentStatus = 'PAID';
        } else if (isDateOverdue(dueD, now) || po.paymentStatus === 'OVERDUE') {
            po.paymentStatus = 'OVERDUE';
        } else if (po.paidAmount > 0) {
            po.paymentStatus = 'PARTIALLY_PAID';
        } else {
            po.paymentStatus = 'UNPAID';
        }

        if (!Array.isArray(po.payments)) po.payments = [];
        po.payments.push({
            amount: numAmount,
            paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
            paymentMode: req.body.paymentMode || 'UPI',
            reference: req.body.reference || '',
            notes: req.body.notes || '',
            recordedBy: req.user?._id || req.user?.id || null,
            recordedAt: new Date()
        });

        await po.save();

        await po.populate([
            { path: 'supplier', select: 'name code contactPerson phone email' },
            { path: 'deliveryLocation', select: 'name code' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Payment of ₹${numAmount} recorded successfully. Remaining balance: ₹${po.balanceAmount.toFixed(2)}.`,
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

        const pos = await PurchaseOrder.find({
            tenant: tenantId,
            isActive: true,
            status: { $nin: ['CANCELLED', 'REJECTED'] }
        })
            .select('totalValue paidAmount balanceAmount dueDate expectedDelivery paymentStatus supplier')
            .lean();

        let totalPayable = 0;
        let overdueAmount = 0;
        const suppliersWithDues = new Set();
        const now = new Date();

        pos.forEach((po) => {
            const total = Number(po.totalValue !== undefined ? po.totalValue : (po.totalAmount || 0));
            const paid = Number(po.paidAmount || 0);
            const balance = Math.max(0, total - paid);

            if (balance > 0.0001) {
                totalPayable += balance;
                if (po.supplier) {
                    suppliersWithDues.add(String(po.supplier));
                }
                const dueD = po.dueDate || po.expectedDelivery || po.poDate || po.createdAt;
                if (po.paymentStatus === 'OVERDUE' || isDateOverdue(dueD, now)) {
                    overdueAmount += balance;
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                totalPayable: Math.round(totalPayable * 100) / 100,
                overduePayable: Math.round(overdueAmount * 100) / 100,
                overdueAmount: Math.round(overdueAmount * 100) / 100,
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

        const pos = await PurchaseOrder.find({
            tenant: tenantId,
            isActive: true,
            status: { $nin: ['CANCELLED', 'REJECTED'] }
        })
            .populate('supplier', 'name code contactPerson phone email')
            .sort({ poDate: -1, createdAt: -1 })
            .lean();

        const supplierMap = {};
        const now = new Date();

        pos.forEach((po) => {
            const suppId = po.supplier ? String(po.supplier._id || po.supplier) : 'Unknown';
            const suppName = po.supplier?.name || po.supplier?.companyName || 'Unknown Supplier';
            const suppCode = po.supplier?.code || '-';
            const phone = po.supplier?.phone || '-';

            if (!supplierMap[suppId]) {
                supplierMap[suppId] = {
                    supplierId: po.supplier?._id || suppId,
                    supplierName: suppName,
                    supplierCode: suppCode,
                    phone: phone,
                    totalPurchased: 0,
                    totalPaid: 0,
                    balance: 0,
                    overdueAmount: 0,
                    poCount: 0,
                    unpaidPoCount: 0
                };
            }

            const total = Number(po.totalValue !== undefined ? po.totalValue : (po.totalAmount || 0));
            const paid = Number(po.paidAmount || 0);
            const balance = Math.max(0, total - paid);

            supplierMap[suppId].totalPurchased += total;
            supplierMap[suppId].totalPaid += paid;
            supplierMap[suppId].balance += balance;
            supplierMap[suppId].poCount += 1;

            if (balance > 0.0001) {
                supplierMap[suppId].unpaidPoCount += 1;
                const dueD = po.dueDate || po.expectedDelivery || po.poDate || po.createdAt;
                if (po.paymentStatus === 'OVERDUE' || isDateOverdue(dueD, now)) {
                    supplierMap[suppId].overdueAmount += balance;
                }
            }
        });

        let list = Object.values(supplierMap).map((s) => ({
            ...s,
            totalPurchased: Math.round(s.totalPurchased * 100) / 100,
            totalPaid: Math.round(s.totalPaid * 100) / 100,
            balance: Math.round(s.balance * 100) / 100,
            overdueAmount: Math.round(s.overdueAmount * 100) / 100
        })).sort((a, b) => b.balance - a.balance);

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
    getPayablesSummary,
    getSupplierOutstanding
};
