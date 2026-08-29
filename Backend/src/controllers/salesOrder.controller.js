const SalesOrder = require('../models/salesOrder.model');
const Customer = require('../models/customer.model');
const Location = require('../models/location.model');
const FinishedGood = require('../models/finishedGood.model');

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

        const {
            customer,
            orderDate,
            deliveryDue,
            items,
            dispatchLocation,
            notes,
            status
        } = req.body;

        // 1. Validation
        if (!customer || !deliveryDue || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer, deliveryDue date, and at least one item.'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(deliveryDue) < today) {
            return res.status(400).json({
                success: false,
                message: 'Expected Delivery Date cannot be in the past.'
            });
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
                dispatchedQuantity: 0, // Always 0 on creation
                ratePerUnit: rate
            });
        }

        // Batch verify Finished Goods exist and belong to tenant
        const foundFGs = await FinishedGood.find({
            _id: { $in: Array.from(finishedGoodIds) },
            tenant: tenantId
        });

        if (foundFGs.length !== finishedGoodIds.size) {
            return res.status(400).json({
                success: false,
                message: 'One or more specified Finished Goods do not exist or do not belong to your organization.'
            });
        }

        const soNumber = await generateSoNumber(tenantId);
        const initialStatus = (status === 'CONFIRMED') ? 'CONFIRMED' : 'DRAFT';

        const salesOrder = new SalesOrder({
            tenant: tenantId,
            soNumber,
            customer,
            orderDate: orderDate || new Date(),
            deliveryDue,
            items: cleanedItems,
            totalValue: computedTotalValue,
            status: initialStatus,
            dispatchLocation: dispatchLocation || null,
            notes,
            isActive: true
        });

        await salesOrder.save();

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

        const { status, customer, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status) {
            filter.status = status;
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
                .populate('customer', 'companyName code contactPerson phone')
                .populate('dispatchLocation', 'name code type')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            SalesOrder.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: salesOrders.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: salesOrders
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
            .populate('customer', 'companyName code contactPerson phone email address city gstin creditLimit')
            .populate('dispatchLocation', 'name code type')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock pricePerBag',
                populate: { path: 'uom', select: 'name symbol' }
            });

        if (!salesOrder) {
            return res.status(404).json({
                success: false,
                message: 'Sales Order not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: salesOrder
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

        if (salesOrder.status !== 'DRAFT' && salesOrder.status !== 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit Sales Order with status '${salesOrder.status}'. Only 'DRAFT' or 'CONFIRMED' orders can be modified.`
            });
        }

        delete req.body.tenant;
        delete req.body.soNumber;
        delete req.body.totalValue;

        const {
            customer,
            orderDate,
            deliveryDue,
            items,
            dispatchLocation,
            notes
        } = req.body;

        if (customer) {
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

        if (orderDate) salesOrder.orderDate = orderDate;
        if (deliveryDue) salesOrder.deliveryDue = deliveryDue;
        if (notes !== undefined) salesOrder.notes = notes;

        if (items !== undefined) {
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'items must be a non-empty array.'
                });
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
                    dispatchedQuantity: existingDispatched,
                    ratePerUnit: rate
                });
            }

            const foundFGs = await FinishedGood.find({
                _id: { $in: Array.from(finishedGoodIds) },
                tenant: tenantId
            });

            if (foundFGs.length !== finishedGoodIds.size) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more specified Finished Goods do not exist or do not belong to your organization.'
                });
            }

            salesOrder.items = cleanedItems;
            salesOrder.totalValue = computedTotalValue;
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

        const { status } = req.body;
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

        if (status === 'DISPATCHED' || status === 'DELIVERED') {
            return res.status(400).json({
                success: false,
                message: `Status '${status}' cannot be set manually. Statuses 'DISPATCHED' and 'DELIVERED' are set automatically by the Dispatch module.`
            });
        }

        if (status === 'CANCELLED') {
            if (salesOrder.status === 'DISPATCHED' || salesOrder.status === 'DELIVERED') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot cancel a Sales Order that is already ${salesOrder.status}.`
                });
            }
            salesOrder.status = 'CANCELLED';
        } else if (status === 'CONFIRMED' || status === 'READY_FOR_DISPATCH' || status === 'DRAFT') {
            salesOrder.status = status;
        } else {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition to '${status}'.`
            });
        }

        await salesOrder.save();

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

module.exports = {
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    updateSalesOrder,
    updateStatus,
    deleteSalesOrder
};
