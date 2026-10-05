const mongoose = require('mongoose');
const WorkOrder = require('../models/workOrder.model');
const BOM = require('../models/bom.model');
const Customer = require('../models/customer.model');
const FinishedGood = require('../models/finishedGood.model');
const Machine = require('../models/machine.model');
const Tenant = require('../models/tenant.model');
const ProductionLog = require('../models/productionLog.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');
const {
    getStageProductionStatus,
    getValidOperatorIds
} = require('./productionLog.controller');

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
        if (!customer || !finishedGood || !targetQuantity || Number(targetQuantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer, finishedGood, and a valid positive targetQuantity (>0).'
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

        // Step B: Build optional Job Order / Job Card details with full Roll Traceability & FIFO auto-allocation
        const rawJobDetails = incomingJobDetails || {};
        const incomingDescription = req.body.description || rawJobDetails.description || req.body.remarks || rawJobDetails.remarks || '';
        const incomingRemarks = req.body.remarks || rawJobDetails.remarks || req.body.description || rawJobDetails.description || '';

        // Fetch all inward GRN rolls for this tenant to cross-reference inward traceability
        const GRN = require('../models/grn.model');
        const grns = await GRN.find({
            tenant: tenantId,
            'rolls.0': { $exists: true }
        })
            .populate('purchaseOrder', 'poNumber')
            .populate('supplier', 'name code')
            .populate('items.rawMaterial', 'name code category uom')
            .sort({ receivedDate: 1, createdAt: 1 })
            .lean();

        // Build roll lookup map from inward GRNs
        const grnRollMap = {};
        for (const grn of grns) {
            const poNum = grn.purchaseOrder?.poNumber || grn.poNumber || '';
            const suppName = grn.supplier?.name || '';
            const rawMat = grn.items?.[0]?.rawMaterial;
            const matName = rawMat?.name || 'Woven Fabric Roll';
            const matCode = rawMat?.code || '';

            for (const r of (grn.rolls || [])) {
                const rId = String(r._id);
                const rNum = String(r.rollNumber || '').trim().toUpperCase();
                const rollMeta = {
                    rollId: r._id,
                    rollNumber: r.rollNumber,
                    grnId: grn._id,
                    grnNumber: grn.grnNumber,
                    poNumber: poNum,
                    supplierName: suppName,
                    materialName: matName,
                    materialCode: matCode,
                    receivedDate: grn.receivedDate,
                    fabricLength: Number(r.fabricLength || 0),
                    width: r.width,
                    grossWeight: r.grossWeight,
                    netWeight: r.netWeight,
                    totalQuantityKg: r.totalQuantityKg,
                    totalQuantityPcs: r.totalQuantityPcs
                };
                grnRollMap[rId] = rollMeta;
                if (rNum) grnRollMap[rNum] = rollMeta;
            }
        }

        // Fetch active Work Orders to determine currently used meters per roll
        const activeWorkOrders = await WorkOrder.find({
            tenant: tenantId,
            status: { $ne: 'CANCELLED' },
            'jobOrderDetails.rolls.0': { $exists: true }
        })
            .select('workOrderNumber jobOrderDetails.rolls')
            .lean();

        const consumptionMap = {};
        for (const wo of activeWorkOrders) {
            const woRolls = wo.jobOrderDetails?.rolls || [];
            for (const r of woRolls) {
                const consumed = Number(r.consumedLength != null ? r.consumedLength : (r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : 0))) || 0;
                if (r.rollId) {
                    const idKey = String(r.rollId);
                    consumptionMap[idKey] = (consumptionMap[idKey] || 0) + consumed;
                }
                if (r.rollNumber || r.rollNo) {
                    const numKey = String(r.rollNumber || r.rollNo).trim().toUpperCase();
                    consumptionMap[numKey] = (consumptionMap[numKey] || 0) + consumed;
                }
            }
        }

        let finalAllocatedRolls = [];
        const rawRollsInput = Array.isArray(rawJobDetails.rolls)
            ? rawJobDetails.rolls.filter(r => r && (r.rollNumber || r.rollNo || r.rollId || r._id) && String(r.rollNumber || r.rollNo || '').trim())
            : [];

        if (rawRollsInput.length > 0) {
            // Case A: User explicitly picked / entered rolls manually
            finalAllocatedRolls = rawRollsInput.map((r) => {
                const idKey = r.rollId ? String(r.rollId) : (r._id ? String(r._id) : '');
                const numKey = String(r.rollNumber || r.rollNo || '').trim().toUpperCase();
                const matched = grnRollMap[idKey] || grnRollMap[numKey] || {};

                const originalLength = Number(matched.fabricLength || r.fabricLength || r.length || 0);
                const rollNetWeight = Number(matched.netWeight || r.netWeight || 0);
                const rollGrossWeight = Number(matched.grossWeight || r.grossWeight || 0);
                const previouslyUsed = consumptionMap[idKey] || consumptionMap[numKey] || 0;
                const remainingMetersBefore = Math.max(0, originalLength - previouslyUsed);

                const consumedMeters = Number(r.consumedLength != null ? r.consumedLength : (r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : (remainingMetersBefore > 0 ? remainingMetersBefore : originalLength))));
                const consumedWeight = originalLength > 0 && rollNetWeight > 0 ? Number(((consumedMeters / originalLength) * rollNetWeight).toFixed(2)) : (r.consumedWeightKg || null);

                return {
                    _id: r._id && mongoose.isValidObjectId(r._id) ? r._id : undefined,
                    rollId: matched.rollId || (r.rollId && mongoose.isValidObjectId(r.rollId) ? r.rollId : (r._id && mongoose.isValidObjectId(r._id) ? r._id : null)),
                    rollNumber: String(matched.rollNumber || r.rollNumber || r.rollNo || '').trim().slice(0, 50),
                    materialName: matched.materialName || r.materialName || 'Woven Fabric Roll',
                    materialCode: matched.materialCode || r.materialCode || '',
                    grnId: matched.grnId || null,
                    grnNumber: matched.grnNumber || r.grnNumber || '',
                    poNumber: matched.poNumber || r.poNumber || '',
                    supplierName: matched.supplierName || r.supplierName || '',
                    consumedLength: consumedMeters,
                    consumedWeightKg: consumedWeight,
                    remainingMeters: Math.max(0, remainingMetersBefore - consumedMeters),
                    usedMeters: previouslyUsed + consumedMeters,
                    fabricLength: originalLength || null,
                    width: r.width != null ? Number(r.width) : (matched.width != null ? Number(matched.width) : null),
                    grossWeight: rollGrossWeight || null,
                    netWeight: rollNetWeight || null,
                    totalQuantityKg: r.totalQuantityKg != null ? Number(r.totalQuantityKg) : (matched.totalQuantityKg != null ? Number(matched.totalQuantityKg) : null),
                    totalQuantityPcs: r.totalQuantityPcs != null ? Number(r.totalQuantityPcs) : (matched.totalQuantityPcs != null ? Number(matched.totalQuantityPcs) : null)
                };
            });
        } else {
            // Case B: No rolls specified -> FIFO Auto-Allocation from oldest received GRN rolls
            let neededMeters = 0;
            for (const item of activeBom.items) {
                const reqQty = item.quantityPerUnit * numTargetQty;
                neededMeters = Math.max(neededMeters, reqQty);
            }
            if (neededMeters <= 0) {
                neededMeters = numTargetQty;
            }

            let remainingToAllocate = neededMeters;
            for (const grn of grns) {
                if (remainingToAllocate <= 0) break;
                const poNum = grn.purchaseOrder?.poNumber || grn.poNumber || '';
                const suppName = grn.supplier?.name || '';
                const rawMat = grn.items?.[0]?.rawMaterial;
                const matName = rawMat?.name || 'Woven Fabric Roll';
                const matCode = rawMat?.code || '';

                for (const r of (grn.rolls || [])) {
                    if (remainingToAllocate <= 0) break;
                    const rIdStr = String(r._id);
                    const rNumStr = String(r.rollNumber || '').trim().toUpperCase();
                    const totalMeters = Number(r.fabricLength || 0);
                    if (totalMeters <= 0) continue;

                    const previouslyUsed = consumptionMap[rIdStr] || consumptionMap[rNumStr] || 0;
                    const availableRemaining = Math.max(0, totalMeters - previouslyUsed);

                    if (availableRemaining > 0) {
                        const allocateFromThisRoll = Math.min(availableRemaining, remainingToAllocate);
                        const rollNetWeight = Number(r.netWeight || 0);
                        const consumedWeight = totalMeters > 0 && rollNetWeight > 0 ? Number(((allocateFromThisRoll / totalMeters) * rollNetWeight).toFixed(2)) : null;

                        finalAllocatedRolls.push({
                            rollId: r._id,
                            rollNumber: r.rollNumber,
                            materialName: matName,
                            materialCode: matCode,
                            grnId: grn._id,
                            grnNumber: grn.grnNumber,
                            poNumber: poNum,
                            supplierName: suppName,
                            consumedLength: allocateFromThisRoll,
                            consumedWeightKg: consumedWeight,
                            remainingMeters: availableRemaining - allocateFromThisRoll,
                            usedMeters: previouslyUsed + allocateFromThisRoll,
                            fabricLength: totalMeters,
                            width: r.width != null ? Number(r.width) : null,
                            grossWeight: r.grossWeight != null ? Number(r.grossWeight) : null,
                            netWeight: rollNetWeight || null,
                            totalQuantityKg: r.totalQuantityKg != null ? Number(r.totalQuantityKg) : null,
                            totalQuantityPcs: r.totalQuantityPcs != null ? Number(r.totalQuantityPcs) : null
                        });

                        remainingToAllocate -= allocateFromThisRoll;
                        consumptionMap[rIdStr] = (consumptionMap[rIdStr] || 0) + allocateFromThisRoll;
                        if (rNumStr) consumptionMap[rNumStr] = (consumptionMap[rNumStr] || 0) + allocateFromThisRoll;
                    }
                }
            }
        }

        const jobOrderDetails = {
            rolls: finalAllocatedRolls,
            orderDate: rawJobDetails.orderDate ? new Date(rawJobDetails.orderDate) : new Date(),
            productCategory: rawJobDetails.productCategory || 'Print',
            printSpec: rawJobDetails.printSpec || {
                printSides: rawJobDetails.printSides || (rawJobDetails.productCategory === 'Plain' ? 'NONE' : 'BOTH'),
                frontColours: Number(rawJobDetails.frontColours) || 0,
                backColours: Number(rawJobDetails.backColours) || 0
            },
            printSides: rawJobDetails.printSides || rawJobDetails.printSpec?.printSides || '',
            frontColours: rawJobDetails.frontColours !== undefined ? Number(rawJobDetails.frontColours) : (rawJobDetails.printSpec?.frontColours || 0),
            backColours: rawJobDetails.backColours !== undefined ? Number(rawJobDetails.backColours) : (rawJobDetails.printSpec?.backColours || 0),
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
                : [],
            description: incomingDescription,
            remarks: incomingRemarks
        };

        // Step C: Create WorkOrder document
        const woUnit = req.body.unit || rawJobDetails.totalOrderQuantityUnit || 'Bags';
        const woDocs = await WorkOrder.create([{
            tenant: tenantId,
            workOrderNumber,
            description: incomingDescription,
            remarks: incomingRemarks,
            customer,
            finishedGood,
            bom: activeBom._id,
            targetQuantity: numTargetQty,
            unit: woUnit,
            completedQuantity: 0,
            priority: priority || 'MEDIUM',
            status: 'IN_PROGRESS',
            assignedMachine: assignedMachine || null,
            assignedOperators: Array.isArray(req.body.assignedOperators) ? req.body.assignedOperators.filter(Boolean) : (Array.isArray(rawJobDetails.assignedOperators) ? rawJobDetails.assignedOperators.filter(Boolean) : []),
            stages,
            jobOrderDetails: {
                ...jobOrderDetails,
                totalOrderQuantityUnit: rawJobDetails.totalOrderQuantityUnit || woUnit,
                assignedOperators: Array.isArray(req.body.assignedOperators) ? req.body.assignedOperators.filter(Boolean) : (Array.isArray(rawJobDetails.assignedOperators) ? rawJobDetails.assignedOperators.filter(Boolean) : [])
            },
            inks: Array.isArray(req.body.inks) ? req.body.inks.filter(Boolean) : (Array.isArray(req.body.inksRequired) ? req.body.inksRequired : []),
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

    const { goodOutputQty, rejectedQty, wastageKg, returnToStore, notes, operatorAllocations: rawAllocations, operatorBreakdown } = req.body;

    const numRejectedQty = Number(rejectedQty || 0);

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
        const query = WorkOrder.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('assignedOperators', 'name employeeCode department')
            .populate('jobOrderDetails.assignedOperators', 'name employeeCode department')
            .populate({
                path: 'assignedMachine',
                populate: [
                    { path: 'currentOperators', select: 'name employeeCode department' },
                    { path: 'currentOperator', select: 'name employeeCode department' }
                ]
            })
            .populate('stages.machine', 'name code currentOperators currentOperator');
        if (useTransaction && session) query.session(session);
        const workOrder = await query;

        if (!workOrder) {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(404).json({ success: false, message: 'Work Order not found.' });
        }

        const woStatusUpper = String(workOrder.status || '').toUpperCase();
        if (woStatusUpper === 'COMPLETED' || woStatusUpper === 'CANCELLED' || woStatusUpper === 'REJECTED') {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            const statusLabel = woStatusUpper === 'COMPLETED' ? 'Completed' : (woStatusUpper === 'CANCELLED' ? 'Cancelled' : 'Rejected');
            return res.status(400).json({
                success: false,
                message: `Cannot advance stage on a ${statusLabel} Work Order.`
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

        // HARD LIMIT & VALIDATION: Get stage production status from single source of truth
        const stageStatus = await getStageProductionStatus(
            tenantId,
            workOrder._id,
            currentStage.stageName,
            sessionOption
        );

        const totalStageQty = stageStatus ? stageStatus.totalProduced : 0;

        if (totalStageQty <= 0) {
            if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
            return res.status(400).json({
                success: false,
                message: 'Cannot advance stage: No production has been logged for this stage yet. Log operator production in the tracker before advancing.'
            });
        }

        const finalRejectedQty = Math.max(0, Number(req.body.rejectedQty) || 0);
        const wastageKgVal = req.body.wastageKg !== undefined ? Math.max(0, Number(req.body.wastageKg) || 0) : (currentStage.wastageKg || 0);
        const returnToStoreVal = req.body.returnToStore !== undefined ? Math.max(0, Number(req.body.returnToStore) || 0) : (currentStage.returnToStore || 0);

        // 1. Complete current stage
        currentStage.goodOutputQty = totalStageQty;
        currentStage.completedQuantity = totalStageQty;
        currentStage.rejectedQty = finalRejectedQty;
        currentStage.wastageKg = wastageKgVal;
        currentStage.returnToStore = returnToStoreVal;

        if (currentStage.stageName === 'BALING_PACKING' || currentStage.sequence === 8) {
            const pcsVal = req.body.balingQuantityPcs !== undefined ? req.body.balingQuantityPcs : req.body.quantityPcs;
            const weightVal = req.body.balingTotalWeightKg !== undefined ? req.body.balingTotalWeightKg : req.body.totalWeightKg;
            if (pcsVal !== undefined && pcsVal !== '' && pcsVal !== null) {
                currentStage.balingQuantityPcs = Number(pcsVal);
            }
            if (weightVal !== undefined && weightVal !== '' && weightVal !== null) {
                currentStage.balingTotalWeightKg = Number(weightVal);
            }
        }

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
            const previousCompletedOutput = Number(workOrder.completedQuantity || 0);
            const incrementalOutput = Math.max(0, totalStageQty - previousCompletedOutput);

            if (incrementalOutput > 0) {
                const txnResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: workOrder.workOrderNumber,
                    itemType: 'FINISHED_GOOD',
                    item: workOrder.finishedGood,
                    transactionType: 'PRODUCTION_OUTPUT_PENDING_QC',
                    quantity: incrementalOutput,
                    notes: notes || `Finished Good production output pending QC inspection (${incrementalOutput} bags from WorkOrder ${workOrder.workOrderNumber})`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                outputTxn = txnResult.transaction;
            }

            // Auto-complete Work Order on final stage completion
            const effectiveCompleted = Math.min(totalStageQty, stageStatus?.targetQuantity ?? totalStageQty);
            workOrder.completedQuantity = effectiveCompleted;
            workOrder.status = 'COMPLETED';
            workOrder.progressPercentage = 100;

            // Compute balance / shortfall quantity
            const targetQty = Number(workOrder.targetQuantity || 0);
            const shortfall = Math.max(0, targetQty - effectiveCompleted);
            workOrder.balanceQuantity = shortfall;
            workOrder.balanceStatus = shortfall > 0 ? 'PENDING' : 'RESOLVED';
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

        await workOrder.save({
            validateModifiedOnly: true,
            ...(sessionOption.session ? { session: sessionOption.session } : {})
        });

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
            filter.$or = [
                { workOrderNumber: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { remarks: { $regex: search, $options: 'i' } },
                { 'jobOrderDetails.description': { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [workOrders, total] = await Promise.all([
            WorkOrder.find(filter)
                .populate('customer', 'companyName code')
                .populate('finishedGood', 'name code')
                .populate('parentWorkOrder', 'workOrderNumber targetQuantity completedQuantity status')
                .populate('continuationWorkOrder', 'workOrderNumber targetQuantity completedQuantity status')
                .populate({
                    path: 'assignedMachine',
                    select: 'name code currentOperators currentOperator',
                    populate: [
                        { path: 'currentOperators', select: 'name employeeCode department' },
                        { path: 'currentOperator', select: 'name employeeCode department' }
                    ]
                })
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
 * Helper to build comprehensive rolls dataset with complete inward & consumption traceability
 */
const buildRollsTraceabilityData = async (tenantId) => {
    const tenantObjId = new mongoose.Types.ObjectId(tenantId);
    const GRN = require('../models/grn.model');

    const grns = await GRN.find({
        tenant: tenantObjId,
        'rolls.0': { $exists: true }
    })
        .populate('purchaseOrder', 'poNumber orderDate status')
        .populate('supplier', 'name code')
        .populate('items.rawMaterial', 'name code category uom color colors materialDescription materialQualityFabric laminationType fabricGrammage materialColour materialGrade')
        .sort({ receivedDate: -1, createdAt: -1 })
        .lean();

    // Fetch all Work Orders (except CANCELLED) that have rolls allocated
    const workOrders = await WorkOrder.find({
        tenant: tenantObjId,
        status: { $ne: 'CANCELLED' },
        'jobOrderDetails.rolls.0': { $exists: true }
    })
        .select('workOrderNumber customer finishedGood targetQuantity completedQuantity status createdAt jobOrderDetails.rolls')
        .populate('customer', 'name companyName code')
        .populate('finishedGood', 'name code')
        .sort({ createdAt: -1 })
        .lean();

    // Build roll consumption map with Work Order references
    const rollUsageMap = {};
    for (const wo of workOrders) {
        const custName = wo.customer?.companyName || wo.customer?.name || 'Standard Client';
        const fgName = wo.finishedGood?.name || wo.finishedGood?.code || '';
        const woRolls = wo.jobOrderDetails?.rolls || [];

        for (const r of woRolls) {
            const consumedM = Number(r.consumedLength != null ? r.consumedLength : (r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : 0))) || 0;
            const consumedKg = Number(r.consumedWeightKg != null ? r.consumedWeightKg : (r.netWeight != null ? r.netWeight : (r.grossWeight != null ? r.grossWeight : 0))) || 0;

            const usageEntry = {
                workOrderId: wo._id,
                workOrderNumber: wo.workOrderNumber,
                customerName: custName,
                finishedGoodName: fgName,
                targetQuantity: Number(wo.targetQuantity || 0),
                completedQuantity: Number(wo.completedQuantity || 0),
                consumedMeters: consumedM,
                consumedWeightKg: consumedKg,
                status: wo.status,
                allocatedAt: wo.createdAt
            };

            const idKey = r.rollId ? String(r.rollId) : (r._id ? String(r._id) : '');
            const numKey = String(r.rollNumber || r.rollNo || '').trim().toUpperCase();

            if (idKey) {
                if (!rollUsageMap[idKey]) rollUsageMap[idKey] = [];
                rollUsageMap[idKey].push(usageEntry);
            }
            if (numKey) {
                if (!rollUsageMap[numKey]) rollUsageMap[numKey] = [];
                rollUsageMap[numKey].push(usageEntry);
            }
        }
    }

    const allRolls = [];
    for (const grn of grns) {
        const poNum = grn.purchaseOrder?.poNumber || grn.poNumber || '';
        const suppName = grn.supplier?.name || '';
        const suppCode = grn.supplier?.code || '';
        const rawMat = grn.items?.[0]?.rawMaterial;
        const matName = rawMat?.name || 'Woven Fabric Roll';
        const matCode = rawMat?.code || '';
        const matUom = rawMat?.uom || 'Kg';
        const color = rawMat?.materialColour || rawMat?.color || (Array.isArray(rawMat?.colors) ? rawMat.colors[0] : '') || '';
        const materialQualityFabric = rawMat?.materialQualityFabric || '';
        const laminationType = rawMat?.laminationType || '';
        const fabricGrammage = rawMat?.fabricGrammage || '';
        const materialGrade = rawMat?.materialGrade || '';

        for (const r of (grn.rolls || [])) {
            const rollIdStr = String(r._id);
            const rollNumStr = String(r.rollNumber || '').trim().toUpperCase();
            const totalMeters = Number(r.fabricLength || 0);
            const totalNetWeight = Number(r.netWeight || r.grossWeight || 0);
            const totalGrossWeight = Number(r.grossWeight || r.netWeight || 0);

            // Deduplicate WO usage entries
            const rawUsageList = [...(rollUsageMap[rollIdStr] || []), ...(rollUsageMap[rollNumStr] || [])];
            const seenWoIds = new Set();
            const consumedByWorkOrders = [];
            let usedMeters = 0;
            let usedWeightKg = 0;

            for (const u of rawUsageList) {
                const woKey = String(u.workOrderId);
                if (!seenWoIds.has(woKey)) {
                    seenWoIds.add(woKey);
                    consumedByWorkOrders.push(u);
                    usedMeters += Number(u.consumedMeters || 0);
                    usedWeightKg += Number(u.consumedWeightKg || 0);
                }
            }

            const remainingMeters = Math.max(0, totalMeters - usedMeters);
            const remainingWeightKg = Math.max(0, totalNetWeight - usedWeightKg);

            let status = 'AVAILABLE';
            if (remainingMeters <= 0 && totalMeters > 0) {
                status = 'FULLY_CONSUMED';
            } else if (usedMeters > 0) {
                status = 'PARTIALLY_USED';
            }

            const fabricAverage = r.fabricAverage != null ? r.fabricAverage : (grn.items?.[0]?.fabricAverage != null ? grn.items[0].fabricAverage : null);

            allRolls.push({
                _id: r._id,
                rollId: r._id,
                rollNo: r.rollNumber,
                rollNumber: r.rollNumber,
                materialName: matName,
                materialCode: matCode,
                uom: matUom,
                color,
                materialQualityFabric,
                laminationType,
                fabricGrammage,
                materialGrade,
                materialDescription: rawMat?.materialDescription || '',
                grnId: grn._id,
                grnNumber: grn.grnNumber,
                receivedDate: grn.receivedDate,
                poNumber: poNum,
                supplierName: suppName,
                supplierCode: suppCode,
                totalMeters,
                usedMeters,
                remainingMeters,
                grossWeight: totalGrossWeight,
                netWeight: totalNetWeight,
                usedWeightKg,
                remainingWeightKg,
                width: r.width != null ? r.width : null,
                fabricAverage,
                totalQuantityKg: r.totalQuantityKg != null ? r.totalQuantityKg : null,
                totalQuantityPcs: r.totalQuantityPcs != null ? r.totalQuantityPcs : null,
                status,
                consumedByWorkOrders
            });
        }
    }

    return allRolls;
};

/**
 * @desc    Get raw material rolls with available remaining stock
 * @route   GET /api/work-orders/available-rolls
 * @access  Private (PRODUCTION:READ permission)
 */
const getAvailableRolls = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const allRolls = await buildRollsTraceabilityData(tenantId);
        const includeAll = req.query.all === 'true';
        let filteredRolls = includeAll ? allRolls : allRolls.filter((r) => Number(r.remainingMeters) > 0);

        const { search, limit, page } = req.query;

        if (search && String(search).trim()) {
            const s = String(search).trim().toLowerCase();
            const terms = s.split(/\s+/).filter(Boolean);

            filteredRolls = filteredRolls.filter((r) => {
                const rollNo = String(r.rollNo || r.rollNumber || '').toLowerCase();
                const matName = String(r.materialName || '').toLowerCase();
                const matCode = String(r.materialCode || '').toLowerCase();
                const color = String(r.color || '').toLowerCase();
                const quality = String(r.materialQualityFabric || '').toLowerCase();
                const lamination = String(r.laminationType || '').toLowerCase();
                const grammage = String(r.fabricGrammage || '').toLowerCase();
                const gsm = r.fabricAverage != null ? `${r.fabricAverage} gsm ${r.fabricAverage}`.toLowerCase() : '';
                const width = r.width != null ? `${r.width} inch ${r.width}" ${r.width}`.toLowerCase() : '';
                const grossWeight = r.grossWeight != null ? `${r.grossWeight} kg ${r.grossWeight}`.toLowerCase() : '';
                const grnNum = String(r.grnNumber || '').toLowerCase();
                const supp = String(r.supplierName || '').toLowerCase();

                const combined = `${rollNo} ${matName} ${matCode} ${color} ${quality} ${lamination} ${grammage} ${gsm} ${width} ${grossWeight} ${grnNum} ${supp}`;

                return terms.every(term => combined.includes(term));
            });
        }

        const totalCount = filteredRolls.length;

        // Apply pagination / limit (default limit to 20 if search is performed or limit is requested)
        const limitNum = limit !== undefined ? parseInt(limit, 10) : (includeAll ? null : 20);
        if (limitNum && !isNaN(limitNum) && limitNum > 0) {
            const pg = parseInt(page, 10) || 1;
            const skip = (pg - 1) * limitNum;
            filteredRolls = filteredRolls.slice(skip, skip + limitNum);
        }

        return res.status(200).json({
            success: true,
            total: totalCount,
            count: filteredRolls.length,
            data: filteredRolls
        });
    } catch (error) {
        console.error('Error in getAvailableRolls:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve available rolls.',
            error: error.message
        });
    }
};

/**
 * @desc    Get complete roll traceability ledger (all rolls with inward GRN details and linked Work Orders)
 * @route   GET /api/work-orders/rolls-traceability
 * @access  Private (PRODUCTION:READ / INVENTORY:READ permission)
 */
const getRollsTraceability = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const allRolls = await buildRollsTraceabilityData(tenantId);

        let rolls = allRolls;
        const { status, search } = req.query;

        if (status) {
            rolls = rolls.filter((r) => r.status === status.toUpperCase());
        }

        if (search) {
            const s = String(search).toLowerCase();
            rolls = rolls.filter((r) =>
                (r.rollNumber && r.rollNumber.toLowerCase().includes(s)) ||
                (r.grnNumber && r.grnNumber.toLowerCase().includes(s)) ||
                (r.poNumber && r.poNumber.toLowerCase().includes(s)) ||
                (r.materialName && r.materialName.toLowerCase().includes(s)) ||
                (r.supplierName && r.supplierName.toLowerCase().includes(s))
            );
        }

        const availableCount = allRolls.filter(r => r.status === 'AVAILABLE').length;
        const partiallyUsedCount = allRolls.filter(r => r.status === 'PARTIALLY_USED').length;
        const fullyConsumedCount = allRolls.filter(r => r.status === 'FULLY_CONSUMED').length;
        const totalMetersInward = allRolls.reduce((acc, r) => acc + (r.totalMeters || 0), 0);
        const totalMetersConsumed = allRolls.reduce((acc, r) => acc + (r.usedMeters || 0), 0);
        const totalMetersRemaining = allRolls.reduce((acc, r) => acc + (r.remainingMeters || 0), 0);

        return res.status(200).json({
            success: true,
            count: rolls.length,
            summary: {
                totalRolls: allRolls.length,
                availableCount,
                partiallyUsedCount,
                fullyConsumedCount,
                totalMetersInward,
                totalMetersConsumed,
                totalMetersRemaining
            },
            data: rolls
        });
    } catch (error) {
        console.error('Error in getRollsTraceability:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve rolls traceability ledger.',
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
            .populate('assignedOperators', 'name employeeCode department')
            .populate('jobOrderDetails.assignedOperators', 'name employeeCode department')
            .populate('parentWorkOrder', 'workOrderNumber targetQuantity completedQuantity status')
            .populate('continuationWorkOrder', 'workOrderNumber targetQuantity completedQuantity status')
            .populate({
                path: 'assignedMachine',
                select: 'name code section status currentOperators currentOperator',
                populate: [
                    { path: 'currentOperators', select: 'name employeeCode department' },
                    { path: 'currentOperator', select: 'name employeeCode department' }
                ]
            })
            .populate('stages.machine', 'name code section currentOperators currentOperator');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        // Synchronize stage completedQuantity and goodOutputQty with ProductionLog entries
        if (Array.isArray(workOrder.stages) && workOrder.stages.length > 0) {
            const tenantObjId = new mongoose.Types.ObjectId(tenantId);
            const stageLogsAgg = await ProductionLog.aggregate([
                {
                    $match: {
                        tenant: tenantObjId,
                        workOrder: workOrder._id
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ['$stage', '$stageName'] },
                        totalQty: { $sum: '$quantity' }
                    }
                }
            ]);

            const logMap = {};
            stageLogsAgg.forEach((item) => {
                if (item._id) {
                    logMap[String(item._id).toUpperCase()] = Number(item.totalQty || 0);
                }
            });

            let hasChange = false;
            const nonSkippedStages = workOrder.stages.filter((s) => s.status !== 'SKIPPED');
            let runningBottleneck = Number(workOrder.targetQuantity || 0);

            for (let i = 0; i < nonSkippedStages.length; i++) {
                const st = nonSkippedStages[i];
                const key = String(st.stageName || '').toUpperCase();
                const rawLogQty = logMap[key];
                const totalQty = rawLogQty !== undefined ? rawLogQty : Number(st.completedQuantity || st.goodOutputQty || 0);

                if (st.completedQuantity !== totalQty || st.goodOutputQty !== totalQty) {
                    st.completedQuantity = totalQty;
                    st.goodOutputQty = totalQty;
                    hasChange = true;
                }

                // Cumulative bottleneck: each stage can at most produce what came into it
                runningBottleneck = Math.min(runningBottleneck, totalQty);
            }

            const finalStage = workOrder.stages.find((s) => s.sequence === 8 || s.stageName === 'BALING_PACKING') || nonSkippedStages[nonSkippedStages.length - 1];
            const rawFinalLogQty = finalStage ? (logMap[String(finalStage.stageName || '').toUpperCase()] !== undefined ? logMap[String(finalStage.stageName || '').toUpperCase()] : Number(finalStage.completedQuantity || 0)) : 0;
            const effectiveCompleted = Math.min(runningBottleneck, rawFinalLogQty);

            if (workOrder.completedQuantity !== effectiveCompleted) {
                workOrder.completedQuantity = effectiveCompleted;
                hasChange = true;
            }

            const targetQty = Number(workOrder.targetQuantity || 0);
            const shortfall = Math.max(0, targetQty - effectiveCompleted);
            if (workOrder.balanceQuantity !== shortfall) {
                workOrder.balanceQuantity = shortfall;
                hasChange = true;
            }
            // Only auto-set balanceStatus to PENDING/RESOLVED if it's not already in a special lifecycle state
            const specialBalanceStatuses = ['CONTINUED', 'PENDING_APPROVAL', 'REJECTED'];
            if (!specialBalanceStatuses.includes(workOrder.balanceStatus)) {
                const expectedBalanceStatus = shortfall > 0 ? 'PENDING' : 'RESOLVED';
                if (workOrder.balanceStatus !== expectedBalanceStatus) {
                    workOrder.balanceStatus = expectedBalanceStatus;
                    hasChange = true;
                }
            }

            if (hasChange) {
                await workOrder.save();
            }
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

/**
 * @desc    Update stage-specific specification (e.g. Baling & Packing weight specification)
 * @route   PATCH /api/work-orders/:id/stage-spec
 * @access  Private (PRODUCTION:UPDATE permission)
 */
const updateStageSpec = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }

        const { stageName = 'BALING_PACKING', balingQuantityPcs, balingTotalWeightKg, quantityPcs, totalWeightKg } = req.body;

        const workOrder = await WorkOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!workOrder) {
            return res.status(404).json({ success: false, message: 'Work Order not found.' });
        }

        const stage = workOrder.stages.find(s => s.stageName === stageName || (stageName === 'BALING_PACKING' && s.sequence === 8));
        if (!stage) {
            return res.status(404).json({ success: false, message: `Stage '${stageName}' not found on this Work Order.` });
        }

        const pcsVal = balingQuantityPcs !== undefined ? balingQuantityPcs : quantityPcs;
        const weightVal = balingTotalWeightKg !== undefined ? balingTotalWeightKg : totalWeightKg;

        if (pcsVal !== undefined) {
            stage.balingQuantityPcs = pcsVal !== '' && pcsVal !== null ? Number(pcsVal) : null;
        }
        if (weightVal !== undefined) {
            stage.balingTotalWeightKg = weightVal !== '' && weightVal !== null ? Number(weightVal) : null;
        }

        await workOrder.save({ validateModifiedOnly: true });

        return res.status(200).json({
            success: true,
            message: 'Stage specification updated successfully.',
            data: {
                workOrder,
                stage
            }
        });
    } catch (error) {
        console.error('Error in updateStageSpec:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update stage specification.'
        });
    }
};

/**
 * @desc    Resume / Continue balance production — creates a Pending Approval instead of auto-creating the WO.
 * @route   PATCH /api/work-orders/:id/resume-balance
 * @access  Private (PRODUCTION:UPDATE permission)
 */
const resumeBalanceProduction = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }

        const workOrder = await WorkOrder.findOne({ _id: req.params.id, tenant: tenantId });
        if (!workOrder) {
            return res.status(404).json({ success: false, message: 'Work Order not found.' });
        }

        if (workOrder.status === 'CANCELLED') {
            return res.status(400).json({ success: false, message: 'Cannot resume a cancelled Work Order.' });
        }

        // If a continuation WO already exists, return info
        if (workOrder.continuationWorkOrder) {
            return res.status(409).json({
                success: false,
                message: 'A Continuation Work Order already exists for this Work Order.'
            });
        }

        // If already pending approval, do not create a duplicate
        if (workOrder.balanceStatus === 'PENDING_APPROVAL') {
            const Approval = require('../models/approval.model');
            const existingApproval = await Approval.findOne({
                tenant: tenantId,
                type: 'CONTINUATION_WO',
                referenceId: workOrder._id,
                status: 'Pending'
            }).lean();
            return res.status(409).json({
                success: false,
                message: 'A continuation approval request is already pending for this Work Order.',
                approvalId: existingApproval?._id
            });
        }

        const target = Number(workOrder.targetQuantity || 0);
        const completed = Number(workOrder.completedQuantity || 0);
        let pendingBalance = Number(workOrder.balanceQuantity || 0);
        if (pendingBalance <= 0 && completed < target) {
            pendingBalance = target - completed;
        }

        if (pendingBalance <= 0) {
            return res.status(400).json({
                success: false,
                message: 'This Work Order has no pending balance quantity to produce (target was already reached).'
            });
        }

        // Create the Pending Approval request — do NOT create the continuation WO yet
        const { createContinuationWoApprovalRequest } = require('../services/approval.service');
        const requestingUser = req.user;
        const approval = await createContinuationWoApprovalRequest(workOrder, requestingUser, pendingBalance);

        if (!approval) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create approval request for Continuation Work Order.'
            });
        }

        // Mark balanceStatus = PENDING_APPROVAL on the parent WO
        workOrder.balanceQuantity = pendingBalance;
        workOrder.balanceStatus = 'PENDING_APPROVAL';
        await workOrder.save({ validateModifiedOnly: true });

        return res.status(200).json({
            success: true,
            message: 'Continuation request submitted for Tenant Admin approval. The Continuation Work Order will be created once approved.',
            data: {
                workOrderId: workOrder._id,
                workOrderNumber: workOrder.workOrderNumber,
                balanceQuantity: pendingBalance,
                balanceStatus: 'PENDING_APPROVAL',
                approvalId: approval._id,
                approvalNo: approval.approvalNo
            }
        });
    } catch (error) {
        console.error('Error in resumeBalanceProduction:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to submit continuation request.'
        });
    }
};

/**
 * Core function: actually create the Continuation Work Order.
 * Called by the CONTINUATION_WO approval handler (onApprove) — NEVER called directly on button click.
 */
const createContinuationWorkOrderCore = async (parentWorkOrderId, tenantId, session = null) => {
    const sessionOption = session ? { session } : {};

    const workOrder = await WorkOrder.findOne({ _id: parentWorkOrderId, tenant: tenantId })
        .populate('customer', 'companyName code contactPerson phone')
        .populate('finishedGood', 'name code unit')
        .populate('assignedMachine', 'name code')
        .populate('stages.machine', 'name code')
        .populate('continuationWorkOrder');

    if (!workOrder) throw new Error('Work Order not found.');
    if (workOrder.status === 'CANCELLED') throw new Error('Cannot resume a cancelled Work Order.');

    if (workOrder.continuationWorkOrder) {
        const existingCont = await WorkOrder.findById(workOrder.continuationWorkOrder._id || workOrder.continuationWorkOrder);
        if (existingCont) return existingCont;
    }

    const target = Number(workOrder.targetQuantity || 0);
    const completed = Number(workOrder.completedQuantity || 0);
    let pendingBalance = Number(workOrder.balanceQuantity || 0);
    if (pendingBalance <= 0 && completed < target) {
        pendingBalance = target - completed;
        workOrder.balanceQuantity = pendingBalance;
    }
    if (pendingBalance <= 0) throw new Error('This Work Order has no pending balance quantity to produce.');

    const newWorkOrderNumber = await generateWorkOrderNumber(tenantId);

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
    if (startingIndex === -1) startingIndex = 3;

    const tenantObjId = new mongoose.Types.ObjectId(tenantId);
    let parentStageLogsQuery = ProductionLog.aggregate([
        { $match: { tenant: tenantObjId, workOrder: workOrder._id } },
        { $group: { _id: { $ifNull: ['$stage', '$stageName'] }, total: { $sum: '$quantity' } } }
    ]);
    if (session) parentStageLogsQuery = parentStageLogsQuery.session(session);
    const parentStageLogs = await parentStageLogsQuery;

    const parentOutputMap = {};
    (parentStageLogs || []).forEach((row) => {
        if (row._id) parentOutputMap[String(row._id).toUpperCase()] = Number(row.total || 0);
    });

    const parentStages = Array.isArray(workOrder.stages) ? workOrder.stages : [];
    const directParentTargetQty = Number(workOrder.targetQuantity || 0);

    // Find first stage (in pipeline order) where DIRECT PARENT's actual output was less than DIRECT PARENT's own target
    let shortfallStartIndex = -1;
    for (let i = startingIndex; i < ALL_STAGE_NAMES.length; i++) {
        const sName = ALL_STAGE_NAMES[i];
        const sDoc = parentStages.find((s) => s.stageName === sName);

        // Inactive stage in parent pipeline
        if (sDoc && sDoc.status === 'SKIPPED' && !sDoc.isInherited) {
            continue;
        }

        // If stage was already inherited in direct parent, it was already at 100% full target for direct parent
        if (sDoc && sDoc.isInherited) {
            continue;
        }

        // Stage ran in direct parent: compare direct parent's actual output against direct parent's own target
        const logQty = parentOutputMap[sName];
        const actualOutput = logQty !== undefined ? logQty : Number(sDoc?.goodOutputQty || sDoc?.completedQuantity || 0);
        if (actualOutput < directParentTargetQty) {
            shortfallStartIndex = i;
            break;
        }
    }
    // If every evaluated stage reached directParentTargetQty, the shortfall must be at the final stage
    if (shortfallStartIndex === -1) {
        shortfallStartIndex = ALL_STAGE_NAMES.length - 1;
    }

    const now = new Date();
    const newStages = ALL_STAGE_NAMES.map((stageName, index) => {
        const sequence = index + 1;
        if (index < startingIndex) {
            return { stageName, sequence, status: 'SKIPPED', goodOutputQty: 0, rejectedQty: 0, isInherited: false };
        } else if (index < shortfallStartIndex) {
            const sDoc = parentStages.find((s) => s.stageName === stageName);
            const logQty = parentOutputMap[stageName];
            const actualOutput = sDoc?.isInherited
                ? directParentTargetQty
                : (logQty !== undefined ? logQty : Number(sDoc?.goodOutputQty || sDoc?.completedQuantity || directParentTargetQty));
            return {
                stageName, sequence, status: 'SKIPPED',
                goodOutputQty: actualOutput || directParentTargetQty,
                completedQuantity: actualOutput || directParentTargetQty,
                rejectedQty: 0, isInherited: true,
                inheritedFrom: workOrder.workOrderNumber,
                inheritedQuantity: actualOutput || directParentTargetQty
            };
        } else if (index === shortfallStartIndex) {
            return {
                stageName, sequence, status: 'ACTIVE', startedAt: now,
                machine: workOrder.assignedMachine?._id || workOrder.assignedMachine || null,
                goodOutputQty: 0, rejectedQty: 0, isInherited: false
            };
        } else {
            return { stageName, sequence, status: 'PENDING', goodOutputQty: 0, rejectedQty: 0, isInherited: false };
        }
    });

    const origJOD = workOrder.jobOrderDetails ? (workOrder.jobOrderDetails.toObject ? workOrder.jobOrderDetails.toObject() : workOrder.jobOrderDetails) : {};
    const woUnit = workOrder.unit || origJOD.totalOrderQuantityUnit || 'Bags';
    const continuationJOD = {
        ...origJOD,
        totalOrderQuantity: pendingBalance,
        totalOrderQuantityUnit: woUnit,
        description: `Continuation of ${workOrder.workOrderNumber} (Balance: ${pendingBalance.toLocaleString('en-IN')} ${woUnit})`,
        remarks: `Continuation of ${workOrder.workOrderNumber}`
    };

    const [newWorkOrder] = await WorkOrder.create([{
        tenant: tenantId,
        workOrderNumber: newWorkOrderNumber,
        customer: workOrder.customer?._id || workOrder.customer,
        finishedGood: workOrder.finishedGood?._id || workOrder.finishedGood,
        bom: workOrder.bom,
        targetQuantity: pendingBalance,
        unit: woUnit,
        completedQuantity: 0,
        balanceQuantity: 0,
        balanceStatus: 'RESOLVED',
        priority: workOrder.priority || 'MEDIUM',
        status: 'IN_PROGRESS',
        assignedMachine: workOrder.assignedMachine?._id || workOrder.assignedMachine || null,
        assignedOperators: workOrder.assignedOperators || [],
        description: `Continuation of ${workOrder.workOrderNumber} (Balance: ${pendingBalance.toLocaleString('en-IN')} ${woUnit})`,
        remarks: `Continuation of ${workOrder.workOrderNumber}`,
        parentWorkOrder: workOrder._id,
        stages: newStages,
        jobOrderDetails: continuationJOD,
        inks: workOrder.inks || []
    }], sessionOption);

    // Link continuation on parent WO
    workOrder.continuationWorkOrder = newWorkOrder._id;
    workOrder.balanceStatus = 'CONTINUED';
    workOrder.continuationApprovalRemarks = '';
    if (sessionOption.session) {
        await workOrder.save({ validateModifiedOnly: true, session: sessionOption.session });
    } else {
        await workOrder.save({ validateModifiedOnly: true });
    }

    return newWorkOrder;
};

/**
 * @desc    Update an existing Work Order (Tenant Admin only)
 * @route   PUT /api/work-orders/:id
 * @access  Private (Tenant Admin only)
 */
const updateWorkOrder = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

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

        const {
            customer,
            finishedGood,
            targetQuantity,
            priority,
            assignedMachine,
            assignedOperators,
            description,
            remarks,
            inks,
            jobOrderDetails
        } = req.body;

        if (customer) {
            const customerDoc = await Customer.findOne({ _id: customer, tenant: tenantId });
            if (!customerDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer not found or does not belong to this tenant.'
                });
            }
            workOrder.customer = customer;
        }

        if (finishedGood) {
            const fgDoc = await FinishedGood.findOne({ _id: finishedGood, tenant: tenantId });
            if (!fgDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Finished Good not found or does not belong to this tenant.'
                });
            }
            workOrder.finishedGood = finishedGood;
        }

        if (targetQuantity !== undefined) {
            const numTarget = Number(targetQuantity);
            if (isNaN(numTarget) || numTarget < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'targetQuantity must be at least 1.'
                });
            }
            workOrder.targetQuantity = numTarget;
            if (workOrder.status === 'COMPLETED') {
                const diff = numTarget - (workOrder.completedQuantity || 0);
                workOrder.balanceQuantity = Math.max(0, diff);
                workOrder.balanceStatus = workOrder.balanceQuantity > 0 ? 'PENDING' : 'RESOLVED';
            }
        }

        if (priority) {
            workOrder.priority = priority;
        }

        if (assignedMachine !== undefined) {
            if (assignedMachine) {
                const machineDoc = await Machine.findOne({ _id: assignedMachine, tenant: tenantId });
                if (!machineDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Assigned Machine not found or does not belong to this tenant.'
                    });
                }
                workOrder.assignedMachine = assignedMachine;
                const activeStage = workOrder.stages.find(s => s.status === 'ACTIVE');
                if (activeStage && !activeStage.machine) {
                    activeStage.machine = assignedMachine;
                }
            } else {
                workOrder.assignedMachine = null;
            }
        }

        if (assignedOperators !== undefined) {
            const validOps = await getValidOperatorIds(assignedOperators, tenantId);
            workOrder.assignedOperators = validOps;
        }

        if (description !== undefined) {
            workOrder.description = description;
        }

        if (remarks !== undefined) {
            workOrder.remarks = remarks;
        }

        if (inks !== undefined && Array.isArray(inks)) {
            workOrder.inks = inks.filter(i => i && String(i).trim() !== '').map(i => String(i).trim());
        }

        if (req.body.unit) {
            workOrder.unit = req.body.unit;
        }

        if (jobOrderDetails && typeof jobOrderDetails === 'object') {
            const currentJOD = workOrder.jobOrderDetails ? (workOrder.jobOrderDetails.toObject ? workOrder.jobOrderDetails.toObject() : workOrder.jobOrderDetails) : {};
            const updatedJOD = {
                ...currentJOD,
                ...jobOrderDetails
            };
            if (jobOrderDetails.assignedOperators !== undefined) {
                updatedJOD.assignedOperators = await getValidOperatorIds(jobOrderDetails.assignedOperators, tenantId);
            }
            if (jobOrderDetails.totalOrderQuantityUnit) {
                workOrder.unit = req.body.unit || jobOrderDetails.totalOrderQuantityUnit;
            }
            workOrder.jobOrderDetails = updatedJOD;
        }

        await workOrder.save();

        const updatedWorkOrder = await WorkOrder.findById(workOrder._id)
            .populate('customer', 'companyName code contactPerson phone')
            .populate('finishedGood', 'name code')
            .populate('assignedMachine', 'name code currentOperators currentOperator')
            .populate('assignedOperators', 'name employeeCode department')
            .populate('stages.machine', 'name code currentOperators currentOperator');

        return res.status(200).json({
            success: true,
            message: `Work Order ${workOrder.workOrderNumber} updated successfully.`,
            data: updatedWorkOrder
        });
    } catch (error) {
        console.error('Error in updateWorkOrder:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update Work Order.'
        });
    }
};

module.exports = {
    createWorkOrder,
    updateWorkOrder,
    advanceStage,
    updateStageSpec,
    createContinuationWorkOrderCore,
    resumeBalanceProduction,
    cancelWorkOrder,
    getWorkOrders,
    getWorkOrderById,
    getAvailableRolls,
    getRollsTraceability
};
