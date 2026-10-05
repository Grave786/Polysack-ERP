const mongoose = require('mongoose');
const QCInspection = require('../models/qcInspection.model');
const WorkOrder = require('../models/workOrder.model');
const FinishedGood = require('../models/finishedGood.model');
const RawMaterial = require('../models/rawMaterial.model');
const GRN = require('../models/grn.model');
const { executeStockTransactionCore } = require('./stockTransaction.controller');

/**
 * Helper function to auto-generate unique QC Certificate number per tenant & year
 */
const generateQcCertificateNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `QC-${year}-`;

    const lastQc = await QCInspection.findOne({
        tenant: tenantId,
        qcCertificateNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ qcCertificateNumber: -1 });

    let nextNumber = 1001; // Default starting sequence
    if (lastQc && lastQc.qcCertificateNumber) {
        const parts = lastQc.qcCertificateNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Create a new Quality Control Inspection record (INBOUND or OUTBOUND)
 * @route   POST /api/qc-inspections
 * @access  Private (QUALITY:CREATE permission)
 */
const createQCInspection = async (req, res) => {
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
        delete req.body.qcCertificateNumber;
        delete req.body.qcStatus;
        delete req.body.inspectedBy;

        const {
            inspectionType = 'OUTBOUND',
            workOrder,
            grn,
            rawMaterial,
            sampleSize,
            passedQty,
            rejectedQty,
            tensileStrength,
            gsmTested,
            defects
        } = req.body;

        const numSampleSize = Number(sampleSize || 1);
        const numPassedQty = Number(passedQty);
        const numRejectedQty = Number(rejectedQty);

        if (isNaN(numSampleSize) || numSampleSize <= 0 || isNaN(numPassedQty) || numPassedQty < 0 || isNaN(numRejectedQty) || numRejectedQty < 0) {
            return res.status(400).json({
                success: false,
                message: 'sampleSize must be > 0, and passedQty/rejectedQty must be non-negative numbers.'
            });
        }

        const totalTested = numPassedQty + numRejectedQty;
        if (totalTested === 0) {
            return res.status(400).json({
                success: false,
                message: 'Total tested quantity (passedQty + rejectedQty) must be greater than 0.'
            });
        }

        let computedQcStatus = 'PASSED';
        if (numRejectedQty === 0) computedQcStatus = 'PASSED';
        else if (numPassedQty === 0) computedQcStatus = 'FAILED';
        else computedQcStatus = 'PARTIAL';

        const qcCertificateNumber = await generateQcCertificateNumber(tenantId);

        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};
        const createdStockTransactions = [];
        let qcInspection = null;

        if (inspectionType === 'INBOUND') {
            // INBOUND RAW MATERIAL INSPECTION
            if (!rawMaterial) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide rawMaterial for Inbound QC Inspection.'
                });
            }

            const rmDoc = await RawMaterial.findOne({ _id: rawMaterial, tenant: tenantId });
            if (!rmDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Raw Material not found in your organization.'
                });
            }

            let grnDoc = null;
            let totalReceivedQty = totalTested;

            if (grn) {
                grnDoc = await GRN.findOne({ _id: grn, tenant: tenantId });
                if (!grnDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Specified GRN does not exist or does not belong to your organization.'
                    });
                }

                // Locate the line item in this GRN
                const grnItem = grnDoc.items.find(item => String(item.rawMaterial) === String(rawMaterial));
                if (!grnItem) {
                    return res.status(400).json({
                        success: false,
                        message: `Raw Material '${rmDoc.name}' (${rmDoc.code || ''}) is not part of GRN ${grnDoc.grnNumber}.`
                    });
                }

                totalReceivedQty = grnItem.receivedQuantity;

                // Calculate cumulative tested quantity for this GRN line item across previous QC inspections
                const existingQcs = await QCInspection.find({
                    tenant: tenantId,
                    inspectionType: 'INBOUND',
                    grn: grnDoc._id,
                    rawMaterial: rmDoc._id
                }).select('passedQty rejectedQty');

                const alreadyInspectedQty = Number(existingQcs.reduce((sum, q) => sum + (q.passedQty || 0) + (q.rejectedQty || 0), 0).toFixed(3));
                const remainingUninspected = Number((totalReceivedQty - alreadyInspectedQty).toFixed(3));

                if (remainingUninspected <= 0.0001) {
                    return res.status(400).json({
                        success: false,
                        message: `This GRN line item has already been fully inspected (${totalReceivedQty} received, ${alreadyInspectedQty} already tested). No further QC inspections can be logged.`
                    });
                }

                if (totalTested > (remainingUninspected + 0.0001)) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot inspect ${totalTested} units. Only ${remainingUninspected} units remain un-inspected for this GRN line item (Received: ${totalReceivedQty}, Already Inspected: ${alreadyInspectedQty}).`
                    });
                }
            }

            const qcDocs = await QCInspection.create([{
                tenant: tenantId,
                inspectionType: 'INBOUND',
                qcCertificateNumber,
                grn: grnDoc?._id || undefined,
                po: grnDoc?.purchaseOrder || undefined,
                rawMaterial: rmDoc._id,
                supplier: grnDoc?.supplier || rmDoc.defaultSupplier || undefined,
                receivedQty: totalReceivedQty,
                sampleSize: numSampleSize,
                passedQty: numPassedQty,
                rejectedQty: numRejectedQty,
                tensileStrength: tensileStrength !== undefined ? Number(tensileStrength) : undefined,
                gsmTested: gsmTested !== undefined ? Number(gsmTested) : undefined,
                defects,
                qcStatus: computedQcStatus,
                inspectedBy: req.user._id || req.user.id
            }], sessionOption);

            qcInspection = qcDocs[0];

            // Inbound stock gate: only passedQty increments usable RawMaterial.currentStock
            if (numPassedQty > 0) {
                const passedResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qcCertificateNumber,
                    itemType: 'RAW_MATERIAL',
                    item: rmDoc._id,
                    transactionType: 'QC_PASSED',
                    quantity: numPassedQty,
                    notes: `Inbound QC approved ${numPassedQty} units (Certificate: ${qcCertificateNumber})`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                createdStockTransactions.push(passedResult.transaction);
            }

            if (numRejectedQty > 0) {
                const rejectedResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qcCertificateNumber,
                    itemType: 'RAW_MATERIAL',
                    item: rmDoc._id,
                    transactionType: 'QC_REJECTED',
                    quantity: numRejectedQty,
                    notes: `Inbound QC rejected ${numRejectedQty} units (Certificate: ${qcCertificateNumber})${defects ? `. Defects: ${defects}` : ''}`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                createdStockTransactions.push(rejectedResult.transaction);
            }
        } else {
            // OUTBOUND FINISHED GOODS INSPECTION
            if (!workOrder) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide workOrder for Outbound QC Inspection.'
                });
            }

            const workOrderDoc = await WorkOrder.findOne({ _id: workOrder, tenant: tenantId });
            if (!workOrderDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Work Order not found in your organization.'
                });
            }

            const fgDoc = await FinishedGood.findOne({ _id: workOrderDoc.finishedGood, tenant: tenantId });
            if (!fgDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Finished Good reference on Work Order not found.'
                });
            }

            const totalProducedQty = workOrderDoc.completedQuantity || workOrderDoc.targetQuantity || 0;

            // Calculate cumulative tested quantity for this Work Order across previous Outbound QC inspections
            const existingQcs = await QCInspection.find({
                tenant: tenantId,
                inspectionType: 'OUTBOUND',
                workOrder: workOrderDoc._id
            }).select('passedQty rejectedQty');

            const alreadyInspectedQty = Number(existingQcs.reduce((sum, q) => sum + (q.passedQty || 0) + (q.rejectedQty || 0), 0).toFixed(3));
            const remainingUninspected = Number((totalProducedQty - alreadyInspectedQty).toFixed(3));

            if (remainingUninspected <= 0.0001) {
                return res.status(400).json({
                    success: false,
                    message: `Work Order '${workOrderDoc.workOrderNumber}' has already been fully inspected (${totalProducedQty} produced, ${alreadyInspectedQty} inspected). No further QC inspections can be logged.`
                });
            }

            if (totalTested > (remainingUninspected + 0.0001)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot inspect ${totalTested} units. Only ${remainingUninspected} units remain to be inspected for Work Order '${workOrderDoc.workOrderNumber}' (Produced: ${totalProducedQty}, Already Inspected: ${alreadyInspectedQty}).`
                });
            }

            const qcDocs = await QCInspection.create([{
                tenant: tenantId,
                inspectionType: 'OUTBOUND',
                qcCertificateNumber,
                workOrder: workOrderDoc._id,
                finishedGood: fgDoc._id,
                receivedQty: totalProducedQty,
                sampleSize: numSampleSize,
                passedQty: numPassedQty,
                rejectedQty: numRejectedQty,
                tensileStrength: tensileStrength !== undefined ? Number(tensileStrength) : undefined,
                gsmTested: gsmTested !== undefined ? Number(gsmTested) : undefined,
                defects,
                qcStatus: computedQcStatus,
                inspectedBy: req.user._id || req.user.id
            }], sessionOption);

            qcInspection = qcDocs[0];

            if (numPassedQty > 0) {
                const passedResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qcCertificateNumber,
                    itemType: 'FINISHED_GOOD',
                    item: fgDoc._id,
                    transactionType: 'QC_PASSED',
                    quantity: numPassedQty,
                    notes: `Outbound QC approved ${numPassedQty} units (Certificate: ${qcCertificateNumber})`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                createdStockTransactions.push(passedResult.transaction);
            }

            if (numRejectedQty > 0) {
                const rejectedResult = await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qcCertificateNumber,
                    itemType: 'FINISHED_GOOD',
                    item: fgDoc._id,
                    transactionType: 'QC_REJECTED',
                    quantity: numRejectedQty,
                    notes: `Outbound QC rejected ${numRejectedQty} units (Certificate: ${qcCertificateNumber})${defects ? `. Defects: ${defects}` : ''}`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);

                createdStockTransactions.push(rejectedResult.transaction);
            }
        }

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await qcInspection.populate([
            { path: 'workOrder', select: 'workOrderNumber status targetQuantity completedQuantity' },
            { path: 'finishedGood', select: 'name code uom currentStock pendingQCStock' },
            { path: 'grn', select: 'grnNumber' },
            { path: 'rawMaterial', select: 'name code uom currentStock' },
            { path: 'supplier', select: 'name' },
            { path: 'inspectedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: `QC Inspection '${qcCertificateNumber}' processed successfully. Status: '${computedQcStatus}'.`,
            data: {
                qcInspection,
                stockTransactionsCreated: createdStockTransactions
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
        }
        console.error('Error in createQCInspection:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to process QC Inspection.'
        });
    }
};

/**
 * @desc    Get all QC Inspections scoped to user's tenant
 * @route   GET /api/qc-inspections
 * @access  Private (QUALITY:READ permission)
 */
const getQCInspections = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { inspectionType, workOrder, finishedGood, rawMaterial, qcStatus, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (inspectionType) filter.inspectionType = inspectionType;
        if (workOrder) filter.workOrder = workOrder;
        if (finishedGood) filter.finishedGood = finishedGood;
        if (rawMaterial) filter.rawMaterial = rawMaterial;
        if (qcStatus) filter.qcStatus = qcStatus;

        if (search) {
            filter.qcCertificateNumber = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [inspections, total] = await Promise.all([
            QCInspection.find(filter)
                .populate('workOrder', 'workOrderNumber status')
                .populate('finishedGood', 'name code uom')
                .populate('grn', 'grnNumber')
                .populate('rawMaterial', 'name code uom')
                .populate('supplier', 'name')
                .populate('inspectedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            QCInspection.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: inspections.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: inspections
        });
    } catch (error) {
        console.error('Error in getQCInspections:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch QC Inspections.',
            error: error.message
        });
    }
};

/**
 * @desc    Get QC Inspection by ID scoped to user's tenant
 * @route   GET /api/qc-inspections/:id
 * @access  Private (QUALITY:READ permission)
 */
const getQCInspectionById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const inspection = await QCInspection.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('workOrder', 'workOrderNumber status targetQuantity completedQuantity')
            .populate('finishedGood', 'name code uom currentStock pendingQCStock')
            .populate('grn', 'grnNumber')
            .populate('rawMaterial', 'name code uom currentStock')
            .populate('supplier', 'name')
            .populate('inspectedBy', 'name email');

        if (!inspection) {
            return res.status(404).json({
                success: false,
                message: 'QC Inspection not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: inspection
        });
    } catch (error) {
        console.error('Error in getQCInspectionById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve QC Inspection.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all pending QC targets (GRN line items & Work Orders) with calculated remaining uninspected quantities
 * @route   GET /api/qc-inspections/pending-targets
 * @access  Private (QUALITY:READ permission)
 */
const getPendingQcTargets = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // 1. Fetch GRNs for Inbound QC
        const grns = await GRN.find({ tenant: tenantId })
            .populate('items.rawMaterial', 'name code uom currentStock')
            .populate('supplier', 'name')
            .populate('purchaseOrder', 'poNumber')
            .sort({ createdAt: -1 });

        const inboundInspections = await QCInspection.find({
            tenant: tenantId,
            inspectionType: 'INBOUND',
            grn: { $exists: true, $ne: null }
        }).select('grn rawMaterial passedQty rejectedQty');

        const inboundTestedMap = {};
        inboundInspections.forEach((qc) => {
            const key = `${String(qc.grn)}_${String(qc.rawMaterial)}`;
            const tested = (qc.passedQty || 0) + (qc.rejectedQty || 0);
            inboundTestedMap[key] = (inboundTestedMap[key] || 0) + tested;
        });

        const pendingInbound = [];
        grns.forEach((grn) => {
            grn.items.forEach((item) => {
                if (!item.rawMaterial) return;
                const rmId = String(item.rawMaterial._id || item.rawMaterial);
                const key = `${String(grn._id)}_${rmId}`;
                const alreadyInspected = inboundTestedMap[key] || 0;
                const receivedQty = item.receivedQuantity || 0;
                const remainingQty = Math.max(0, receivedQty - alreadyInspected);

                if (remainingQty > 0) {
                    pendingInbound.push({
                        grnId: grn._id,
                        grnNumber: grn.grnNumber,
                        poNumber: grn.purchaseOrder?.poNumber || '-',
                        supplierName: grn.supplier?.name || '-',
                        rawMaterial: {
                            _id: item.rawMaterial._id || item.rawMaterial,
                            name: item.rawMaterial.name || 'Raw Material',
                            code: item.rawMaterial.code || '-',
                            uom: item.rawMaterial.uom?.name || 'KG'
                        },
                        receivedQuantity: receivedQty,
                        alreadyInspected,
                        remainingQuantity: remainingQty
                    });
                }
            });
        });

        // 2. Fetch WorkOrders for Outbound QC
        const workOrders = await WorkOrder.find({
            tenant: tenantId,
            status: { $in: ['IN_PROGRESS', 'COMPLETED'] }
        })
            .populate('finishedGood', 'name code uom currentStock pendingQCStock')
            .populate('customer', 'name')
            .sort({ createdAt: -1 });

        const outboundInspections = await QCInspection.find({
            tenant: tenantId,
            inspectionType: 'OUTBOUND',
            workOrder: { $exists: true, $ne: null }
        }).select('workOrder passedQty rejectedQty');

        const outboundTestedMap = {};
        outboundInspections.forEach((qc) => {
            const key = String(qc.workOrder);
            const tested = (qc.passedQty || 0) + (qc.rejectedQty || 0);
            outboundTestedMap[key] = (outboundTestedMap[key] || 0) + tested;
        });

        const pendingOutbound = [];
        workOrders.forEach((wo) => {
            if (!wo.finishedGood) return;
            const totalProduced = wo.completedQuantity || wo.targetQuantity || 0;
            const alreadyInspected = outboundTestedMap[String(wo._id)] || 0;
            const remainingQty = Math.max(0, totalProduced - alreadyInspected);

            if (remainingQty > 0) {
                pendingOutbound.push({
                    workOrderId: wo._id,
                    workOrderNumber: wo.workOrderNumber,
                    customerName: wo.customer?.name || '-',
                    finishedGood: {
                        _id: wo.finishedGood._id || wo.finishedGood,
                        name: wo.finishedGood.name || 'Finished Product',
                        code: wo.finishedGood.code || '-',
                        uom: wo.finishedGood.uom?.name || 'BAG'
                    },
                    totalProduced,
                    alreadyInspected,
                    remainingQuantity: remainingQty
                });
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                inbound: pendingInbound,
                outbound: pendingOutbound
            }
        });
    } catch (err) {
        console.error('Error fetching pending QC targets:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending QC targets',
            error: err.message
        });
    }
};

/**
 * @desc    Update an existing Quality Control Inspection record in place
 * @route   PUT /api/qc-inspections/:id
 * @access  Private (Tenant Admin only)
 */
const updateQCInspection = async (req, res) => {
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

        const qcId = req.params.id;
        const qc = await QCInspection.findOne({ _id: qcId, tenant: tenantId });
        if (!qc) {
            return res.status(404).json({
                success: false,
                message: 'QC Inspection not found in your organization.'
            });
        }

        const {
            sampleSize,
            passedQty,
            rejectedQty,
            tensileStrength,
            gsmTested,
            defects
        } = req.body;

        const numSampleSize = sampleSize !== undefined ? Number(sampleSize) : (qc.sampleSize || 1);
        const numPassedQty = passedQty !== undefined ? Number(passedQty) : (qc.passedQty || 0);
        const numRejectedQty = rejectedQty !== undefined ? Number(rejectedQty) : (qc.rejectedQty || 0);

        if (isNaN(numSampleSize) || numSampleSize <= 0 || isNaN(numPassedQty) || numPassedQty < 0 || isNaN(numRejectedQty) || numRejectedQty < 0) {
            return res.status(400).json({
                success: false,
                message: 'sampleSize must be > 0, and passedQty/rejectedQty must be non-negative numbers.'
            });
        }

        const totalTested = Number((numPassedQty + numRejectedQty).toFixed(3));
        if (totalTested <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Total tested quantity (passedQty + rejectedQty) must be greater than 0.'
            });
        }

        let computedQcStatus = 'PASSED';
        if (numRejectedQty === 0) computedQcStatus = 'PASSED';
        else if (numPassedQty === 0) computedQcStatus = 'FAILED';
        else computedQcStatus = 'PARTIAL';

        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch {
            useTransaction = false;
        }

        const sessionOption = useTransaction ? { session } : {};
        const oldPassed = Number(qc.passedQty || 0);
        const oldRejected = Number(qc.rejectedQty || 0);
        const diffPassed = Number((numPassedQty - oldPassed).toFixed(3));

        if (qc.inspectionType === 'INBOUND') {
            const rmDoc = await RawMaterial.findOne({ _id: qc.rawMaterial, tenant: tenantId });
            if (!rmDoc) {
                if (useTransaction && session) await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Linked Raw Material not found in your organization.'
                });
            }

            let grnDoc = null;
            if (qc.grn) {
                grnDoc = await GRN.findOne({ _id: qc.grn, tenant: tenantId });
                if (grnDoc) {
                    const grnItem = (grnDoc.items || []).find(item => String(item.rawMaterial) === String(qc.rawMaterial));
                    const totalReceivedQty = grnItem ? grnItem.receivedQuantity : (qc.receivedQty || totalTested);

                    // Check other QCs on this GRN line item
                    const otherQcs = await QCInspection.find({
                        tenant: tenantId,
                        inspectionType: 'INBOUND',
                        grn: grnDoc._id,
                        rawMaterial: qc.rawMaterial,
                        _id: { $ne: qc._id }
                    }).select('passedQty rejectedQty');

                    const otherInspected = Number(otherQcs.reduce((sum, q) => sum + (q.passedQty || 0) + (q.rejectedQty || 0), 0).toFixed(3));
                    const maxInspectable = Number((totalReceivedQty - otherInspected).toFixed(3));

                    if (totalTested > (maxInspectable + 0.0001)) {
                        if (useTransaction && session) await session.abortTransaction();
                        return res.status(400).json({
                            success: false,
                            message: `Cannot inspect ${totalTested} units. Maximum remaining inspectable quantity for this GRN line item is ${maxInspectable} (Received: ${totalReceivedQty}, Inspected by other QCs: ${otherInspected}).`
                        });
                    }

                    // Check downstream consumption of fabric rolls
                    const activeWorkOrders = await WorkOrder.find({
                        tenant: tenantId,
                        status: { $in: ['IN_PROGRESS', 'COMPLETED'] },
                        'jobOrderDetails.rolls': { $exists: true, $ne: [] }
                    }).select('workOrderNumber jobOrderDetails.rolls');

                    let totalRollConsumedKg = 0;
                    const consumedWorkOrders = new Set();
                    const grnRollIdSet = new Set((grnDoc.rolls || []).map(r => String(r._id)));
                    const grnRollNumMap = {};
                    (grnDoc.rolls || []).forEach(r => {
                        if (r.rollNumber) grnRollNumMap[String(r.rollNumber).trim().toUpperCase()] = true;
                    });

                    for (const wo of activeWorkOrders) {
                        for (const r of (wo.jobOrderDetails?.rolls || [])) {
                            const rId = r.rollId ? String(r.rollId) : (r._id ? String(r._id) : '');
                            const rNum = String(r.rollNumber || r.rollNo || '').trim().toUpperCase();
                            if ((r.grnId && String(r.grnId) === String(grnDoc._id)) ||
                                (r.grnNumber && String(r.grnNumber).toUpperCase() === String(grnDoc.grnNumber).toUpperCase()) ||
                                (rId && grnRollIdSet.has(rId)) ||
                                (rNum && grnRollNumMap[rNum])) {
                                const cKg = Number(r.consumedWeightKg != null ? r.consumedWeightKg : (r.netWeight != null ? r.netWeight : (r.grossWeight || 0))) || 0;
                                totalRollConsumedKg += cKg;
                                consumedWorkOrders.add(wo.workOrderNumber);
                            }
                        }
                    }

                    if (totalRollConsumedKg > 0 && numPassedQty < (totalRollConsumedKg - 0.001)) {
                        if (useTransaction && session) await session.abortTransaction();
                        return res.status(400).json({
                            success: false,
                            message: `Cannot reduce passed quantity to ${numPassedQty} units. A total of ${totalRollConsumedKg.toFixed(2)} Kg of fabric rolls from this GRN has already been consumed by Work Order(s): ${Array.from(consumedWorkOrders).join(', ')}.`
                        });
                    }
                }
            }

            // Downstream stock check: cannot reduce passed quantity if stock has already been consumed
            if (diffPassed < 0) {
                const reduction = Math.abs(diffPassed);
                if (Number(rmDoc.currentStock || 0) < reduction) {
                    if (useTransaction && session) await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: `Cannot reduce passed quantity from ${oldPassed} to ${numPassedQty} (${reduction} units reduction). The approved raw material stock has already been consumed downstream by Work Orders. Current available stock is only ${rmDoc.currentStock || 0} units.`
                    });
                }

                await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qc.qcCertificateNumber,
                    itemType: 'RAW_MATERIAL',
                    item: rmDoc._id,
                    transactionType: 'STOCK_OUT',
                    quantity: reduction,
                    notes: `Inbound QC ${qc.qcCertificateNumber} edited: approved quantity reduced by ${reduction} units`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);
            } else if (diffPassed > 0) {
                await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qc.qcCertificateNumber,
                    itemType: 'RAW_MATERIAL',
                    item: rmDoc._id,
                    transactionType: 'QC_PASSED',
                    quantity: diffPassed,
                    notes: `Inbound QC ${qc.qcCertificateNumber} edited: additional ${diffPassed} units approved`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);
            }
        } else {
            // OUTBOUND FINISHED GOODS QC UPDATE
            const woDoc = await WorkOrder.findOne({ _id: qc.workOrder, tenant: tenantId });
            const fgDoc = await FinishedGood.findOne({ _id: qc.finishedGood, tenant: tenantId });

            if (!fgDoc) {
                if (useTransaction && session) await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: 'Finished Good reference not found in your organization.'
                });
            }

            const totalProduced = woDoc ? (woDoc.completedQuantity || woDoc.targetQuantity || 0) : (qc.receivedQty || totalTested);

            // Check other QCs on this Work Order
            const otherQcs = await QCInspection.find({
                tenant: tenantId,
                inspectionType: 'OUTBOUND',
                workOrder: qc.workOrder,
                _id: { $ne: qc._id }
            }).select('passedQty rejectedQty');

            const otherInspected = Number(otherQcs.reduce((sum, q) => sum + (q.passedQty || 0) + (q.rejectedQty || 0), 0).toFixed(3));
            const maxInspectable = Number((totalProduced - otherInspected).toFixed(3));

            if (totalTested > (maxInspectable + 0.0001)) {
                if (useTransaction && session) await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: `Cannot inspect ${totalTested} units. Maximum remaining inspectable quantity for Work Order '${woDoc?.workOrderNumber || ''}' is ${maxInspectable} (Produced: ${totalProduced}, Inspected by other QCs: ${otherInspected}).`
                });
            }

            // Downstream stock check: cannot reduce passed finished bags if already dispatched/sold
            if (diffPassed < 0) {
                const reduction = Math.abs(diffPassed);
                if (Number(fgDoc.currentStock || 0) < reduction) {
                    if (useTransaction && session) await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: `Cannot reduce passed quantity from ${oldPassed} to ${numPassedQty} (${reduction} bags reduction). These finished goods have already been dispatched or sold downstream. Current available stock is only ${fgDoc.currentStock || 0} bags.`
                    });
                }

                // Adjust stock balances in-place
                fgDoc.currentStock = Math.max(0, Number(((fgDoc.currentStock || 0) - reduction).toFixed(3)));
                fgDoc.pendingQCStock = Number(((fgDoc.pendingQCStock || 0) + reduction).toFixed(3));
                await fgDoc.save(sessionOption);

                await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qc.qcCertificateNumber,
                    itemType: 'FINISHED_GOOD',
                    item: fgDoc._id,
                    transactionType: 'STOCK_OUT',
                    quantity: reduction,
                    notes: `Outbound QC ${qc.qcCertificateNumber} edited: passed quantity reduced by ${reduction} bags returned to pending QC`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);
            } else if (diffPassed > 0) {
                fgDoc.pendingQCStock = Math.max(0, Number(((fgDoc.pendingQCStock || 0) - diffPassed).toFixed(3)));
                fgDoc.currentStock = Number(((fgDoc.currentStock || 0) + diffPassed).toFixed(3));
                await fgDoc.save(sessionOption);

                await executeStockTransactionCore({
                    tenantId,
                    referenceNumber: qc.qcCertificateNumber,
                    itemType: 'FINISHED_GOOD',
                    item: fgDoc._id,
                    transactionType: 'QC_PASSED',
                    quantity: diffPassed,
                    notes: `Outbound QC ${qc.qcCertificateNumber} edited: additional ${diffPassed} bags approved`,
                    performedBy: req.user._id || req.user.id
                }, sessionOption);
            }

            // Adjust pendingQCStock for changes in rejectedQty
            const diffRejected = Number((numRejectedQty - oldRejected).toFixed(3));
            if (diffRejected > 0) {
                fgDoc.pendingQCStock = Math.max(0, Number(((fgDoc.pendingQCStock || 0) - diffRejected).toFixed(3)));
                await fgDoc.save(sessionOption);
            } else if (diffRejected < 0) {
                fgDoc.pendingQCStock = Number(((fgDoc.pendingQCStock || 0) + Math.abs(diffRejected)).toFixed(3));
                await fgDoc.save(sessionOption);
            }
        }

        // Update QC record in place
        qc.sampleSize = numSampleSize;
        qc.passedQty = numPassedQty;
        qc.rejectedQty = numRejectedQty;
        if (tensileStrength !== undefined) qc.tensileStrength = tensileStrength !== '' ? Number(tensileStrength) : undefined;
        if (gsmTested !== undefined) qc.gsmTested = gsmTested !== '' ? Number(gsmTested) : undefined;
        if (defects !== undefined) qc.defects = defects;
        qc.qcStatus = computedQcStatus;
        await qc.save(sessionOption);

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        await qc.populate([
            { path: 'workOrder', select: 'workOrderNumber status targetQuantity completedQuantity' },
            { path: 'finishedGood', select: 'name code uom currentStock pendingQCStock' },
            { path: 'grn', select: 'grnNumber' },
            { path: 'rawMaterial', select: 'name code uom currentStock' },
            { path: 'supplier', select: 'name' },
            { path: 'inspectedBy', select: 'name email' }
        ]);

        return res.status(200).json({
            success: true,
            message: `QC Inspection '${qc.qcCertificateNumber}' updated successfully. Status: '${computedQcStatus}'.`,
            data: qc
        });
    } catch (error) {
        if (useTransaction && session) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
        }
        console.error('Error in updateQCInspection:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update QC Inspection.',
            error: error.message
        });
    }
};

module.exports = {
    createQCInspection,
    updateQCInspection,
    getQCInspections,
    getQCInspectionById,
    getPendingQcTargets
};
