const mongoose = require('mongoose');
const WorkOrder = require('../models/workOrder.model');
const BOM = require('../models/bom.model');
const Customer = require('../models/customer.model');
const FinishedGood = require('../models/finishedGood.model');
const Machine = require('../models/machine.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');

/**
 * Helper function to auto-generate unique WorkOrder number per tenant & year
 */
const generateWorkOrderNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;

    // Find highest work order number for this tenant and current year
    const lastWorkOrder = await WorkOrder.findOne({
        tenant: tenantId,
        workOrderNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ workOrderNumber: -1 });

    let nextNumber = 8201; // Default starting sequence
    if (lastWorkOrder && lastWorkOrder.workOrderNumber) {
        const parts = lastWorkOrder.workOrderNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Create a new Work Order and automatically consume raw materials from BOM
 * @route   POST /api/work-orders
 * @access  Private (PRODUCTION:CREATE permission)
 */
const createWorkOrder = async (req, res) => {
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
        delete req.body.completedQuantity;
        delete req.body.workOrderNumber;
        delete req.body.stages;

        const {
            customer,
            finishedGood,
            targetQuantity,
            priority,
            assignedMachine
        } = req.body;

        // 1. Basic Validation
        if (!customer || !finishedGood || !targetQuantity || Number(targetQuantity) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer, finishedGood, and a targetQuantity >= 1.'
            });
        }

        const numTargetQty = Number(targetQuantity);

        // 2. Validate tenant-ownership of referenced models
        const customerDoc = await Customer.findOne({ _id: customer, tenant: tenantId });
        if (!customerDoc) {
            return res.status(400).json({
                success: false,
                message: 'Customer does not exist or does not belong to your organization.'
            });
        }

        const fgDoc = await FinishedGood.findOne({ _id: finishedGood, tenant: tenantId });
        if (!fgDoc) {
            return res.status(400).json({
                success: false,
                message: 'Finished Good does not exist or does not belong to your organization.'
            });
        }

        if (assignedMachine) {
            const machineDoc = await Machine.findOne({ _id: assignedMachine, tenant: tenantId });
            if (!machineDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned machine does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Lookup active BOM for this finishedGood
        const activeBom = await BOM.findOne({
            finishedGood,
            tenant: tenantId,
            isActive: true
        });

        if (!activeBom) {
            return res.status(400).json({
                success: false,
                message: 'No active BOM found for this product. Please create an active BOM first.'
            });
        }

        // 4. Generate WorkOrder number & setup 6 fixed pipeline stages
        const workOrderNumber = await generateWorkOrderNumber(tenantId);
        const now = new Date();

        const stages = [
            { stageName: 'TAPE_EXTRUSION', sequence: 1, status: 'ACTIVE', startedAt: now, machine: assignedMachine || null },
            { stageName: 'CIRCULAR_WEAVING', sequence: 2, status: 'PENDING' },
            { stageName: 'EXTRUSION_LAMINATION', sequence: 3, status: 'PENDING' },
            { stageName: 'FLEXO_PRINTING', sequence: 4, status: 'PENDING' },
            { stageName: 'CUTTING_SEWING', sequence: 5, status: 'PENDING' },
            { stageName: 'BALING_PACKING', sequence: 6, status: 'PENDING' }
        ];

        // 5. Setup Mongoose session for atomic WorkOrder creation + Stock Consumption
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false; // Fallback for standalone MongoDB
        }

        const sessionOption = useTransaction ? { session } : {};
        const createdStockTransactions = [];

        // Step A: Immediately consume raw materials for each BOM item
        for (const item of activeBom.items) {
            const requiredQty = item.quantityPerUnit * numTargetQty;

            const txnResult = await executeStockTransactionCore({
                tenantId,
                referenceNumber: workOrderNumber,
                itemType: 'RAW_MATERIAL',
                item: item.rawMaterial,
                transactionType: 'PRODUCTION_CONSUMPTION',
                quantity: requiredQty,
                notes: `Auto-consumed for WorkOrder ${workOrderNumber}`,
                performedBy: req.user._id || req.user.id
            }, sessionOption);

            createdStockTransactions.push(txnResult.transaction);
        }

        // Step B: Create WorkOrder document
        const woDocs = await WorkOrder.create([{
            tenant: tenantId,
            workOrderNumber,
            customer,
            finishedGood,
            bom: activeBom._id,
            targetQuantity: numTargetQty,
            completedQuantity: 0,
            priority: priority || 'MEDIUM',
            status: 'IN_PROGRESS',
            assignedMachine: assignedMachine || null,
            stages,
            isActive: true
        }], sessionOption);

        const workOrder = woDocs[0];

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await workOrder.populate([
            { path: 'customer', select: 'companyName code' },
            { path: 'finishedGood', select: 'name code' },
            { path: 'assignedMachine', select: 'name code' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Work Order '${workOrderNumber}' created successfully. Raw materials consumed atomically.`,
            data: {
                workOrder,
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
        console.error('Error in createWorkOrder:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create Work Order.'
        });
    }
};

/**
 * @desc    Advance current stage of a Work Order
 * @route   PATCH /api/work-orders/:id/advance-stage
 * @access  Private (PRODUCTION:UPDATE permission)
 */
const advanceStage = async (req, res) => {
    const tenantId = req.user?.tenant;
    if (!tenantId) {
        return res.status(403).json({
            success: false,
            message: 'Tenant context is missing or invalid. Please log in again.'
        });
    }

    const { goodOutputQty, rejectedQty, notes } = req.body;

    const numGoodQty = Number(goodOutputQty || 0);
    const numRejectedQty = Number(rejectedQty || 0);

    if (numGoodQty < 0 || numRejectedQty < 0) {
        return res.status(400).json({
            success: false,
            message: 'Quantities cannot be negative.'
        });
    }

    let session = null;
    let useTransaction = true;

    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (sessionErr) {
        useTransaction = false;
    }

    try {
        const sessionOption = useTransaction ? { session } : {};

        // Find WorkOrder within tenant scope
        const query = WorkOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (useTransaction && session) query.session(session);
        const workOrder = await query;

        if (!workOrder) {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(404).json({ success: false, message: 'Work Order not found.' });
        }

        if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(400).json({
                success: false,
                message: `Cannot advance stage on a Work Order with status '${workOrder.status}'.`
            });
        }

        // Find active stage
        const activeStageIndex = workOrder.stages.findIndex(s => s.status === 'ACTIVE');
        if (activeStageIndex === -1) {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(400).json({
                success: false,
                message: 'No ACTIVE stage found for this Work Order.'
            });
        }

        const currentStage = workOrder.stages[activeStageIndex];
        const now = new Date();

        // 1. Complete current stage
        currentStage.goodOutputQty = numGoodQty;
        currentStage.rejectedQty = numRejectedQty;
        currentStage.status = 'COMPLETED';
        currentStage.completedAt = now;

        let outputTxn = null;

        // 2. Check if this was the final stage (sequence 6: BALING_PACKING)
        if (currentStage.sequence === 6) {
            if (numGoodQty > 0) {
                const txnResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: workOrder.workOrderNumber,
                    itemType: 'FINISHED_GOOD',
                    item: workOrder.finishedGood,
                    transactionType: 'PRODUCTION_OUTPUT_PENDING_QC',
                    quantity: numGoodQty,
                    notes: notes || `Finished Good production output pending QC inspection from final stage (WorkOrder ${workOrder.workOrderNumber})`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                outputTxn = txnResult.transaction;
            }

            workOrder.completedQuantity += numGoodQty;
            if (workOrder.completedQuantity >= workOrder.targetQuantity) {
                workOrder.status = 'COMPLETED';
            }
        } else {
            // Activate next stage
            const nextStage = workOrder.stages[activeStageIndex + 1];
            if (nextStage) {
                nextStage.status = 'ACTIVE';
                nextStage.startedAt = now;
            }
        }

        // Recalculate WorkOrder progress percentage based on completed stages
        if (typeof workOrder.recalculateProgress === 'function') {
            workOrder.recalculateProgress();
        } else {
            const completedCount = (workOrder.stages || []).filter((s) => s.status === 'COMPLETED').length;
            workOrder.progressPercentage = Math.min(100, Math.round((completedCount / (workOrder.stages?.length || 6)) * 100));
        }

        await workOrder.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await workOrder.populate([
            { path: 'customer', select: 'companyName code' },
            { path: 'finishedGood', select: 'name code' },
            { path: 'assignedMachine', select: 'name code' },
            { path: 'stages.machine', select: 'name code' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Stage '${currentStage.stageName}' completed successfully.${currentStage.sequence === 6 ? ' Finished good routed to Pending QC Stock.' : ''}`,
            data: {
                workOrder,
                completedStage: currentStage,
                stockTransactionCreated: outputTxn
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error('Error in advanceStage:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to advance Work Order stage.'
        });
    }
};

/**
 * @desc    Cancel a Work Order (Does not reverse consumed stock)
 * @route   PATCH /api/work-orders/:id/cancel
 * @access  Private (PRODUCTION:UPDATE permission)
 */
const cancelWorkOrder = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const workOrder = await WorkOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel a Work Order that is already ${workOrder.status}.`
            });
        }

        workOrder.status = 'CANCELLED';
        await workOrder.save();

        await workOrder.populate([
            { path: 'customer', select: 'companyName code' },
            { path: 'finishedGood', select: 'name code' },
            { path: 'assignedMachine', select: 'name code' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Work Order cancelled successfully. Note: Raw material stock consumed at creation is not automatically reversed; use manual ADJUSTMENT if necessary.',
            data: workOrder
        });
    } catch (error) {
        console.error('Error in cancelWorkOrder:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel Work Order.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Work Orders scoped to user's tenant
 * @route   GET /api/work-orders
 * @access  Private (PRODUCTION:READ permission)
 */
const getWorkOrders = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, customer, finishedGood, priority, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status) filter.status = status;
        if (customer) filter.customer = customer;
        if (finishedGood) filter.finishedGood = finishedGood;
        if (priority) filter.priority = priority;

        if (search) {
            filter.workOrderNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [workOrders, total] = await Promise.all([
            WorkOrder.find(filter)
                .populate('customer', 'companyName code')
                .populate('finishedGood', 'name code')
                .populate('assignedMachine', 'name code currentOperator')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            WorkOrder.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: workOrders.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: workOrders
        });
    } catch (error) {
        console.error('Error in getWorkOrders:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Work Orders.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Work Order by ID with full stage details
 * @route   GET /api/work-orders/:id
 * @access  Private (PRODUCTION:READ permission)
 */
const getWorkOrderById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const workOrder = await WorkOrder.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName code contactPerson phone')
            .populate('finishedGood', 'name code uom currentStock')
            .populate('bom')
            .populate('assignedMachine', 'name code section status')
            .populate('stages.machine', 'name code section');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: workOrder
        });
    } catch (error) {
        console.error('Error in getWorkOrderById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Work Order.',
            error: error.message
        });
    }
};

module.exports = {
    createWorkOrder,
    advanceStage,
    cancelWorkOrder,
    getWorkOrders,
    getWorkOrderById
};
