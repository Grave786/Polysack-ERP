const mongoose = require('mongoose');
const ProductionLog = require('../models/productionLog.model');
const WorkOrder = require('../models/workOrder.model');
const Employee = require('../models/employee.model');

/**
 * Format Date object / string to IST YYYY-MM-DD string without toISOString() timezone shift
 */
const getIstDateString = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = (typeof dateVal === 'string' && dateVal.length === 10)
            ? new Date(`${dateVal}T00:00:00.000+05:30`)
            : new Date(dateVal);
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch {
        return String(dateVal);
    }
};

/**
 * Parse an incoming date string into an IST midnight Date object
 */
const parseIstDate = (dateInput) => {
    if (!dateInput) return new Date();
    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return new Date(`${trimmed}T00:00:00.000+05:30`);
        }
    }
    return new Date(dateInput);
};

/**
 * Helper to locate stage on a WorkOrder by ID, sequence, or stageName
 */
const resolveStageFromWorkOrder = (workOrder, stageIdentifier) => {
    if (!workOrder || !Array.isArray(workOrder.stages) || workOrder.stages.length === 0) {
        return null;
    }
    if (!stageIdentifier) {
        return workOrder.stages.find((s) => s.status === 'ACTIVE') || workOrder.stages[0];
    }
    const str = String(stageIdentifier).trim();
    const stage = workOrder.stages.find((s) =>
        (s._id && String(s._id) === str) ||
        (s.stageName && s.stageName.toUpperCase() === str.toUpperCase()) ||
        (s.sequence && String(s.sequence) === str)
    );
    return stage || workOrder.stages.find((s) => s.status === 'ACTIVE') || workOrder.stages[0];
};

/**
 * Helper to extract all valid assigned operator IDs for a Work Order & Stage
 */
const getValidOperatorIds = async (workOrder, targetStage) => {
    const validIds = new Set();

    if (Array.isArray(workOrder.assignedOperators)) {
        workOrder.assignedOperators.forEach((op) => {
            const id = op?._id ? String(op._id) : String(op);
            if (id && mongoose.isValidObjectId(id)) validIds.add(id);
        });
    }

    if (Array.isArray(workOrder.jobOrderDetails?.assignedOperators)) {
        workOrder.jobOrderDetails.assignedOperators.forEach((op) => {
            const id = op?._id ? String(op._id) : String(op);
            if (id && mongoose.isValidObjectId(id)) validIds.add(id);
        });
    }

    if (workOrder.assignedMachine) {
        const m = workOrder.assignedMachine;
        if (Array.isArray(m.currentOperators)) {
            m.currentOperators.forEach((op) => {
                const id = op?._id ? String(op._id) : String(op);
                if (id && mongoose.isValidObjectId(id)) validIds.add(id);
            });
        }
        if (m.currentOperator) {
            const id = m.currentOperator?._id ? String(m.currentOperator._id) : String(m.currentOperator);
            if (id && mongoose.isValidObjectId(id)) validIds.add(id);
        }
    }

    if (targetStage?.machine) {
        const sm = targetStage.machine;
        if (Array.isArray(sm.currentOperators)) {
            sm.currentOperators.forEach((op) => {
                const id = op?._id ? String(op._id) : String(op);
                if (id && mongoose.isValidObjectId(id)) validIds.add(id);
            });
        }
        if (sm.currentOperator) {
            const id = sm.currentOperator?._id ? String(sm.currentOperator._id) : String(sm.currentOperator);
            if (id && mongoose.isValidObjectId(id)) validIds.add(id);
        }
    }

    return validIds;
};

/**
 * Format status string for user-facing error messages
 */
const formatStatusName = (status) => {
    if (!status) return 'Unknown';
    const s = String(status).toUpperCase();
    if (s === 'COMPLETED') return 'Completed';
    if (s === 'CANCELLED') return 'Cancelled';
    if (s === 'REJECTED') return 'Rejected';
    if (s === 'IN_PROGRESS') return 'In Progress';
    return status;
};

/**
 * SINGLE BACKEND SOURCE OF TRUTH:
 * Computes dynamic stage targetQuantity, totalProduced (from ProductionLog sum), and remainingQuantity.
 * Dynamic rule:
 * - First active non-skipped stage: target = Work Order targetQuantity.
 * - Subsequent stages: target = Good Output (totalProduced) of preceding non-skipped stage.
 * Auto-seeds legacy completed quantity if no logs exist, and safely syncs stage completedQuantity
 * on the WorkOrder document via updateOne.
 */
const getStageProductionStatus = async (tenantId, workOrderId, stageIdentifier, sessionOption = {}) => {
    if (!tenantId || !workOrderId) return null;
    const tenantObjId = new mongoose.Types.ObjectId(tenantId);
    const woObjId = new mongoose.Types.ObjectId(workOrderId);

    const query = WorkOrder.findOne({ _id: woObjId, tenant: tenantObjId });
    if (sessionOption.session) query.session(sessionOption.session);
    const workOrder = await query;

    if (!workOrder) return null;

    const targetStage = resolveStageFromWorkOrder(workOrder, stageIdentifier);
    const stageName = targetStage ? targetStage.stageName : (workOrder.stages?.[0]?.stageName || 'TAPE_EXTRUSION');
    const workOrderOriginalTarget = Number(workOrder.targetQuantity || 0);

    // 1. Determine dynamic targetQuantity for this stage
    const nonSkippedStages = (workOrder.stages || []).filter(s => s.status !== 'SKIPPED');
    const currentStageIndex = nonSkippedStages.findIndex(s =>
        (s.stageName && s.stageName.toUpperCase() === stageName.toUpperCase()) ||
        (s._id && String(s._id) === String(targetStage?._id)) ||
        (s.sequence && s.sequence === targetStage?.sequence)
    );

    const isFirstActiveStage = currentStageIndex <= 0;
    let stageTargetQuantity = workOrderOriginalTarget;
    let previousStageInfo = null;

    if (!isFirstActiveStage && currentStageIndex > 0) {
        const prevStage = nonSkippedStages[currentStageIndex - 1];

        // Aggregate actual good output logs for the previous stage
        const prevAggPipeline = [
            {
                $match: {
                    tenant: tenantObjId,
                    workOrder: woObjId,
                    $or: [
                        { stage: prevStage.stageName },
                        { stageName: prevStage.stageName }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$quantity' }
                }
            }
        ];

        let prevAggQuery = ProductionLog.aggregate(prevAggPipeline);
        if (sessionOption.session) prevAggQuery = prevAggQuery.session(sessionOption.session);
        const prevAggResult = await prevAggQuery;

        let prevStageGoodOutput = prevAggResult.length > 0 ? Number(prevAggResult[0].total || 0) : 0;
        if (prevStageGoodOutput === 0) {
            prevStageGoodOutput = Number(prevStage.goodOutputQty || prevStage.completedQuantity || 0);
        }

        stageTargetQuantity = prevStageGoodOutput;
        previousStageInfo = {
            stageName: prevStage.stageName,
            sequence: prevStage.sequence,
            goodOutputQty: prevStageGoodOutput
        };
    }

    // 2. Check if ANY logs exist for this tenant + workOrder + stage
    const countQuery = ProductionLog.countDocuments({
        tenant: tenantObjId,
        workOrder: woObjId,
        $or: [
            { stage: stageName },
            { stageName: stageName }
        ]
    });
    if (sessionOption.session) countQuery.session(sessionOption.session);
    const logCount = await countQuery;

    // 3. Auto-seed legacy completed quantity if no logs exist yet
    if (logCount === 0 && targetStage) {
        const legacyQty = Number(
            targetStage.completedQuantity ||
            targetStage.goodOutputQty ||
            (targetStage.sequence === 8 ? workOrder.completedQuantity : 0) ||
            0
        );

        if (legacyQty > 0) {
            const seedDate = targetStage.completedAt ||
                targetStage.startedAt ||
                workOrder.updatedAt ||
                workOrder.jobOrderDetails?.orderDate ||
                workOrder.createdAt ||
                new Date();

            await ProductionLog.create([{
                tenant: tenantObjId,
                workOrder: woObjId,
                stage: stageName,
                stageName: stageName,
                stageSequence: targetStage.sequence || 1,
                operator: null,
                date: seedDate,
                quantity: legacyQty,
                shift: null,
                remarks: 'Auto-migrated from legacy completed quantity',
                notes: 'Auto-migrated from legacy completed quantity',
                loggedBy: null,
                performedBy: null,
                goodOutput: legacyQty,
                goodOutputQty: legacyQty
            }], sessionOption);
        }
    }

    // 4. Compute totalProduced as the exact sum of ALL ProductionLog quantities for this stage
    const aggPipeline = [
        {
            $match: {
                tenant: tenantObjId,
                workOrder: woObjId,
                $or: [
                    { stage: stageName },
                    { stageName: stageName }
                ]
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$quantity' }
            }
        }
    ];

    let aggQuery = ProductionLog.aggregate(aggPipeline);
    if (sessionOption.session) aggQuery = aggQuery.session(sessionOption.session);
    const aggResult = await aggQuery;
    const totalProduced = aggResult.length > 0 ? (Number(aggResult[0].total) || 0) : 0;
    const remainingQuantity = Math.max(0, stageTargetQuantity - totalProduced);
    const isExceedingPreviousStage = totalProduced > stageTargetQuantity && stageTargetQuantity > 0;

    // 5. Safely synchronize stage completedQuantity and goodOutputQty via updateOne
    const updateSet = {
        'stages.$[st].completedQuantity': totalProduced,
        'stages.$[st].goodOutputQty': totalProduced
    };

    const isFinalStage = targetStage?.sequence === 8 || stageName === 'BALING_PACKING';
    if (isFinalStage) {
        updateSet.completedQuantity = totalProduced;
    }

    const updateQuery = WorkOrder.updateOne(
        { _id: woObjId, tenant: tenantObjId },
        { $set: updateSet },
        {
            arrayFilters: [{ 'st.stageName': stageName }],
            ...(sessionOption.session ? { session: sessionOption.session } : {})
        }
    );
    await updateQuery;

    return {
        workOrder,
        targetStage,
        stageName,
        targetQuantity: stageTargetQuantity,
        stageTargetQuantity,
        workOrderOriginalTarget,
        totalProduced,
        remainingQuantity,
        isFirstActiveStage,
        previousStage: previousStageInfo,
        isTargetAchieved: remainingQuantity === 0 && stageTargetQuantity > 0,
        hasNoTarget: stageTargetQuantity === 0,
        isExceedingPreviousStage
    };
};

/**
 * @desc    Create a new ProductionLog entry for a Work Order stage
 * @route   POST /api/production/work-orders/:woId/stages/:stageId/logs
 *          POST /api/work-orders/:woId/stages/:stageId/logs
 * @access  Private (PRODUCTION:UPDATE / PRODUCTION:CREATE)
 */
const createProductionLog = async (req, res) => {
    let session = null;
    let useTransaction = true;

    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { woId, stageId } = req.params;
        const targetWoId = woId || req.body.workOrder || req.body.workOrderId;
        const targetStageParam = stageId || req.body.stage || req.body.stageId || req.body.stageName;

        if (!targetWoId) {
            return res.status(400).json({
                success: false,
                message: 'Work Order reference is required.'
            });
        }

        // 1. Fetch WorkOrder with assigned operator populations
        const workOrder = await WorkOrder.findOne({ _id: targetWoId, tenant: tenantObjId })
            .populate({
                path: 'assignedMachine',
                populate: [
                    { path: 'currentOperators', select: 'name employeeCode department' },
                    { path: 'currentOperator', select: 'name employeeCode department' }
                ]
            })
            .populate('assignedOperators', 'name employeeCode department')
            .populate('jobOrderDetails.assignedOperators', 'name employeeCode department');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        // 2. Block production log creation on CANCELLED, REJECTED, and COMPLETED Work Orders
        const woStatusUpper = String(workOrder.status || '').toUpperCase();
        if (woStatusUpper === 'CANCELLED' || woStatusUpper === 'REJECTED' || woStatusUpper === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: `Cannot add production for a ${formatStatusName(workOrder.status)} Work Order.`
            });
        }

        // 3. Identify target Stage
        const targetStage = resolveStageFromWorkOrder(workOrder, targetStageParam);
        if (!targetStage) {
            return res.status(404).json({
                success: false,
                message: `Stage '${targetStageParam}' not found on this Work Order.`
            });
        }

        const { operator, date, quantity, shift, remarks, notes } = req.body;

        // 4. Validate Quantity is a positive number
        const numQty = Number(quantity);
        if (isNaN(numQty) || numQty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number greater than 0.'
            });
        }

        // 5. Setup Transaction for atomic seed + validation + log creation + recalculation
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};

        // 6 & 7. HARD LIMIT: Check dynamic remaining allowance using ONE shared status helper
        const currentStatus = await getStageProductionStatus(
            tenantObjId,
            workOrder._id,
            targetStage.stageName,
            sessionOption
        );

        if (!currentStatus) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({
                success: false,
                message: 'Stage status could not be resolved.'
            });
        }

        if (currentStatus.hasNoTarget) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: currentStatus.isFirstActiveStage
                    ? 'No target set on this Work Order yet.'
                    : `Cannot log production: No good output has been produced yet from the previous stage (${currentStatus.previousStage?.stageName?.replace(/_/g, ' ') || 'preceding stage'}).`
            });
        }

        if (numQty > currentStatus.remainingQuantity) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            const limitLabel = currentStatus.isFirstActiveStage
                ? 'Work Order target'
                : `available input from ${currentStatus.previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}`;
            return res.status(400).json({
                success: false,
                message: currentStatus.remainingQuantity === 0
                    ? `Only 0 Bags remaining for this stage; ${limitLabel} already achieved.`
                    : `Only ${currentStatus.remainingQuantity.toLocaleString('en-IN')} Bags remaining from ${limitLabel} (${currentStatus.targetQuantity.toLocaleString('en-IN')} Bags total). Reduce the quantity.`
            });
        }

        // 8. Validate Operator against assigned operators
        if (operator) {
            const validOperatorIds = await getValidOperatorIds(workOrder, targetStage);
            const opIdStr = String(operator?._id || operator);

            if (validOperatorIds.size > 0 && !validOperatorIds.has(opIdStr)) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'The selected operator is not assigned to this Work Order or stage.'
                });
            }

            // Verify operator exists in tenant's employee registry
            const employeeExists = await Employee.findOne({ _id: opIdStr, tenant: tenantObjId });
            if (!employeeExists) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'Operator employee record not found in your organization.'
                });
            }
        }

        // 9. Parse IST Date & disallow future dates
        const logDate = parseIstDate(date);
        const todayIstStr = getIstDateString(new Date());
        const logIstStr = getIstDateString(logDate);
        if (logIstStr > todayIstStr) {
            if (useTransaction && session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: 'Production date cannot be in the future.'
            });
        }

        // 10. Create ProductionLog entry
        const createdLogs = await ProductionLog.create([{
            tenant: tenantObjId,
            workOrder: workOrder._id,
            stage: targetStage.stageName,
            stageName: targetStage.stageName,
            stageSequence: targetStage.sequence,
            operator: operator ? (operator._id || operator) : null,
            date: logDate,
            quantity: numQty,
            shift: shift || null,
            remarks: remarks || notes || '',
            notes: notes || remarks || '',
            loggedBy: req.user?._id || req.user?.id,
            performedBy: req.user?._id || req.user?.id,
            goodOutput: numQty,
            goodOutputQty: numQty
        }], sessionOption);

        const newLog = createdLogs[0];

        // 11. Recalculate status and sync WorkOrder document
        const updatedStatus = await getStageProductionStatus(
            tenantObjId,
            workOrder._id,
            targetStage.stageName,
            sessionOption
        );

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await newLog.populate([
            { path: 'operator', select: 'name employeeCode department designation' },
            { path: 'loggedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: 'Production log recorded successfully.',
            data: newLog,
            summary: {
                targetQuantity: updatedStatus.targetQuantity,
                stageTargetQuantity: updatedStatus.stageTargetQuantity,
                workOrderOriginalTarget: updatedStatus.workOrderOriginalTarget,
                totalProduced: updatedStatus.totalProduced,
                remainingQuantity: updatedStatus.remainingQuantity
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in createProductionLog:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create Production Log.'
        });
    }
};

/**
 * @desc    Get all ProductionLog entries for a Work Order stage
 * @route   GET /api/production/work-orders/:woId/stages/:stageId/logs
 *          GET /api/work-orders/:woId/stages/:stageId/logs
 * @access  Private (PRODUCTION:READ)
 */
const getProductionLogs = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { woId, stageId } = req.params;

        // Ensure status & legacy sync via shared status function
        const status = await getStageProductionStatus(tenantObjId, woId, stageId);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Work Order or stage not found.'
            });
        }

        const filter = {
            tenant: tenantObjId,
            workOrder: new mongoose.Types.ObjectId(woId),
            $or: [
                { stage: status.stageName },
                { stageName: status.stageName }
            ]
        };

        const logs = await ProductionLog.find(filter)
            .populate('operator', 'name employeeCode department designation')
            .populate('loggedBy', 'name email')
            .populate('shift', 'name shiftCode startTime endTime')
            .sort({ date: 1, createdAt: 1 })
            .lean();

        const formattedLogs = logs.map((l) => ({
            ...l,
            operator: l.operator || {
                name: l.remarks?.includes('legacy') ? 'Legacy Entry (Auto-migrated)' : 'Legacy Entry',
                employeeCode: 'LEGACY',
                department: 'PRODUCTION'
            }
        }));

        return res.status(200).json({
            success: true,
            count: formattedLogs.length,
            data: formattedLogs
        });
    } catch (error) {
        console.error('Error in getProductionLogs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Production Logs.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Operator-wise, Day-wise Production Summary & Matrix for a stage
 * @route   GET /api/production/work-orders/:woId/stages/:stageId/logs/summary
 *          GET /api/work-orders/:woId/stages/:stageId/logs/summary
 * @access  Private (PRODUCTION:READ)
 */
const getProductionLogsSummary = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { woId, stageId } = req.params;

        // 1. Single source of truth: Get stage production status & auto-seed legacy entries safely
        const status = await getStageProductionStatus(tenantObjId, woId, stageId);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Work Order or stage not found.'
            });
        }

        const {
            workOrder,
            targetStage,
            stageName,
            targetQuantity,
            stageTargetQuantity,
            workOrderOriginalTarget,
            totalProduced,
            remainingQuantity,
            hasNoTarget,
            isFirstActiveStage,
            previousStage,
            isExceedingPreviousStage
        } = status;

        // Populate machine and operators for assigned list
        const populatedWO = await WorkOrder.findOne({ _id: workOrder._id, tenant: tenantObjId })
            .populate({
                path: 'assignedMachine',
                populate: [
                    { path: 'currentOperators', select: 'name employeeCode department designation' },
                    { path: 'currentOperator', select: 'name employeeCode department designation' }
                ]
            })
            .populate('assignedOperators', 'name employeeCode department designation')
            .populate('jobOrderDetails.assignedOperators', 'name employeeCode department designation');

        // 2. Fetch all logs for this stage
        const logs = await ProductionLog.find({
            tenant: tenantObjId,
            workOrder: new mongoose.Types.ObjectId(woId),
            $or: [
                { stage: stageName },
                { stageName: stageName }
            ]
        })
            .populate('operator', 'name employeeCode department designation')
            .populate('loggedBy', 'name email')
            .populate('shift', 'name shiftCode startTime endTime')
            .sort({ date: 1, createdAt: 1 })
            .lean();

        // 3. Aggregate by Operator
        const operatorMap = {};
        logs.forEach((log) => {
            const op = log.operator;
            const isLegacy = !op || log.remarks?.includes('legacy');
            const opId = op?._id ? String(op._id) : 'legacy-entry';
            const opName = op?.name || (op?.employeeCode ? `${op.employeeCode} - ${op.name}` : (isLegacy ? 'Legacy Entry (Auto-migrated)' : 'Unassigned Operator'));

            if (!operatorMap[opId]) {
                operatorMap[opId] = {
                    operatorId: opId,
                    operatorName: opName,
                    employeeCode: op?.employeeCode || (isLegacy ? 'LEGACY' : ''),
                    department: op?.department || 'PRODUCTION',
                    total: 0
                };
            }
            operatorMap[opId].total += Number(log.quantity || 0);
        });

        const byOperator = Object.values(operatorMap);

        // 4. Aggregate by Date (IST YYYY-MM-DD)
        const dateMap = {};
        const dateOperatorMatrix = {};

        logs.forEach((log) => {
            const dateStr = getIstDateString(log.date);
            const op = log.operator;
            const isLegacy = !op || log.remarks?.includes('legacy');
            const opId = op?._id ? String(op._id) : 'legacy-entry';
            const opName = op?.name || (op?.employeeCode ? `${op.employeeCode} - ${op.name}` : (isLegacy ? 'Legacy Entry (Auto-migrated)' : 'Unassigned Operator'));
            const qty = Number(log.quantity || 0);

            if (!dateMap[dateStr]) {
                dateMap[dateStr] = {
                    date: dateStr,
                    total: 0
                };
            }
            dateMap[dateStr].total += qty;

            if (!dateOperatorMatrix[dateStr]) {
                dateOperatorMatrix[dateStr] = {};
            }
            if (!dateOperatorMatrix[dateStr][opId]) {
                dateOperatorMatrix[dateStr][opId] = {
                    operatorId: opId,
                    operatorName: opName,
                    quantity: 0
                };
            }
            dateOperatorMatrix[dateStr][opId].quantity += qty;
        });

        const sortedDates = Object.keys(dateMap).sort();
        const byDate = sortedDates.map((d) => dateMap[d]);

        const matrix = sortedDates.map((d) => ({
            date: d,
            total: dateMap[d]?.total || 0,
            entries: Object.values(dateOperatorMatrix[d] || {})
        }));

        // 5. Collect list of available assigned operators for this stage & WO
        const assignedOperatorsList = [];
        const seenOpIds = new Set();

        const addOp = (op) => {
            if (!op) return;
            const id = op._id ? String(op._id) : String(op);
            if (id && !seenOpIds.has(id) && mongoose.isValidObjectId(id)) {
                seenOpIds.add(id);
                assignedOperatorsList.push({
                    _id: id,
                    name: op.name || 'Assigned Operator',
                    employeeCode: op.employeeCode || '',
                    department: op.department || ''
                });
            }
        };

        (populatedWO?.assignedOperators || []).forEach(addOp);
        (populatedWO?.jobOrderDetails?.assignedOperators || []).forEach(addOp);

        if (populatedWO?.assignedMachine) {
            const m = populatedWO.assignedMachine;
            (m.currentOperators || []).forEach(addOp);
            if (m.currentOperator) addOp(m.currentOperator);
        }

        if (targetStage?.machine) {
            const sm = targetStage.machine;
            if (Array.isArray(sm.currentOperators)) sm.currentOperators.forEach(addOp);
            if (sm.currentOperator) addOp(sm.currentOperator);
        }

        // If no operators were explicitly assigned, fallback to all active employees in tenant
        if (assignedOperatorsList.length === 0) {
            const allEmployees = await Employee.find({ tenant: tenantObjId, isActive: { $ne: false } })
                .select('name employeeCode department designation')
                .lean();
            allEmployees.forEach(addOp);
        }

        // Format legacy log entries cleanly for UI list
        const formattedLogs = logs.map((l) => ({
            ...l,
            operator: l.operator || {
                _id: 'legacy-entry',
                name: l.remarks?.includes('legacy') ? 'Legacy Entry (Auto-migrated)' : 'Legacy Entry',
                employeeCode: 'LEGACY',
                department: 'PRODUCTION'
            }
        }));

        return res.status(200).json({
            success: true,
            data: {
                targetQuantity: stageTargetQuantity,
                stageTargetQuantity,
                workOrderOriginalTarget,
                totalProduced,
                remainingQuantity,
                hasNoTarget,
                isFirstActiveStage,
                previousStage,
                isExceedingPreviousStage,
                progressPercentage: stageTargetQuantity > 0 ? Math.min(100, Math.round((totalProduced / stageTargetQuantity) * 100)) : 0,
                byOperator,
                byDate,
                matrix,
                logs: formattedLogs,
                assignedOperators: assignedOperatorsList,
                stage: targetStage,
                workOrderStatus: workOrder.status
            }
        });
    } catch (error) {
        console.error('Error in getProductionLogsSummary:', error, error.stack);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve production logs summary.',
            error: error.message
        });
    }
};

/**
 * @desc    Update an existing ProductionLog entry
 * @route   PUT /api/production/work-orders/:woId/stages/:stageId/logs/:logId
 *          PUT /api/work-orders/:woId/stages/:stageId/logs/:logId
 * @access  Private (PRODUCTION:UPDATE)
 */
const updateProductionLog = async (req, res) => {
    let session = null;
    let useTransaction = true;

    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { logId } = req.params;

        const log = await ProductionLog.findOne({ _id: logId, tenant: tenantObjId });
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Production Log entry not found.'
            });
        }

        // Fetch WorkOrder to validate status
        const workOrder = await WorkOrder.findOne({ _id: log.workOrder, tenant: tenantObjId })
            .populate({
                path: 'assignedMachine',
                populate: [
                    { path: 'currentOperators', select: 'name employeeCode department' },
                    { path: 'currentOperator', select: 'name employeeCode department' }
                ]
            })
            .populate('assignedOperators', 'name employeeCode department')
            .populate('jobOrderDetails.assignedOperators', 'name employeeCode department');

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        const woStatusUpper = String(workOrder.status || '').toUpperCase();

        // 1. Block editing on CANCELLED and REJECTED Work Orders
        if (woStatusUpper === 'CANCELLED' || woStatusUpper === 'REJECTED') {
            return res.status(400).json({
                success: false,
                message: `Cannot update production logs for a ${formatStatusName(workOrder.status)} Work Order.`
            });
        }

        const { operator, date, quantity, shift, remarks, notes } = req.body;
        const stageName = log.stage || log.stageName;

        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};

        // 2. Quantity validation via shared status function
        if (quantity !== undefined) {
            const numQty = Number(quantity);
            if (isNaN(numQty) || numQty <= 0) {
                if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
                return res.status(400).json({
                    success: false,
                    message: 'Quantity must be a positive number greater than 0.'
                });
            }

            // On COMPLETED Work Orders: Only allow edits that maintain or reduce quantity (corrections)
            if (woStatusUpper === 'COMPLETED') {
                const currentEntryQty = Number(log.quantity || 0);
                if (numQty > currentEntryQty) {
                    if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot increase production quantity for a Completed Work Order. Only corrections that maintain or reduce quantity are allowed.'
                    });
                }
            }

            // Get current dynamic status and add back this entry's quantity to calculate edit allowance
            const status = await getStageProductionStatus(tenantObjId, log.workOrder, stageName, sessionOption);
            const allowance = (status?.remainingQuantity || 0) + Number(log.quantity || 0);

            if (numQty > allowance) {
                if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
                const limitLabel = status?.isFirstActiveStage
                    ? 'Work Order target'
                    : `available input from ${status?.previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}`;
                return res.status(400).json({
                    success: false,
                    message: `Only ${allowance.toLocaleString('en-IN')} Bags remaining for this ${limitLabel} (${status?.targetQuantity?.toLocaleString('en-IN')} Bags available). Reduce the quantity.`
                });
            }

            log.quantity = numQty;
            log.goodOutput = numQty;
            log.goodOutputQty = numQty;
        }

        if (operator !== undefined) {
            if (operator && mongoose.isValidObjectId(operator)) {
                const targetStage = resolveStageFromWorkOrder(workOrder, stageName);
                const validOperatorIds = await getValidOperatorIds(workOrder, targetStage);
                const opIdStr = String(operator?._id || operator);

                if (validOperatorIds.size > 0 && !validOperatorIds.has(opIdStr)) {
                    if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
                    return res.status(400).json({
                        success: false,
                        message: 'The selected operator is not assigned to this Work Order or stage.'
                    });
                }
            }
            log.operator = (operator && mongoose.isValidObjectId(operator)) ? (operator._id || operator) : null;
        }

        if (date !== undefined) {
            const parsed = parseIstDate(date);
            const todayIstStr = getIstDateString(new Date());
            const logIstStr = getIstDateString(parsed);
            if (logIstStr > todayIstStr) {
                if (useTransaction && session) { await session.abortTransaction(); session.endSession(); }
                return res.status(400).json({
                    success: false,
                    message: 'Production date cannot be in the future.'
                });
            }
            log.date = parsed;
        }

        if (shift !== undefined) log.shift = shift || null;
        if (remarks !== undefined) log.remarks = remarks;
        if (notes !== undefined) log.notes = notes;

        log.loggedBy = req.user?._id || req.user?.id;
        log.performedBy = req.user?._id || req.user?.id;

        await log.save(sessionOption);

        // Recalculate and sync via shared status function
        const updatedStatus = await getStageProductionStatus(
            tenantObjId,
            log.workOrder,
            stageName,
            sessionOption
        );

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await log.populate([
            { path: 'operator', select: 'name employeeCode department designation' },
            { path: 'loggedBy', select: 'name email' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Production log updated successfully.',
            data: log,
            totalProduced: updatedStatus?.totalProduced || 0,
            remainingQuantity: updatedStatus?.remainingQuantity || 0
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in updateProductionLog:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update Production Log.'
        });
    }
};

/**
 * @desc    Delete a single ProductionLog entry
 * @route   DELETE /api/production/work-orders/:woId/stages/:stageId/logs/:logId
 *          DELETE /api/work-orders/:woId/stages/:stageId/logs/:logId
 * @access  Private (PRODUCTION:UPDATE)
 */
const deleteProductionLog = async (req, res) => {
    let session = null;
    let useTransaction = true;

    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { logId } = req.params;

        const log = await ProductionLog.findOne({ _id: logId, tenant: tenantObjId });
        if (!log) {
            return res.status(404).json({
                success: false,
                message: 'Production Log entry not found.'
            });
        }

        // Fetch WorkOrder to validate status
        const workOrder = await WorkOrder.findOne({ _id: log.workOrder, tenant: tenantObjId }).select('status');
        if (workOrder) {
            const woStatusUpper = String(workOrder.status || '').toUpperCase();
            if (woStatusUpper === 'CANCELLED' || woStatusUpper === 'REJECTED') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete production logs for a ${formatStatusName(workOrder.status)} Work Order.`
                });
            }
        }

        const workOrderId = log.workOrder;
        const stageName = log.stage || log.stageName;

        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionErr) {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};

        await ProductionLog.deleteOne({ _id: logId, tenant: tenantObjId }, sessionOption);

        // Recalculate and sync via shared status function
        const updatedStatus = await getStageProductionStatus(
            tenantObjId,
            workOrderId,
            stageName,
            sessionOption
        );

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        return res.status(200).json({
            success: true,
            message: 'Production log deleted successfully.',
            totalProduced: updatedStatus?.totalProduced || 0,
            remainingQuantity: updatedStatus?.remainingQuantity || 0
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Error in deleteProductionLog:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Production Log.',
            error: error.message
        });
    }
};

/**
 * @desc    Get consolidated overall production summary across all non-skipped stages for a Work Order
 * @route   GET /api/work-orders/:woId/production-summary
 * @access  Private (PRODUCTION:READ)
 */
const getWorkOrderOverallProductionSummary = async (req, res) => {
    try {
        const rawTenantId = req.user?.tenant;
        const tenantId = rawTenantId ? (typeof rawTenantId === 'object' ? String(rawTenantId._id || rawTenantId.id || rawTenantId) : String(rawTenantId)) : null;

        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { woId } = req.params;

        const workOrder = await WorkOrder.findOne({ _id: woId, tenant: tenantObjId })
            .populate('customer', 'name companyName')
            .populate('finishedGood', 'name code')
            .lean();

        if (!workOrder) {
            return res.status(404).json({
                success: false,
                message: 'Work Order not found.'
            });
        }

        const nonSkippedStages = (workOrder.stages || []).filter((s) => s.status !== 'SKIPPED');
        if (nonSkippedStages.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    workOrderId: workOrder._id,
                    workOrderNumber: workOrder.workOrderNumber,
                    targetQuantity: workOrder.targetQuantity || 0,
                    finishedGoodsQty: 0,
                    stages: [],
                    operators: [],
                    matrix: [],
                    hasLegacyStages: false,
                    legacyStageCount: 0
                }
            });
        }

        // Fetch all production logs for this work order across all stages
        const allLogs = await ProductionLog.find({
            tenant: tenantObjId,
            workOrder: new mongoose.Types.ObjectId(woId)
        })
            .populate('operator', 'name employeeCode department')
            .lean();

        const stageSummaries = [];
        const operatorMap = {};
        let previousStageOutput = Number(workOrder.targetQuantity || 0);
        let legacyStageCount = 0;

        for (let i = 0; i < nonSkippedStages.length; i++) {
            const st = nonSkippedStages[i];
            const stName = st.stageName;
            const stageLogs = allLogs.filter(
                (l) => (l.stage && l.stage.toUpperCase() === stName.toUpperCase()) ||
                       (l.stageName && l.stageName.toUpperCase() === stName.toUpperCase())
            );

            const isFirst = i === 0;
            const stageTarget = isFirst ? Number(workOrder.targetQuantity || 0) : previousStageOutput;

            let stageTotalProduced = 0;
            let isLegacy = false;
            let legacyQuantity = 0;
            const stageByOperator = {};

            if (stageLogs.length > 0) {
                stageLogs.forEach((log) => {
                    const qty = Number(log.quantity || 0);
                    stageTotalProduced += qty;

                    const op = log.operator;
                    const opId = op?._id ? String(op._id) : 'legacy-unassigned';
                    const opName = op?.name || (log.remarks?.includes('legacy') ? 'Legacy Entry (Auto-migrated)' : 'Unassigned Operator');
                    const opCode = op?.employeeCode || (op ? '' : 'LEGACY');

                    if (!stageByOperator[opId]) {
                        stageByOperator[opId] = {
                            operatorId: opId,
                            operatorName: opName,
                            employeeCode: opCode,
                            quantity: 0
                        };
                    }
                    stageByOperator[opId].quantity += qty;

                    // Global operator map across WO
                    if (!operatorMap[opId]) {
                        operatorMap[opId] = {
                            operatorId: opId,
                            operatorName: opName,
                            employeeCode: opCode,
                            totalAcrossStages: 0,
                            stages: {}
                        };
                    }
                    operatorMap[opId].totalAcrossStages += qty;
                    operatorMap[opId].stages[stName] = (operatorMap[opId].stages[stName] || 0) + qty;
                });
            } else {
                // No logs recorded for this stage - check for legacy completedQuantity
                const storedQty = Number(st.completedQuantity || st.goodOutputQty || 0);
                if (storedQty > 0 || (st.sequence === 8 && Number(workOrder.completedQuantity || 0) > 0)) {
                    isLegacy = true;
                    legacyQuantity = storedQty > 0 ? storedQty : Number(workOrder.completedQuantity || 0);
                    stageTotalProduced = legacyQuantity;
                    legacyStageCount += 1;
                }
            }

            const stageRemaining = Math.max(0, stageTarget - stageTotalProduced);
            previousStageOutput = stageTotalProduced;

            stageSummaries.push({
                stageName: stName,
                sequence: st.sequence || (i + 1),
                label: stName.replace(/_/g, ' '),
                status: st.status,
                targetQuantity: stageTarget,
                totalProduced: stageTotalProduced,
                remainingQuantity: stageRemaining,
                isLegacy,
                legacyQuantity,
                byOperator: Object.values(stageByOperator)
            });
        }

        // Determine Finished Goods (Final Stage Output)
        // Same final stage rule as Analytics Production Yield: sequence 8 or BALING_PACKING or the last non-skipped stage
        const finalStageSummary = stageSummaries.find((s) => s.sequence === 8 || s.stageName === 'BALING_PACKING') || stageSummaries[stageSummaries.length - 1];
        const finalStageName = finalStageSummary?.stageName || 'BALING_PACKING';
        const finishedGoodsQty = finalStageSummary ? finalStageSummary.totalProduced : (Number(workOrder.completedQuantity) || 0);

        const operatorsList = Object.values(operatorMap).map((op) => ({
            ...op,
            finishedGoodsQty: op.stages?.[finalStageName] || 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                workOrderId: workOrder._id,
                workOrderNumber: workOrder.workOrderNumber,
                status: workOrder.status,
                targetQuantity: Number(workOrder.targetQuantity || 0),
                finishedGoodsQty,
                finishedGoodsStageName: finalStageSummary?.stageName || 'FINAL_STAGE',
                stages: stageSummaries,
                operators: operatorsList,
                hasLegacyStages: legacyStageCount > 0,
                legacyStageCount
            }
        });
    } catch (error) {
        console.error('Error in getWorkOrderOverallProductionSummary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve overall production summary.',
            error: error.message
        });
    }
};

module.exports = {
    getStageProductionStatus,
    createProductionLog,
    getProductionLogs,
    getProductionLogsSummary,
    getWorkOrderOverallProductionSummary,
    updateProductionLog,
    deleteProductionLog,
    resolveStageFromWorkOrder,
    getValidOperatorIds
};

