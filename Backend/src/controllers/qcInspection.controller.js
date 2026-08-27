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

        if (isNaN(numSampleSize) || numSampleSize < 1 || isNaN(numPassedQty) || numPassedQty < 0 || isNaN(numRejectedQty) || numRejectedQty < 0) {
            return res.status(400).json({
                success: false,
                message: 'sampleSize must be >= 1, and passedQty/rejectedQty must be non-negative numbers.'
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
            if (grn) {
                grnDoc = await GRN.findOne({ _id: grn, tenant: tenantId });
            }

            const qcDocs = await QCInspection.create([{
                tenant: tenantId,
                inspectionType: 'INBOUND',
                qcCertificateNumber,
                grn: grnDoc?._id || undefined,
                po: grnDoc?.purchaseOrder || undefined,
                rawMaterial: rmDoc._id,
                supplier: grnDoc?.supplier || rmDoc.defaultSupplier || undefined,
                receivedQty: totalTested,
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

            const availablePending = fgDoc.pendingQCStock || 0;
            if (totalTested > availablePending) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot inspect ${totalTested} units. Only ${availablePending} units are currently pending QC for '${fgDoc.name}'.`
                });
            }

            const qcDocs = await QCInspection.create([{
                tenant: tenantId,
                inspectionType: 'OUTBOUND',
                qcCertificateNumber,
                workOrder: workOrderDoc._id,
                finishedGood: fgDoc._id,
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

module.exports = {
    createQCInspection,
    getQCInspections,
    getQCInspectionById
};
