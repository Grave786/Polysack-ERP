const mongoose = require('mongoose');
const StockTransaction = require('../models/stockTransaction.model');
const RawMaterial = require('../models/rawMaterial.model');
const FinishedGood = require('../models/finishedGood.model');
const Location = require('../models/location.model');

/**
 * @desc    Create a new Stock Transaction (Audit Ledger Entry)
 * @route   POST /api/stock-transactions
 * @access  Private (INVENTORY:CREATE permission)
 */
const createStockTransaction = async (req, res) => {
    const tenantId = req.user?.tenant;
    if (!tenantId) {
        return res.status(403).json({
            success: false,
            message: 'Tenant context is missing or invalid. Please log in again.'
        });
    }

    const {
        referenceNumber,
        itemType,
        item,
        transactionType,
        quantity,
        fromLocation,
        toLocation,
        batchNumber,
        notes
    } = req.body;

    // 1. Validation
    if (!referenceNumber || !itemType || !item || !transactionType || !quantity) {
        return res.status(400).json({
            success: false,
            message: 'Please provide all required fields: referenceNumber, itemType, item, transactionType, and quantity.'
        });
    }

    const numQuantity = Number(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Quantity must be a positive number greater than 0.'
        });
    }

    // Determine target item model & fetch item document
    const itemModel = itemType === 'RAW_MATERIAL' ? 'RawMaterial' : (itemType === 'FINISHED_GOOD' ? 'FinishedGood' : null);
    if (!itemModel) {
        return res.status(400).json({
            success: false,
            message: 'Invalid itemType. Must be RAW_MATERIAL or FINISHED_GOOD.'
        });
    }

    const ItemModelClass = itemType === 'RAW_MATERIAL' ? RawMaterial : FinishedGood;

    // 2. Setup MongoDB session transaction
    let session = null;
    let useTransaction = true;

    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (sessionErr) {
        useTransaction = false; // Fallback for standalone MongoDB
    }

    try {
        const sessionOption = useTransaction ? { session } : {};

        // Fetch item document within tenant scope
        const itemDoc = useTransaction
            ? await ItemModelClass.findOne({ _id: item, tenant: tenantId }).session(session)
            : await ItemModelClass.findOne({ _id: item, tenant: tenantId });

        if (!itemDoc) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({
                success: false,
                message: `${itemModel === 'RawMaterial' ? 'Raw Material' : 'Finished Good'} item not found or does not belong to your organization.`
            });
        }

        // Validate locations if provided
        if (fromLocation) {
            const fromLocDoc = await Location.findOne({ _id: fromLocation, tenant: tenantId });
            if (!fromLocDoc) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'fromLocation does not exist or does not belong to your organization.'
                });
            }
        }

        if (toLocation) {
            const toLocDoc = await Location.findOne({ _id: toLocation, tenant: tenantId });
            if (!toLocDoc) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'toLocation does not exist or does not belong to your organization.'
                });
            }
        }

        // Calculate stock change & verify sufficient stock for deductions
        let newStock = itemDoc.currentStock;

        switch (transactionType) {
            case 'STOCK_IN':
            case 'PRODUCTION_OUTPUT':
            case 'OPENING_BALANCE':
                newStock += numQuantity;
                break;
            case 'ADJUSTMENT':
                newStock += numQuantity; // Positive quantity increases stock, negative decreases
                break;
            case 'STOCK_OUT':
            case 'PRODUCTION_CONSUMPTION':
                if (itemDoc.currentStock - numQuantity < 0) {
                    if (useTransaction && session) {
                        await session.abortTransaction();
                        session.endSession();
                    }
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for '${itemDoc.name}'. Current stock: ${itemDoc.currentStock}, attempted deduction: ${numQuantity}.`
                    });
                }
                newStock -= numQuantity;
                break;
            case 'TRANSFER':
                if (!fromLocation || !toLocation) {
                    if (useTransaction && session) {
                        await session.abortTransaction();
                        session.endSession();
                    }
                    return res.status(400).json({
                        success: false,
                        message: 'TRANSFER transaction type requires both fromLocation and toLocation.'
                    });
                }
                // Net change to overall currentStock is 0 for location transfer
                break;
            default:
                if (useTransaction && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Invalid transactionType '${transactionType}'.`
                });
        }

        if (newStock < 0) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: `Transaction would result in negative currentStock (${newStock}) for '${itemDoc.name}'. Operation rejected.`
            });
        }

        // Step A: Create Stock Transaction doc
        const txnDocs = await StockTransaction.create([{
            tenant: tenantId,
            referenceNumber,
            itemType,
            itemModel,
            item: itemDoc._id,
            transactionType,
            quantity: numQuantity,
            fromLocation: fromLocation || null,
            toLocation: toLocation || null,
            batchNumber,
            notes,
            performedBy: req.user._id || req.user.id
        }], sessionOption);

        const stockTxn = txnDocs[0];

        // Step B: Atomically update item's currentStock
        itemDoc.currentStock = newStock;
        await itemDoc.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        return res.status(201).json({
            success: true,
            message: `Stock transaction '${transactionType}' created successfully. Updated stock: ${newStock}.`,
            data: {
                transaction: stockTxn,
                updatedItemStock: {
                    itemId: itemDoc._id,
                    itemName: itemDoc.name,
                    itemType,
                    currentStock: newStock
                }
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error('Error in createStockTransaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create stock transaction.',
            error: error.message
        });
    }
};

/**
 * @desc    Get stock transactions ledger with filtering and pagination
 * @route   GET /api/stock-transactions
 * @access  Private (INVENTORY:READ permission)
 */
const getStockTransactions = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const {
            itemType,
            item,
            transactionType,
            batchNumber,
            referenceNumber,
            fromDate,
            toDate,
            page = 1,
            limit = 20
        } = req.query;

        const filter = { tenant: tenantId };

        if (itemType) {
            filter.itemType = itemType;
        }

        if (item) {
            filter.item = item;
        }

        if (transactionType) {
            filter.transactionType = transactionType;
        }

        if (batchNumber) {
            filter.batchNumber = { $regex: batchNumber, $options: 'i' };
        }

        if (referenceNumber) {
            filter.referenceNumber = { $regex: referenceNumber, $options: 'i' };
        }

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) {
                filter.createdAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                filter.createdAt.$lte = new Date(toDate);
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [transactions, total] = await Promise.all([
            StockTransaction.find(filter)
                .populate('item', 'name code category uom currentStock')
                .populate('performedBy', 'name email')
                .populate('fromLocation', 'name code')
                .populate('toLocation', 'name code')
                .sort({ createdAt: -1 }) // Most recent transactions first
                .skip(skip)
                .limit(limitNum),
            StockTransaction.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: transactions.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: transactions
        });
    } catch (error) {
        console.error('Error in getStockTransactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch stock transactions.',
            error: error.message
        });
    }
};

/**
 * @desc    Get stock transaction by ID scoped to tenant
 * @route   GET /api/stock-transactions/:id
 * @access  Private (INVENTORY:READ permission)
 */
const getStockTransactionById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const transaction = await StockTransaction.findOne({
            _id: req.params.id,
            tenant: tenantId
        })
            .populate('item', 'name code category uom currentStock')
            .populate('performedBy', 'name email')
            .populate('fromLocation', 'name code')
            .populate('toLocation', 'name code');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Stock transaction not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: transaction
        });
    } catch (error) {
        console.error('Error in getStockTransactionById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve stock transaction.',
            error: error.message
        });
    }
};

module.exports = {
    createStockTransaction,
    getStockTransactions,
    getStockTransactionById
};
