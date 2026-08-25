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
 * @desc    Create a new Goods Dispatch Note (Fulfill SalesOrder finished goods)
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
        if (!salesOrder || !dispatchLocation || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide salesOrder, dispatchLocation, and at least one item.'
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

        // 3. Setup Mongoose Session Transaction
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

        if (soDoc.status !== 'CONFIRMED' && soDoc.status !== 'READY_FOR_DISPATCH' && soDoc.status !== 'DISPATCHED') {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: `Cannot dispatch goods against Sales Order with status '${soDoc.status}'. Goods can only be dispatched for orders that are 'CONFIRMED', 'READY_FOR_DISPATCH', or 'DISPATCHED'.`
            });
        }

        const dispatchNumber = await generateDispatchNumber(tenantId);
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
            const soItem = soDoc.items.find(i => String(i.finishedGood) === fgIdStr);

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
            const soItem = soDoc.items.find(i => String(i.finishedGood) === String(item.finishedGood));
            if (soItem) {
                soItem.dispatchedQuantity += item.dispatchedQuantity;
            }
        }

        // Step C: Recompute SalesOrder Status (Set 'DISPATCHED' if ALL items fully dispatched)
        const allFullyDispatched = soDoc.items.every(i => i.dispatchedQuantity >= i.quantity - 0.0001);
        if (allFullyDispatched) {
            soDoc.status = 'DISPATCHED';
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
 * @desc    Update Delivery Status of a Dispatch (IN_TRANSIT -> DELIVERED or RETURNED)
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

        const { deliveryStatus } = req.body;
        if (!deliveryStatus || (deliveryStatus !== 'DELIVERED' && deliveryStatus !== 'RETURNED')) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid deliveryStatus ('DELIVERED' or 'RETURNED')."
            });
        }

        const dispatch = await Dispatch.findOne({ _id: req.params.id, tenant: tenantId });
        if (!dispatch) {
            return res.status(404).json({
                success: false,
                message: 'Dispatch record not found.'
            });
        }

        if (dispatch.deliveryStatus !== 'IN_TRANSIT') {
            return res.status(400).json({
                success: false,
                message: `Cannot update delivery status for a dispatch that is already '${dispatch.deliveryStatus}'.`
            });
        }

        dispatch.deliveryStatus = deliveryStatus;
        if (deliveryStatus === 'DELIVERED') {
            dispatch.podConfirmedAt = new Date();
        }

        await dispatch.save();

        await dispatch.populate([
            { path: 'salesOrder', select: 'soNumber status' },
            { path: 'dispatchLocation', select: 'name code' },
            { path: 'items.finishedGood', select: 'name code uom' },
            { path: 'dispatchedBy', select: 'name email' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Dispatch '${dispatch.dispatchNumber}' delivery status updated to '${deliveryStatus}'.${deliveryStatus === 'RETURNED' ? ' Note: Stock/SO status reversal for returns must be processed via manual StockTransaction ADJUSTMENT.' : ''}`,
            data: dispatch
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

        const { salesOrder, deliveryStatus, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (salesOrder) filter.salesOrder = salesOrder;
        if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

        if (search) {
            filter.$or = [
                { dispatchNumber: { $regex: search, $options: 'i' } },
                { vehicleNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [dispatches, total] = await Promise.all([
            Dispatch.find(filter)
                .populate('salesOrder', 'soNumber status customer')
                .populate('dispatchLocation', 'name code type')
                .populate('items.finishedGood', 'name code uom')
                .populate('dispatchedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Dispatch.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: dispatches.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: dispatches
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
            .populate('dispatchLocation', 'name code type')
            .populate({
                path: 'items.finishedGood',
                select: 'name code uom currentStock pricePerBag',
                populate: { path: 'uom', select: 'name symbol' }
            })
            .populate('dispatchedBy', 'name email');

        if (!dispatch) {
            return res.status(404).json({
                success: false,
                message: 'Dispatch record not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: dispatch
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
    createDispatch,
    updateDeliveryStatus,
    getDispatches,
    getDispatchById
};
