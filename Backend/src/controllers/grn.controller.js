const mongoose = require('mongoose');
const GRN = require('../models/grn.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const QCInspection = require('../models/qcInspection.model');
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
 * Helper to auto-generate unique QC Certificate number per tenant & year
 */
const generateQcCertNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `QC-${year}-`;
    const lastQc = await QCInspection.findOne({ tenant: tenantId, qcCertificateNumber: { $regex: `^${prefix}\\d{4}$` } }).sort({ qcCertificateNumber: -1 });
    let nextNumber = 1001;
    if (lastQc && lastQc.qcCertificateNumber) {
        const parts = lastQc.qcCertificateNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) nextNumber = lastSeq + 1;
    }
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

/**
 * @desc    Create a Goods Receipt Note (GRN)
 *          Note: Goods received via GRN are routed to the Inbound QC gate.
 *          Usable RawMaterial.currentStock is NOT updated here; it updates ONLY upon Inbound QC Pass.
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
            rolls,
            receivingLocation,
            notes
        } = req.body;

        if (!purchaseOrder || !receivingLocation || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide purchaseOrder, receivingLocation, and at least one item.'
            });
        }

        const locationDoc = await Location.findOne({ _id: receivingLocation, tenant: tenantId });
        if (!locationDoc) {
            return res.status(400).json({
                success: false,
                message: 'Receiving Location does not exist or does not belong to your organization.'
            });
        }

        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};

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
                message: `Cannot receive goods for PO in status '${poDoc.status}'. Only SENT_TO_SUPPLIER or PARTIALLY_RECEIVED allowed.`
            });
        }

        const cleanedItems = [];

        for (const grnItem of items) {
            const rawMaterialId = typeof grnItem.rawMaterial === 'object'
                ? String(grnItem.rawMaterial?._id || grnItem.rawMaterial?.id || '')
                : String(grnItem.rawMaterial || '').trim();

            const numQty = Number(grnItem.receivedQuantity);
            if (!rawMaterialId || isNaN(numQty) || numQty <= 0) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: 'Each GRN item must have a valid rawMaterial ObjectId and a positive receivedQuantity > 0.'
                });
            }

            const rmIdStr = String(rawMaterialId);
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

            cleanedItems.push({
                rawMaterial: rawMaterialId,
                receivedQuantity: Number(numQty.toFixed(3)),
                batchNumber: grnItem.batchNumber ? String(grnItem.batchNumber).trim() : undefined,
                receivedRolls: (grnItem.receivedRolls !== undefined && grnItem.receivedRolls !== '' && grnItem.receivedRolls !== null) ? Number(grnItem.receivedRolls) : 0,
                fabricAverage: (grnItem.fabricAverage !== undefined && grnItem.fabricAverage !== '' && grnItem.fabricAverage !== null) ? Number(grnItem.fabricAverage) : null
            });
        }

        const cleanedRolls = Array.isArray(rolls) ? rolls.filter(r => r && (r.rollNumber || r.rollNo) && String(r.rollNumber || r.rollNo).trim()).map(r => ({
            rollNumber: String(r.rollNumber || r.rollNo).trim().slice(0, 50),
            fabricLength: (r.fabricLength !== undefined && r.fabricLength !== '' && r.fabricLength !== null)
                ? Number(r.fabricLength)
                : ((r.length !== undefined && r.length !== '' && r.length !== null) ? Number(r.length) : null),
            width: r.width !== undefined && r.width !== '' && r.width !== null ? Number(r.width) : null,
            grossWeight: r.grossWeight !== undefined && r.grossWeight !== '' && r.grossWeight !== null ? Number(r.grossWeight) : null,
            netWeight: r.netWeight !== undefined && r.netWeight !== '' && r.netWeight !== null ? Number(r.netWeight) : null,
            fabricAverage: r.fabricAverage !== undefined && r.fabricAverage !== '' && r.fabricAverage !== null ? Number(r.fabricAverage) : null,
            totalQuantityKg: (r.totalQuantityKg !== undefined && r.totalQuantityKg !== '' && r.totalQuantityKg !== null)
                ? Number(r.totalQuantityKg)
                : ((r.qtyKgs !== undefined && r.qtyKgs !== '' && r.qtyKgs !== null) ? Number(r.qtyKgs) : null),
            totalQuantityPcs: (r.totalQuantityPcs !== undefined && r.totalQuantityPcs !== '' && r.totalQuantityPcs !== null)
                ? Number(r.totalQuantityPcs)
                : ((r.qtyPcs !== undefined && r.qtyPcs !== '' && r.qtyPcs !== null) ? Number(r.qtyPcs) : null)
        })) : [];

        const hasRollUnit = poDoc.items.some(i => i.unit === 'Roll');
        if (hasRollUnit && (!cleanedRolls || cleanedRolls.length === 0)) {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: 'At least one roll entry with a valid Roll Number is required for Roll items.'
            });
        }

        const grnNumber = await generateGrnNumber(tenantId);

        const grnDocs = await GRN.create([{
            tenant: tenantId,
            grnNumber,
            purchaseOrder: poDoc._id,
            supplier: poDoc.supplier,
            receivedDate: receivedDate || new Date(),
            items: cleanedItems,
            rolls: cleanedRolls,
            receivingLocation,
            notes,
            receivedBy: req.user._id || req.user.id
        }], sessionOption);

        const grn = grnDocs[0];

        // Process GRN items: update PO received quantities & pricePerUnit, create pending Inbound QC records
        for (const grnItem of cleanedItems) {
            const poItem = poDoc.items.find(i => String(i.rawMaterial) === String(grnItem.rawMaterial));
            if (poItem) {
                poItem.receivedQuantity = Number(((poItem.receivedQuantity || 0) + grnItem.receivedQuantity).toFixed(3));

                if (poItem.ratePerUnit !== undefined && Number(poItem.ratePerUnit) > 0) {
                    const rmDocQuery = RawMaterial.findOne({ _id: grnItem.rawMaterial, tenant: tenantId });
                    if (useTransaction && session) rmDocQuery.session(session);
                    const rmDoc = await rmDocQuery;
                    if (rmDoc) {
                        rmDoc.lastPurchasePrice = Number(poItem.ratePerUnit);
                        if (!rmDoc.pricePerUnit || rmDoc.pricePerUnit === 0) {
                            rmDoc.pricePerUnit = Number(poItem.ratePerUnit);
                        }
                        await rmDoc.save(sessionOption);
                    }
                }
            }
        }

        // Recompute PurchaseOrder Status
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
            { path: 'purchaseOrder', select: 'poNumber poDate totalValue status' },
            { path: 'supplier', select: 'name contactPerson phone' },
            { path: 'receivingLocation', select: 'name code type' },
            { path: 'items.rawMaterial', select: 'name code uom currentStock' },
            { path: 'receivedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: `GRN '${grnNumber}' created successfully. Material routed to Inbound QC gate.`,
            data: {
                grn,
                updatedPurchaseOrder: {
                    poNumber: poDoc.poNumber,
                    status: poDoc.status
                }
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
        }
        console.error('Error in createGRN:', error);
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

        const { purchaseOrder, supplier, search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId };

        if (purchaseOrder) filter.purchaseOrder = purchaseOrder;
        if (supplier) filter.supplier = supplier;
        if (search) {
            filter.grnNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [grns, total] = await Promise.all([
            GRN.find(filter)
                .populate('purchaseOrder', 'poNumber poDate status')
                .populate('supplier', 'name contactPerson phone')
                .populate('receivingLocation', 'name code type')
                .populate('items.rawMaterial', 'name code uom currentStock')
                .populate('receivedBy', 'name email')
                .populate('lastEditedBy', 'name email')
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
            .populate('purchaseOrder', 'poNumber poDate totalValue status')
            .populate('supplier', 'name contactPerson phone')
            .populate('receivingLocation', 'name code type')
            .populate('items.rawMaterial', 'name code uom currentStock')
            .populate('receivedBy', 'name email')
            .populate('lastEditedBy', 'name email');

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

/**
 * @desc    Update an existing Goods Receipt Note (GRN) (Tenant Admin only)
 *          Recalculates linked Purchase Order item received quantities and overall PO status.
 * @route   PUT /api/grns/:id
 * @access  Private (Tenant Admin only)
 */
const updateGRN = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { id } = req.params;
        const grn = await GRN.findOne({ _id: id, tenant: tenantId });
        if (!grn) {
            return res.status(404).json({
                success: false,
                message: 'Goods Receipt Note (GRN) not found.'
            });
        }

        const {
            receivedDate,
            items,
            rolls,
            receivingLocation,
            notes
        } = req.body;

        const WorkOrder = require('../models/workOrder.model');

        // Fetch active Work Orders to check roll and material consumption
        const activeWorkOrders = await WorkOrder.find({
            tenant: tenantId,
            status: { $ne: 'CANCELLED' },
            'jobOrderDetails.rolls.0': { $exists: true }
        }).select('workOrderNumber jobOrderDetails.rolls').lean();

        // Map consumption of this GRN's rolls
        const rollUsageMap = {};
        const grnRollIdSet = new Set((grn.rolls || []).map(r => String(r._id)));
        const grnRollNumMap = {};
        (grn.rolls || []).forEach(r => {
            if (r.rollNumber) {
                grnRollNumMap[String(r.rollNumber).trim().toUpperCase()] = r;
            }
        });

        for (const wo of activeWorkOrders) {
            const woRolls = wo.jobOrderDetails?.rolls || [];
            for (const r of woRolls) {
                const rId = r.rollId ? String(r.rollId) : (r._id ? String(r._id) : '');
                const rNum = String(r.rollNumber || r.rollNo || '').trim().toUpperCase();
                const matchesGrn = (r.grnId && String(r.grnId) === String(grn._id)) ||
                    (r.grnNumber && String(r.grnNumber).toUpperCase() === String(grn.grnNumber).toUpperCase()) ||
                    (rId && grnRollIdSet.has(rId)) ||
                    (rNum && grnRollNumMap[rNum]);

                if (matchesGrn) {
                    const consumedM = Number(r.consumedLength != null ? r.consumedLength : (r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : 0))) || 0;
                    const consumedKg = Number(r.consumedWeightKg != null ? r.consumedWeightKg : (r.netWeight != null ? r.netWeight : (r.grossWeight != null ? r.grossWeight : 0))) || 0;

                    const targetKey = rNum || rId;
                    if (!rollUsageMap[targetKey]) {
                        rollUsageMap[targetKey] = {
                            rollNumber: r.rollNumber || r.rollNo || 'Roll',
                            consumedMeters: 0,
                            consumedWeightKg: 0,
                            workOrders: new Set()
                        };
                    }
                    rollUsageMap[targetKey].consumedMeters += consumedM;
                    rollUsageMap[targetKey].consumedWeightKg += consumedKg;
                    rollUsageMap[targetKey].workOrders.add(wo.workOrderNumber);
                }
            }
        }

        // Validate incoming rolls against consumption
        const cleanedRolls = Array.isArray(rolls) ? rolls.filter(r => r && (r.rollNumber || r.rollNo) && String(r.rollNumber || r.rollNo).trim()).map(r => {
            const rollNumStr = String(r.rollNumber || r.rollNo).trim().slice(0, 50);
            const matchedExisting = (grn.rolls || []).find(oldR => String(oldR.rollNumber || '').trim().toUpperCase() === rollNumStr.toUpperCase() || (r._id && String(oldR._id) === String(r._id)));

            return {
                _id: matchedExisting?._id || (r._id && mongoose.isValidObjectId(r._id) ? r._id : undefined),
                rollNumber: rollNumStr,
                fabricLength: (r.fabricLength !== undefined && r.fabricLength !== '' && r.fabricLength !== null)
                    ? Number(r.fabricLength)
                    : ((r.length !== undefined && r.length !== '' && r.length !== null) ? Number(r.length) : null),
                width: r.width !== undefined && r.width !== '' && r.width !== null ? Number(r.width) : null,
                grossWeight: r.grossWeight !== undefined && r.grossWeight !== '' && r.grossWeight !== null ? Number(r.grossWeight) : null,
                netWeight: r.netWeight !== undefined && r.netWeight !== '' && r.netWeight !== null ? Number(r.netWeight) : null,
                fabricAverage: r.fabricAverage !== undefined && r.fabricAverage !== '' && r.fabricAverage !== null ? Number(r.fabricAverage) : null,
                totalQuantityKg: (r.totalQuantityKg !== undefined && r.totalQuantityKg !== '' && r.totalQuantityKg !== null)
                    ? Number(r.totalQuantityKg)
                    : ((r.qtyKgs !== undefined && r.qtyKgs !== '' && r.qtyKgs !== null) ? Number(r.qtyKgs) : null),
                totalQuantityPcs: (r.totalQuantityPcs !== undefined && r.totalQuantityPcs !== '' && r.totalQuantityPcs !== null)
                    ? Number(r.totalQuantityPcs)
                    : ((r.qtyPcs !== undefined && r.qtyPcs !== '' && r.qtyPcs !== null) ? Number(r.qtyPcs) : null)
            };
        }) : [];

        // Check if any consumed roll was removed or reduced below consumed quantity
        for (const [key, usage] of Object.entries(rollUsageMap)) {
            if (usage.consumedMeters > 0 || usage.consumedWeightKg > 0) {
                const incomingRoll = cleanedRolls.find(r => String(r.rollNumber).trim().toUpperCase() === key || (r._id && String(r._id) === key));
                const woList = Array.from(usage.workOrders).join(', ');

                if (!incomingRoll) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot remove roll "${usage.rollNumber}". It has already been consumed (${usage.consumedMeters}m / ${usage.consumedWeightKg.toFixed(2)}kg) by Work Order(s): ${woList}.`
                    });
                }

                if (incomingRoll.fabricLength !== null && incomingRoll.fabricLength < usage.consumedMeters) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot reduce roll "${usage.rollNumber}" length to ${incomingRoll.fabricLength}m. A total of ${usage.consumedMeters}m has already been consumed by Work Order(s): ${woList}.`
                    });
                }

                if (incomingRoll.netWeight !== null && incomingRoll.netWeight < usage.consumedWeightKg) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot reduce roll "${usage.rollNumber}" net weight to ${incomingRoll.netWeight}kg. A total of ${usage.consumedWeightKg.toFixed(2)}kg has already been consumed by Work Order(s): ${woList}.`
                    });
                }
            }
        }

        // Validate items and QC testing limits
        const cleanedItems = [];
        if (Array.isArray(items) && items.length > 0) {
            for (const grnItem of items) {
                const rawMaterialId = typeof grnItem.rawMaterial === 'object'
                    ? String(grnItem.rawMaterial?._id || grnItem.rawMaterial?.id || '')
                    : String(grnItem.rawMaterial || '').trim();

                const numQty = Number(grnItem.receivedQuantity);
                if (rawMaterialId && !isNaN(numQty) && numQty >= 0) {
                    cleanedItems.push({
                        rawMaterial: rawMaterialId,
                        receivedQuantity: Number(numQty.toFixed(3)),
                        batchNumber: grnItem.batchNumber ? String(grnItem.batchNumber).trim() : undefined,
                        receivedRolls: (grnItem.receivedRolls !== undefined && grnItem.receivedRolls !== '' && grnItem.receivedRolls !== null) ? Number(grnItem.receivedRolls) : 0,
                        fabricAverage: (grnItem.fabricAverage !== undefined && grnItem.fabricAverage !== '' && grnItem.fabricAverage !== null) ? Number(grnItem.fabricAverage) : null
                    });
                }
            }
        }

        if (cleanedItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one item with a valid received quantity is required.'
            });
        }

        // Check against total roll consumed kg across this GRN
        let totalGrnConsumedKg = 0;
        const allGrnWorkOrders = new Set();
        for (const usage of Object.values(rollUsageMap)) {
            totalGrnConsumedKg += Number(usage.consumedWeightKg || 0);
            usage.workOrders.forEach(w => allGrnWorkOrders.add(w));
        }

        const totalNewRecvQty = cleanedItems.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0);
        if (totalGrnConsumedKg > 0 && totalNewRecvQty < totalGrnConsumedKg) {
            return res.status(400).json({
                success: false,
                message: `Cannot reduce total GRN received quantity to ${totalNewRecvQty.toFixed(3)} Kg. A total of ${totalGrnConsumedKg.toFixed(2)} Kg has already been consumed by Work Order(s): ${Array.from(allGrnWorkOrders).join(', ')}.`
            });
        }

        // Check QC Inspection constraints
        const existingQcs = await QCInspection.find({
            tenant: tenantId,
            grn: grn._id
        }).select('rawMaterial passedQty rejectedQty');

        for (const qc of existingQcs) {
            const inspectedTotal = (qc.passedQty || 0) + (qc.rejectedQty || 0);
            const matchingItem = cleanedItems.find(i => String(i.rawMaterial) === String(qc.rawMaterial));
            if (matchingItem && matchingItem.receivedQuantity < inspectedTotal) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot reduce received quantity to ${matchingItem.receivedQuantity} because ${inspectedTotal} units have already undergone Inbound QC inspection.`
                });
            }
        }

        if (receivingLocation) {
            const loc = await Location.findOne({ _id: receivingLocation, tenant: tenantId });
            if (loc) {
                grn.receivingLocation = receivingLocation;
            }
        }

        if (receivedDate) {
            grn.receivedDate = new Date(receivedDate);
        }

        if (notes !== undefined) {
            grn.notes = notes;
        }

        grn.items = cleanedItems;
        if (cleanedRolls.length > 0) {
            grn.rolls = cleanedRolls;
        }

        grn.lastEditedBy = req.user._id || req.user.id;
        grn.lastEditedAt = new Date();

        await grn.save();

        // Recalculate linked Purchase Order received quantities & status
        if (grn.purchaseOrder) {
            const poDoc = await PurchaseOrder.findOne({ _id: grn.purchaseOrder, tenant: tenantId });
            if (poDoc) {
                const allGrnsForPo = await GRN.find({ purchaseOrder: poDoc._id, tenant: tenantId });

                poDoc.items.forEach((poItem) => {
                    const rmIdStr = String(poItem.rawMaterial?._id || poItem.rawMaterial);
                    let totalRecvForRm = 0;
                    allGrnsForPo.forEach((g) => {
                        (g.items || []).forEach((gi) => {
                            if (String(gi.rawMaterial?._id || gi.rawMaterial) === rmIdStr) {
                                totalRecvForRm += Number(gi.receivedQuantity || 0);
                            }
                        });
                    });
                    poItem.receivedQuantity = Number(totalRecvForRm.toFixed(3));
                });

                const allFullyReceived = poDoc.items.every(i => (i.receivedQuantity || 0) >= (i.orderedQuantity || 0));
                const anyReceived = poDoc.items.some(i => (i.receivedQuantity || 0) > 0);

                if (allFullyReceived) {
                    poDoc.status = 'FULLY_RECEIVED';
                } else if (anyReceived) {
                    poDoc.status = 'PARTIALLY_RECEIVED';
                } else {
                    poDoc.status = 'SENT_TO_SUPPLIER';
                }

                await poDoc.save();
            }
        }

        const populatedGrn = await GRN.findById(grn._id)
            .populate('purchaseOrder', 'poNumber poDate totalValue status')
            .populate('supplier', 'name contactPerson phone')
            .populate('receivingLocation', 'name code type')
            .populate('items.rawMaterial', 'name code uom currentStock')
            .populate('receivedBy', 'name email')
            .populate('lastEditedBy', 'name email');

        return res.status(200).json({
            success: true,
            message: 'Goods Receipt Note updated successfully and PO totals recalculated.',
            data: populatedGrn
        });
    } catch (error) {
        console.error('Error in updateGRN:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update GRN.',
            error: error.message
        });
    }
};

module.exports = {
    createGRN,
    getGRNs,
    getGRNById,
    updateGRN
};
