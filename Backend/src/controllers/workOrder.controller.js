const mongoose = require('mongoose');
const WorkOrder = require('../models/workOrder.model');
const BOM = require('../models/bom.model');
const Customer = require('../models/customer.model');
const FinishedGood = require('../models/finishedGood.model');
const Machine = require('../models/machine.model');
const Tenant = require('../models/tenant.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');

const ALL_8_STAGES = [
    'TAPE_EXTRUSION',
    'CIRCULAR_WEAVING',
    'EXTRUSION_LAMINATION',
    'FLEXO_PRINTING',
    'CUTTING_SEWING',
    'STITCHING',
    'HANDLE_ATTACHMENT',
    'BALING_PACKING'
];

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
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

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
        delete req.body.selectedStages;

        const {
            customer,
            finishedGood,
            targetQuantity,
            priority,
            assignedMachine,
            jobOrderDetails: incomingJobDetails
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

        // 3. Auto-resolve active/default BOM for this finishedGood
        let activeBom = null;
        if (req.body.bom) {
            activeBom = await BOM.findOne({ _id: req.body.bom, finishedGood, tenant: tenantId, isActive: true });
        }

        if (!activeBom) {
            // Priority 1: Check for isDefault: true
            activeBom = await BOM.findOne({ finishedGood, tenant: tenantId, isActive: true, isDefault: true });
        }

        if (!activeBom) {
            // Priority 2: Fallback to active BOMs
            const activeBoms = await BOM.find({ finishedGood, tenant: tenantId, isActive: true }).sort({ createdAt: -1 });
            if (activeBoms.length === 1) {
                activeBom = activeBoms[0];
            } else if (activeBoms.length > 1) {
                console.error(`[BOM AUTO-RESOLVE WARNING] Multiple active BOMs (${activeBoms.length}) found for FinishedGood '${fgDoc.name}' (${finishedGood}) with no default set. Auto-using latest BOM.`);
                activeBom = activeBoms[0];
            }
        }

        if (!activeBom) {
            return res.status(400).json({
                success: false,
                message: `No active Bill of Materials (BOM) found for Finished Good '${fgDoc.name}'. Please configure a BOM.`
            });
        }

        // 4. Fetch Tenant production settings fresh from database & setup 8 pipeline stages
        const tenantDoc = await Tenant.findById(tenantId).lean();
        const startingStageKey = tenantDoc?.productionSettings?.activeStartingStage || 'FLEXO_PRINTING';

        const ALL_STAGE_NAMES = [
            'TAPE_EXTRUSION',
            'CIRCULAR_WEAVING',
            'EXTRUSION_LAMINATION',
            'FLEXO_PRINTING',
            'CUTTING_SEWING',
            'STITCHING',
            'HANDLE_ATTACHMENT',
            'BALING_PACKING'
        ];

        let startingIndex = ALL_STAGE_NAMES.indexOf(startingStageKey);
        if (startingIndex === -1) startingIndex = 3; // Default to FLEXO_PRINTING (Index 3, Step 4)

        console.log(`🏭 [WORK ORDER CREATE] Tenant: ${tenantId} | activeStartingStage: ${startingStageKey} | startingIndex: ${startingIndex} (${ALL_STAGE_NAMES[startingIndex]})`);

        const workOrderNumber = await generateWorkOrderNumber(tenantId);
        const now = new Date();

        let firstActiveAssigned = false;

        const stages = ALL_STAGE_NAMES.map((stageName, index) => {
            const sequence = index + 1;
            if (index < startingIndex) {
                return {
                    stageName,
                    sequence,
                    status: 'SKIPPED',
                    goodOutputQty: 0,
                    rejectedQty: 0
                };
            } else if (!firstActiveAssigned) {
                firstActiveAssigned = true;
                return {
                    stageName,
                    sequence,
                    status: 'ACTIVE',
                    startedAt: now,
                    machine: assignedMachine || null,
                    goodOutputQty: 0,
                    rejectedQty: 0
                };
            } else {
                return {
                    stageName,
                    sequence,
                    status: 'PENDING',
                    goodOutputQty: 0,
                    rejectedQty: 0
                };
            }
        });

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

        // Step B: Build optional Job Order / Job Card details
        const rawJobDetails = incomingJobDetails || {};
        const jobOrderDetails = {
            rolls: Array.isArray(rawJobDetails.rolls) ? rawJobDetails.rolls.filter(r => r && r.rollNumber && String(r.rollNumber).trim()).map(r => ({
                rollNumber: String(r.rollNumber).trim().slice(0, 50),
                fabricLength: r.fabricLength !== undefined && r.fabricLength !== '' && r.fabricLength !== null ? Number(r.fabricLength) : null,
                width: r.width !== undefined && r.width !== '' && r.width !== null ? Number(r.width) : null,
                grossWeight: r.grossWeight !== undefined && r.grossWeight !== '' && r.grossWeight !== null ? Number(r.grossWeight) : null,
                netWeight: r.netWeight !== undefined && r.netWeight !== '' && r.netWeight !== null ? Number(r.netWeight) : null,
                totalQuantityKg: r.totalQuantityKg !== undefined && r.totalQuantityKg !== '' && r.totalQuantityKg !== null ? Number(r.totalQuantityKg) : null,
                totalQuantityPcs: r.totalQuantityPcs !== undefined && r.totalQuantityPcs !== '' && r.totalQuantityPcs !== null ? Number(r.totalQuantityPcs) : null
            })) : [],
            orderDate: rawJobDetails.orderDate ? new Date(rawJobDetails.orderDate) : new Date(),
            productCategory: rawJobDetails.productCategory || 'Print',
            jobDescriptionPrintColours: rawJobDetails.jobDescriptionPrintColours || '',
            jobDescriptionPrintSide: rawJobDetails.jobDescriptionPrintSide || '',
            materialQualityFabric: rawJobDetails.materialQualityFabric || '',
            fabricLaminationType: rawJobDetails.fabricLaminationType || '',
            materialColour: rawJobDetails.materialColour || '',
            printingColour: rawJobDetails.printingColour || '',
            fabricGrammage: rawJobDetails.fabricGrammage || '',
            bagWeightGms: rawJobDetails.bagWeightGms !== undefined && rawJobDetails.bagWeightGms !== '' && rawJobDetails.bagWeightGms !== null
                ? Number(rawJobDetails.bagWeightGms)
                : null,
            fabricAverage: rawJobDetails.fabricAverage || '',
            fabricSizeInInch: {
                width: rawJobDetails.fabricSizeInInch?.width !== undefined && rawJobDetails.fabricSizeInInch?.width !== '' && rawJobDetails.fabricSizeInInch?.width !== null
                    ? Number(rawJobDetails.fabricSizeInInch.width)
                    : null,
                length: rawJobDetails.fabricSizeInInch?.length !== undefined && rawJobDetails.fabricSizeInInch?.length !== '' && rawJobDetails.fabricSizeInInch?.length !== null
                    ? Number(rawJobDetails.fabricSizeInInch.length)
                    : null
            },
            customerContactNumber: rawJobDetails.customerContactNumber || '',
            contactPersonName: rawJobDetails.contactPersonName || '',
            contactPersonDesignation: rawJobDetails.contactPersonDesignation || '',
            totalOrderQuantity: rawJobDetails.totalOrderQuantity !== undefined && rawJobDetails.totalOrderQuantity !== '' && rawJobDetails.totalOrderQuantity !== null
                ? Number(rawJobDetails.totalOrderQuantity)
                : null,
            totalOrderQuantityUnit: rawJobDetails.totalOrderQuantityUnit || 'Pcs',
            orderConfirmed: Boolean(rawJobDetails.orderConfirmed),
            expectedDeliveryDate: rawJobDetails.expectedDeliveryDate ? new Date(rawJobDetails.expectedDeliveryDate) : null,
            purchaseOrderFiles: Array.isArray(rawJobDetails.purchaseOrderFiles)
                ? rawJobDetails.purchaseOrderFiles.slice(0, 5).map(f => ({
                    name: f.name || '',
                    size: Number(f.size || 0),
                    fileType: f.fileType || '',
                    data: f.data || ''
                }))
                : []
        };

        // Step C: Create WorkOrder document
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
            jobOrderDetails,
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

        // Calculate max available quantity passed from previous non-skipped completed stage (or targetQuantity if first active stage)
        let maxAvailableQty = workOrder.targetQuantity;
        for (let i = activeStageIndex - 1; i >= 0; i--) {
            const prevStage = workOrder.stages[i];
            if (prevStage && prevStage.status !== 'SKIPPED') {
                maxAvailableQty = Number(prevStage.goodOutputQty || 0);
                break;
            }
        }

        // Auto-calculate rejected quantity as remainder if not explicitly provided
        const computedRejectedQty = Math.max(0, maxAvailableQty - numGoodQty);
        const finalRejectedQty = req.body.rejectedQty !== undefined ? numRejectedQty : computedRejectedQty;
        const totalEntered = numGoodQty + finalRejectedQty;

        // Strict Waterfall Quantity Validation: Total quantity (good + defect) cannot exceed previous stage available input
        if (totalEntered > maxAvailableQty || numGoodQty > maxAvailableQty) {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(400).json({
                success: false,
                message: `Total quantity (${totalEntered}) cannot exceed the available input from the previous stage (${maxAvailableQty}).`
            });
        }

        // 1. Complete current stage
        currentStage.goodOutputQty = numGoodQty;
        currentStage.rejectedQty = finalRejectedQty;
        currentStage.status = 'COMPLETED';
        currentStage.completedAt = now;

        let outputTxn = null;

        // Find next non-skipped stage index
        let nextStageIndex = -1;
        for (let i = activeStageIndex + 1; i < workOrder.stages.length; i++) {
            if (workOrder.stages[i] && workOrder.stages[i].status !== 'SKIPPED') {
                nextStageIndex = i;
                break;
            }
        }

        // 2. Check if this was the final active stage
        if (nextStageIndex === -1 || currentStage.sequence === 8) {
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

            // Auto-complete Work Order on final stage completion
            workOrder.completedQuantity = numGoodQty;
            workOrder.status = 'COMPLETED';
            workOrder.progressPercentage = 100;
        } else {
            // Activate next non-skipped stage
            const nextStage = workOrder.stages[nextStageIndex];
            if (nextStage) {
                nextStage.status = 'ACTIVE';
                nextStage.startedAt = now;
            }
        }

        const activeOrCompleted = workOrder.stages.filter(s => s.status !== 'SKIPPED');
        const completedCount = activeOrCompleted.filter(s => s.status === 'COMPLETED').length;
        workOrder.progressPercentage = workOrder.status === 'COMPLETED'
            ? 100
            : Math.min(100, Math.round((completedCount / activeOrCompleted.length) * 100));

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
            message: `Stage '${currentStage.stageName}' completed successfully.${currentStage.sequence === 8 ? ' Finished good routed to Pending QC Stock.' : ''}`,
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
