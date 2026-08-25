const mongoose = require('mongoose');
const GRN = require('../models/grn.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');

/**
 * Helper function to auto-generate unique GRN number per tenant & year
 */
const generateGrnNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;

    const lastGrn = await GRN.findOne({
        tenant: tenantId,
        grnNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ grnNumber: -1 });

    let nextNumber = 1001; // Default starting sequence
    if (lastGrn && lastGrn.grnNumber) {
        const parts = lastGrn.grnNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Create a new Goods Receipt Note (GRN) and atomically update stock & PO status
 * @route   POST /api/grns
 * @access  Private (PROCUREMENT:CREATE permission)
 */
const createGRN = async (req, res) => {
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

        delete req.body.tenant;
        delete req.body.grnNumber;
        delete req.body.receivedBy;

        const {
            purchaseOrder,
            receivedDate,
            items,
            receivingLocation,
            notes
        } = req.body;

        // 1. Validation
        if (!purchaseOrder || !receivingLocation || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide purchaseOrder, receivingLocation, and at least one item.'
            });
        }

        // 2. Verify Receiving Location exists and belongs to tenant
        const locationDoc = await Location.findOne({ _id: receivingLocation, tenant: tenantId });
        if (!locationDoc) {
            return res.status(400).json({
                success: false,
                message: 'Receiving Location does not exist or does not belong to your organization.'
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

        // Fetch PurchaseOrder in session
        const poQuery = PurchaseOrder.findOne({ _id: purchaseOrder, tenant: tenantId });
        if (useTransaction && session) poQuery.session(session);
        const poDoc = await poQuery;

        if (!poDoc) {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found or does not belong to your organization.'
            });
        }

        if (poDoc.status !== 'SENT_TO_SUPPLIER' && poDoc.status !== 'PARTIALLY_RECEIVED') {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: `Cannot receive goods against Purchase Order with status '${poDoc.status}'. Goods can only be received for POs that are 'SENT_TO_SUPPLIER' or 'PARTIALLY_RECEIVED'.`
            });
        }

        const grnNumber = await generateGrnNumber(tenantId);
        const cleanedItems = [];

        // 4. Validate items against PurchaseOrder
        for (const grnItem of items) {
            const numQty = Number(grnItem.receivedQuantity);
            if (!grnItem.rawMaterial || isNaN(numQty) || numQty <= 0) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'Each GRN item must have a valid rawMaterial ObjectId and a positive receivedQuantity > 0.'
                });
            }

            const rmIdStr = String(grnItem.rawMaterial);
            const poItem = poDoc.items.find(i => String(i.rawMaterial) === rmIdStr);

            if (!poItem) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Raw Material '${rmIdStr}' is not part of Purchase Order ${poDoc.poNumber}.`
                });
            }

            const currentReceived = poItem.receivedQuantity || 0;
            const remainingAllowed = poItem.orderedQuantity - currentReceived;

            if (numQty > remainingAllowed) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Cannot receive ${numQty} units of raw material. Ordered: ${poItem.orderedQuantity}, Already received: ${currentReceived}, Remaining allowed: ${remainingAllowed}.`
                });
            }

            cleanedItems.push({
                rawMaterial: grnItem.rawMaterial,
                receivedQuantity: numQty,
                batchNumber: grnItem.batchNumber ? String(grnItem.batchNumber).trim() : undefined
            });
        }

        // Step A: Create GRN Document
        const grnDocs = await GRN.create([{
            tenant: tenantId,
            grnNumber,
            purchaseOrder: poDoc._id,
            receivedDate: receivedDate || new Date(),
            items: cleanedItems,
            receivingLocation,
            notes,
            receivedBy: req.user._id || req.user.id
        }], sessionOption);

        const grn = grnDocs[0];

        // Step B: Create STOCK_IN StockTransactions for each received item & update raw material stock
        for (const grnItem of cleanedItems) {
            const txnResult = await executeStockTransactionCore({
                tenantId,
                referenceNumber: grnNumber,
                itemType: 'RAW_MATERIAL',
                item: grnItem.rawMaterial,
                transactionType: 'STOCK_IN',
                quantity: grnItem.receivedQuantity,
                toLocation: receivingLocation,
                batchNumber: grnItem.batchNumber,
                notes: notes || `Goods received via GRN ${grnNumber} for PO ${poDoc.poNumber}`,
                performedBy: req.user._id || req.user.id
            }, sessionOption);

            createdStockTransactions.push(txnResult.transaction);

            // Increment PO item received quantity
            const poItem = poDoc.items.find(i => String(i.rawMaterial) === String(grnItem.rawMaterial));
            if (poItem) {
                poItem.receivedQuantity += grnItem.receivedQuantity;
            }
        }

        // Step C: Recompute PurchaseOrder Status
        const allFullyReceived = poDoc.items.every(i => i.receivedQuantity >= i.orderedQuantity);
        const anyReceived = poDoc.items.some(i => i.receivedQuantity > 0);

        if (allFullyReceived) {
            poDoc.status = 'FULLY_RECEIVED';
        } else if (anyReceived) {
            poDoc.status = 'PARTIALLY_RECEIVED';
        }

        await poDoc.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await grn.populate([
            { path: 'purchaseOrder', select: 'poNumber status totalValue' },
            { path: 'receivingLocation', select: 'name code type' },
            { path: 'items.rawMaterial', select: 'name code uom' },
            { path: 'receivedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: `GRN '${grnNumber}' processed successfully. Inventory updated and PO status changed to '${poDoc.status}'.`,
            data: {
                grn,
                updatedPurchaseOrder: {
                    id: poDoc._id,
                    poNumber: poDoc.poNumber,
                    status: poDoc.status,
                    items: poDoc.items
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
        console.error('Error in createGRN:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to process GRN.'
        });
    }
};

/**
 * @desc    Get all GRNs scoped to user's tenant
 * @route   GET /api/grns
 * @access  Private (PROCUREMENT:READ permission)
 */
const getGRNs = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { purchaseOrder, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (purchaseOrder) {
            filter.purchaseOrder = purchaseOrder;
        }

        if (search) {
            filter.grnNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [grns, total] = await Promise.all([
            GRN.find(filter)
                .populate('purchaseOrder', 'poNumber status supplier')
                .populate('receivingLocation', 'name code type')
                .populate('items.rawMaterial', 'name code uom')
                .populate('receivedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            GRN.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: grns.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: grns
        });
    } catch (error) {
        console.error('Error in getGRNs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch GRNs.',
            error: error.message
        });
    }
};

/**
 * @desc    Get GRN by ID scoped to user's tenant
 * @route   GET /api/grns/:id
 * @access  Private (PROCUREMENT:READ permission)
 */
const getGRNById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const grn = await GRN.findOne({ _id: req.params.id, tenant: tenantId })
            .populate({
                path: 'purchaseOrder',
                select: 'poNumber status poDate expectedDelivery supplier',
                populate: { path: 'supplier', select: 'name code contactPerson phone' }
            })
            .populate('receivingLocation', 'name code type')
            .populate({
                path: 'items.rawMaterial',
                select: 'name code uom',
                populate: { path: 'uom', select: 'name symbol' }
            })
            .populate('receivedBy', 'name email');

        if (!grn) {
            return res.status(404).json({
                success: false,
                message: 'GRN not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: grn
        });
    } catch (error) {
        console.error('Error in getGRNById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve GRN.',
            error: error.message
        });
    }
};

module.exports = {
    createGRN,
    getGRNs,
    getGRNById
};
