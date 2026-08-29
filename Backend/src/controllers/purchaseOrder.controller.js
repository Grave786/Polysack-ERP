const PurchaseOrder = require('../models/purchaseOrder.model');
const Supplier = require('../models/supplier.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const { createPoApprovalNotification, resolvePoApprovalNotification } = require('../services/notification.service');

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

        if (expectedDelivery) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (new Date(expectedDelivery) < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Expected Delivery date cannot be in the past.'
                });
            }
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
        const initialStatus = ['SENT_TO_SUPPLIER', 'PENDING_APPROVAL'].includes(status) ? status : 'DRAFT';

        const purchaseOrder = new PurchaseOrder({
            tenant: tenantId,
            poNumber,
            supplier,
            poDate: poDate || new Date(),
            expectedDelivery: expectedDelivery || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            items: cleanedItems,
            totalValue: computedTotalValue,
            status: initialStatus,
            deliveryLocation: deliveryLocation || null,
            notes,
            isActive: true
        });

        await purchaseOrder.save();

        if (purchaseOrder.status === 'PENDING_APPROVAL') {
            await createPoApprovalNotification(purchaseOrder);
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

        const { status, supplier, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status) {
            filter.status = status;
        }

        if (supplier) {
            filter.supplier = supplier;
        }

        if (search) {
            filter.poNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [purchaseOrders, total] = await Promise.all([
            PurchaseOrder.find(filter)
                .populate('supplier', 'name code contactPerson phone email address city gstin')
                .populate('deliveryLocation', 'name code type')
                .populate({
                    path: 'items.rawMaterial',
                    select: 'name code uom'
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            PurchaseOrder.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: purchaseOrders.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: purchaseOrders
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

        return res.status(200).json({
            success: true,
            data: purchaseOrder
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

        if (purchaseOrder.status !== 'DRAFT') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit Purchase Order with status '${purchaseOrder.status}'. Only 'DRAFT' purchase orders can be modified. Cancel and create a new PO if needed.`
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
            notes
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
        }

        await purchaseOrder.save();

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

        if (status === 'CANCELLED') {
            if (purchaseOrder.status === 'FULLY_RECEIVED' || purchaseOrder.status === 'PARTIALLY_RECEIVED') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot cancel a Purchase Order that is already ${purchaseOrder.status}.`
                });
            }
            purchaseOrder.status = 'CANCELLED';
        } else if (status === 'SENT_TO_SUPPLIER') {
            if (purchaseOrder.status !== 'DRAFT' && purchaseOrder.status !== 'PENDING_APPROVAL') {
                return res.status(400).json({
                    success: false,
                    message: `Can only mark as SENT_TO_SUPPLIER when current status is DRAFT or PENDING_APPROVAL. Current status is ${purchaseOrder.status}.`
                });
            }
            purchaseOrder.status = 'SENT_TO_SUPPLIER';
        } else {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition to '${status}'.`
            });
        }

        await purchaseOrder.save();

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

module.exports = {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    updateStatus,
    deletePurchaseOrder
};
