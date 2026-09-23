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

            const currentReceived = poItem.receivedQuantity || 0;
            const remainingAllowed = poItem.orderedQuantity - currentReceived;

            if (numQty > remainingAllowed) {
                if (useTransaction && session) {
                    if (session.inTransaction()) await session.abortTransaction();
                    session.endSession();
                }
                return res.status(400).json({
                    success: false,
                    message: `Cannot receive ${numQty} units. Ordered: ${poItem.orderedQuantity}, Received: ${currentReceived}, Allowed: ${remainingAllowed}.`
                });
            }

            cleanedItems.push({
                rawMaterial: rawMaterialId,
                receivedQuantity: numQty,
                batchNumber: grnItem.batchNumber ? String(grnItem.batchNumber).trim() : undefined
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
            totalQuantityKg: (r.totalQuantityKg !== undefined && r.totalQuantityKg !== '' && r.totalQuantityKg !== null)
                ? Number(r.totalQuantityKg)
                : ((r.qtyKgs !== undefined && r.qtyKgs !== '' && r.qtyKgs !== null) ? Number(r.qtyKgs) : null),
            totalQuantityPcs: (r.totalQuantityPcs !== undefined && r.totalQuantityPcs !== '' && r.totalQuantityPcs !== null)
                ? Number(r.totalQuantityPcs)
                : ((r.qtyPcs !== undefined && r.qtyPcs !== '' && r.qtyPcs !== null) ? Number(r.qtyPcs) : null)
        })) : [];

        if (!cleanedRolls || cleanedRolls.length === 0) {
            if (useTransaction && session) {
                if (session.inTransaction()) await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({
                success: false,
                message: 'At least one roll entry with a valid Roll Number is required for GRN creation.'
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
                poItem.receivedQuantity += grnItem.receivedQuantity;

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
