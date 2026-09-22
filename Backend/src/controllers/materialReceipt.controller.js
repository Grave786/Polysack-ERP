const MaterialReceipt = require('../models/materialReceipt.model');

/**
 * Auto-generate a unique Material Receipt number per tenant & year.
 * Format: MR-{YYYY}-{NNNN}  (e.g. MR-2026-1001)
 */
const generateReceiptNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `MR-${year}-`;

    const last = await MaterialReceipt.findOne({
        tenant: tenantId,
        receiptNumber: { $regex: `^${prefix}\\d{4}$` }
    }).sort({ receiptNumber: -1 });

    let nextNum = 1001;
    if (last && last.receiptNumber) {
        const parts = last.receiptNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) nextNum = lastSeq + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

/**
 * @desc  Calculate total invoice amount
 *        = basicPrice + (basicPrice × gstPercent / 100) + freight − advancePaid
 */
const calcTotal = ({ basicPrice = 0, gstPercent = 0, freight = 0, advancePaid = 0 }) => {
    const bp = Number(basicPrice) || 0;
    const gst = Number(gstPercent) || 0;
    const fr = Number(freight) || 0;
    const adv = Number(advancePaid) || 0;
    return bp + (bp * gst / 100) + fr - adv;
};

/**
 * @route  POST /api/material-receipts
 * @desc   Create a new Job-Work Material Receipt (audit-only, immutable after creation)
 * @access Private (PROCUREMENT:CREATE)
 */
const createMaterialReceipt = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing. Please log in again.' });
        }

        // Strip server-controlled fields from body
        delete req.body.tenant;
        delete req.body.receiptNumber;

        const {
            date,
            invoiceNumber,
            invoiceAttachments,
            customer,
            materialDescription,
            materialQualityFabric,
            fabricGrammage,
            materialQualityBags,
            laminationType,
            fabricColour,
            qualityThreadYarn,
            threadColour,
            fabricAverage,
            bagWidth,
            bagLength,
            bagDimensionUnit,
            bagWeight,
            totalQuantityKg,
            totalQuantityPcs,
            basicPrice,
            gstPercent,
            freight,
            advancePaid,
            vehicleNumber,
            transporterName,
            materialReceiptAttachments,
            printOrPlain
        } = req.body;

        if (!customer) {
            return res.status(400).json({ success: false, message: 'Customer / Company is required.' });
        }

        // Validate attachments count
        if (Array.isArray(invoiceAttachments) && invoiceAttachments.length > 3) {
            return res.status(400).json({ success: false, message: 'Maximum 3 invoice attachments allowed.' });
        }
        if (Array.isArray(materialReceiptAttachments) && materialReceiptAttachments.length > 3) {
            return res.status(400).json({ success: false, message: 'Maximum 3 material receipt attachments allowed.' });
        }

        const receiptNumber = await generateReceiptNumber(tenantId);
        const totalInvoiceAmount = calcTotal({ basicPrice, gstPercent, freight, advancePaid });

        const receipt = await MaterialReceipt.create({
            tenant: tenantId,
            receiptNumber,
            date: date || new Date(),
            invoiceNumber: invoiceNumber || '',
            invoiceAttachments: Array.isArray(invoiceAttachments) ? invoiceAttachments.slice(0, 3) : [],
            customer,
            materialDescription: materialDescription || '',
            materialQualityFabric: materialQualityFabric || '',
            fabricGrammage: fabricGrammage || '',
            materialQualityBags: materialQualityBags || '',
            laminationType: laminationType || '',
            fabricColour: fabricColour || '',
            qualityThreadYarn: qualityThreadYarn || '',
            threadColour: threadColour || '',
            fabricAverage: fabricAverage || '',
            bagWidth: bagWidth !== undefined && bagWidth !== '' ? Number(bagWidth) : null,
            bagLength: bagLength !== undefined && bagLength !== '' ? Number(bagLength) : null,
            bagDimensionUnit: bagDimensionUnit || 'cm',
            bagWeight: bagWeight !== undefined && bagWeight !== '' ? Number(bagWeight) : null,
            totalQuantityKg: totalQuantityKg !== undefined && totalQuantityKg !== '' ? Number(totalQuantityKg) : null,
            totalQuantityPcs: totalQuantityPcs !== undefined && totalQuantityPcs !== '' ? Number(totalQuantityPcs) : null,
            basicPrice: Number(basicPrice) || 0,
            gstPercent: Number(gstPercent) || 0,
            freight: Number(freight) || 0,
            advancePaid: Number(advancePaid) || 0,
            totalInvoiceAmount,
            vehicleNumber: vehicleNumber || '',
            transporterName: transporterName || '',
            materialReceiptAttachments: Array.isArray(materialReceiptAttachments) ? materialReceiptAttachments.slice(0, 3) : [],
            printOrPlain: printOrPlain || 'PLAIN'
        });

        const populated = await MaterialReceipt.findById(receipt._id)
            .populate('customer', 'companyName contactPerson code customerCode')
            .lean();

        return res.status(201).json({
            success: true,
            message: `Material Receipt ${receiptNumber} created successfully.`,
            data: populated
        });

    } catch (err) {
        console.error('[MaterialReceipt] createMaterialReceipt error:', err);
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A receipt with this number already exists. Please retry.' });
        }
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to create Material Receipt.'
        });
    }
};

/**
 * @route  GET /api/material-receipts
 * @desc   Get all Material Receipts for current tenant (paginated)
 * @access Private (PROCUREMENT:READ)
 */
const getMaterialReceipts = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = { tenant: tenantId };

        // Optional search by receipt number, invoice number
        if (req.query.search) {
            const re = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { receiptNumber: re },
                { invoiceNumber: re },
                { materialDescription: re },
                { vehicleNumber: re }
            ];
        }

        const [receipts, total] = await Promise.all([
            MaterialReceipt.find(filter)
                .populate('customer', 'companyName contactPerson code customerCode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MaterialReceipt.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            data: receipts,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('[MaterialReceipt] getMaterialReceipts error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch Material Receipts.' });
    }
};

/**
 * @route  GET /api/material-receipts/:id
 * @desc   Get a single Material Receipt by ID
 * @access Private (PROCUREMENT:READ)
 */
const getMaterialReceiptById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        const { id } = req.params;

        const receipt = await MaterialReceipt.findOne({ _id: id, tenant: tenantId })
            .populate('customer', 'companyName contactPerson code customerCode gstin city state')
            .lean();

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Material Receipt not found.' });
        }

        return res.status(200).json({ success: true, data: receipt });

    } catch (err) {
        console.error('[MaterialReceipt] getMaterialReceiptById error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch Material Receipt.' });
    }
};

module.exports = {
    createMaterialReceipt,
    getMaterialReceipts,
    getMaterialReceiptById
};
