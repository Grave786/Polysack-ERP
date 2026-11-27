const mongoose = require('mongoose');
const SalesOrder = require('../models/salesOrder.model');
const WorkOrder = require('../models/workOrder.model');
const Notification = require('../models/notification.model');
const { getAvgBagWeightKg, resolveBagWeightSpec } = require('../utils/bagWeightHelper');

/**
 * Resolve a stable line identifier for a Sales Order item (handles legacy items without _id).
 */
const getSoLineId = (item, idx) => {
    if (item?._id) return String(item._id);
    return `idx_${idx}`;
};

/**
 * Convert an SO line quantity & unit into Work Order counting units (Bags/Pcs).
 * Pcs and Bags are treated 1:1. Kg uses bag weight if available. Roll returns null if no conversion.
 */
const convertSoQtyToBags = (qty, unit, finishedGood, bomDoc = null) => {
    const numQty = Number(qty || 0);
    const u = String(unit || 'Pcs').trim().toLowerCase();

    if (['pcs', 'pc', 'bags', 'bag', 'units', 'unit', ''].includes(u)) {
        return {
            convertedBags: numQty,
            hasConversion: true,
            isDirectCountUnit: true,
            conversionNote: ''
        };
    }

    if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) {
        const avgKg = getAvgBagWeightKg(finishedGood, bomDoc);
        if (avgKg && avgKg > 0) {
            return {
                convertedBags: Math.ceil(numQty / avgKg),
                hasConversion: true,
                isDirectCountUnit: false,
                conversionNote: `Converted from ${numQty.toLocaleString('en-IN')} Kg (~${(avgKg * 1000).toFixed(0)}g/bag)`
            };
        }
        return {
            convertedBags: null,
            hasConversion: false,
            isDirectCountUnit: false,
            conversionNote: `SO unit is ${unit} and no bag weight conversion is configured on this Finished Bag.`
        };
    }

    return {
        convertedBags: null,
        hasConversion: false,
        isDirectCountUnit: false,
        conversionNote: `SO unit is ${unit}; please enter Work Order target quantity in Bags manually.`
    };
};

const convertBagsToSoUnit = (bagsQty, unit, finishedGood, bomDoc = null) => {
    const numBags = Number(bagsQty || 0);
    const u = String(unit || 'Pcs').trim().toLowerCase();
    if (['pcs', 'pc', 'bags', 'bag', 'units', 'unit', ''].includes(u)) {
        return { convertedQty: numBags, hasConversion: true };
    }
    if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) {
        const avgKg = getAvgBagWeightKg(finishedGood, bomDoc);
        if (avgKg && avgKg > 0) {
            return { convertedQty: Number((numBags * avgKg).toFixed(2)), hasConversion: true };
        }
    }
    return { convertedQty: null, hasConversion: false };
};

/**
 * Match a WorkOrder to a specific SO line item.
 */
const doesWoMatchSoLine = (wo, item, idx) => {
    const lineId = getSoLineId(item, idx);
    if (wo.salesOrderLineId) {
        if (String(wo.salesOrderLineId) === lineId) return true;
        if (String(wo.salesOrderLineId) === String(idx)) return true;
        return false;
    }
    const woFgId = String(wo.finishedGood?._id || wo.finishedGood || '');
    const itemFgId = String(item.finishedGood?._id || item.finishedGood || '');
    return Boolean(woFgId && itemFgId && woFgId === itemFgId);
};

/**
 * Recompute plannedQuantity on every SO line and productionStatus on the SO header
 * from all non-cancelled linked Work Orders.
 */
const recomputeSalesOrderProductionStatus = async (salesOrderId, tenantId, sessionOption = {}) => {
    if (!salesOrderId || !tenantId) return null;

    const query = SalesOrder.findOne({ _id: salesOrderId, tenant: tenantId }).populate(
        'items.finishedGood',
        'bagWeightGms weightPerBagGrams fabricGSM gsm dimensions'
    );
    if (sessionOption?.session) query.session(sessionOption.session);
    const salesOrder = await query;
    if (!salesOrder) return null;

    const woQuery = WorkOrder.find({
        tenant: tenantId,
        salesOrder: salesOrder._id,
        status: { $ne: 'CANCELLED' },
        approvalStatus: { $ne: 'REJECTED' },
        isActive: true
    }).select('salesOrderLineId finishedGood targetQuantity targetPcs targetKg completedQuantity status approvalStatus');
    if (sessionOption?.session) woQuery.session(sessionOption.session);
    const linkedWOs = await woQuery.lean();

    let allLinesFullyPlanned = true;
    let anyLinePlanned = false;

    (salesOrder.items || []).forEach((item, idx) => {
        const lineWOs = linkedWOs.filter((wo) => doesWoMatchSoLine(wo, item, idx));
        const plannedBags = lineWOs.reduce((sum, wo) => sum + Number(wo.targetPcs ?? wo.targetQuantity ?? 0), 0);
        const plannedSoConv = convertBagsToSoUnit(plannedBags, item.unit, item.finishedGood);
        const plannedInSoUnit = plannedSoConv.hasConversion && plannedSoConv.convertedQty !== null
            ? plannedSoConv.convertedQty
            : plannedBags;
        item.plannedQuantity = Math.max(0, Number(plannedInSoUnit.toFixed(3)));

        if (plannedBags > 0) anyLinePlanned = true;

        const conv = convertSoQtyToBags(item.quantity, item.unit, item.finishedGood);
        const requiredBags = conv.hasConversion && conv.convertedBags !== null
            ? conv.convertedBags
            : Number(item.quantity || 0);

        if (plannedBags < requiredBags) {
            allLinesFullyPlanned = false;
        }
    });

    let nextStatus = 'Not Planned';
    if (linkedWOs.length === 0 || !anyLinePlanned) {
        nextStatus = 'Not Planned';
    } else if (linkedWOs.some((wo) => wo.status === 'IN_PROGRESS')) {
        nextStatus = 'In Production';
    } else if (linkedWOs.every((wo) => wo.status === 'COMPLETED') && allLinesFullyPlanned) {
        nextStatus = 'Production Completed';
    } else if (allLinesFullyPlanned) {
        nextStatus = 'Fully Planned';
    } else {
        nextStatus = 'Partially Planned';
    }

    salesOrder.productionStatus = nextStatus;
    if (sessionOption?.session) {
        await salesOrder.save({ session: sessionOption.session });
    } else {
        await salesOrder.save();
    }

    return {
        salesOrder,
        productionStatus: nextStatus
    };
};

/**
 * Fetch confirmed Sales Order lines with remaining-to-plan > 0 for Production Queue & WO dropdown.
 */
const getPendingProductionLinesCore = async (tenantId, queryParams = {}) => {
    const {
        customer,
        finishedGood,
        dueFrom,
        dueTo,
        search,
        productionStatus,
        sortBy = 'deliveryDue',
        sortOrder = 'asc',
        page = 1,
        limit = 50
    } = queryParams;

    const soFilter = {
        tenant: tenantId,
        isActive: true,
        status: { $in: ['CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED'] },
        soApprovalStatus: { $nin: ['Pending Approval', 'Rejected'] }
    };

    if (customer) soFilter.customer = customer;
    if (dueFrom || dueTo) {
        soFilter.deliveryDue = {};
        if (dueFrom) soFilter.deliveryDue.$gte = new Date(dueFrom);
        if (dueTo) {
            const end = new Date(dueTo);
            end.setHours(23, 59, 59, 999);
            soFilter.deliveryDue.$lte = end;
        }
    }

    const salesOrders = await SalesOrder.find(soFilter)
        .populate('customer', 'companyName name code contactPerson phone email gstin')
        .populate({
            path: 'items.finishedGood',
            select: 'code name description dimensions dimensionUnit fabricGSM gsm bagWeightGms weightPerBagGrams uom currentStock materialQualityFabric fabricLaminationType materialColour printSides frontColours backColours inks',
            populate: { path: 'uom', select: 'name symbol abbreviation' }
        })
        .populate('sourceEnquiry', 'nslNumber poAttachments contactPerson contactNumber contactDesignation productCategory printSpec printSides frontColours backColours materialQualityFabric fabricLaminationType materialColour fabricGrammage bagWeightGms fabricAverage fabricWidthInch fabricLengthInch')
        .sort({ deliveryDue: 1, orderDate: 1 })
        .lean();

    const soIds = salesOrders.map((s) => s._id);
    const linkedWOs = soIds.length > 0
        ? await WorkOrder.find({
            tenant: tenantId,
            salesOrder: { $in: soIds },
            status: { $ne: 'CANCELLED' },
            approvalStatus: { $ne: 'REJECTED' },
            isActive: true
        })
            .select('workOrderNumber salesOrder salesOrderLineId finishedGood targetQuantity targetPcs completedQuantity status approvalStatus')
            .sort({ createdAt: -1 })
            .lean()
        : [];

    const BOM = require('../models/bom.model');
    const soFgIds = Array.from(new Set(
        salesOrders.flatMap((so) => (so.items || []).map((it) => String(it.finishedGood?._id || it.finishedGood || '')).filter(Boolean))
    ));
    const activeBoms = soFgIds.length > 0
        ? await BOM.find({ tenant: tenantId, finishedGood: { $in: soFgIds }, isActive: true })
            .populate({ path: 'items.rawMaterial', select: 'name code uom', populate: { path: 'uom', select: 'name symbol abbreviation' } })
            .lean()
        : [];
    const bomByFgId = new Map();
    activeBoms.forEach((b) => {
        const k = String(b.finishedGood);
        if (!bomByFgId.has(k) || b.isDefault) bomByFgId.set(k, b);
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const threeDaysAhead = new Date(todayStart);
    threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
    threeDaysAhead.setHours(23, 59, 59, 999);

    let lines = [];
    const overdueSoIds = new Set();
    const noWoSoIds = new Set();

    for (const so of salesOrders) {
        // Lazily assign & persist stable _id for legacy SO line items that lack _id
        if (Array.isArray(so.items) && so.items.some((it) => !it._id)) {
            let needsSave = false;
            so.items.forEach((it) => {
                if (!it._id) {
                    it._id = new mongoose.Types.ObjectId();
                    needsSave = true;
                }
            });
            if (needsSave) {
                await SalesOrder.updateOne(
                    { _id: so._id, tenant: tenantId },
                    { $set: { items: so.items.map((it) => ({ ...it, finishedGood: it.finishedGood?._id || it.finishedGood })) } }
                ).catch(() => {});
            }
        }

        const soWOs = linkedWOs.filter((wo) => String(wo.salesOrder) === String(so._id));
        const totalLines = (so.items || []).length;

        (so.items || []).forEach((item, idx) => {
            const fg = item.finishedGood && typeof item.finishedGood === 'object' ? item.finishedGood : null;
            if (!fg) return;
            if (finishedGood && String(fg._id) !== String(finishedGood)) return;

            const lineId = getSoLineId(item, idx);
            const lineWOs = soWOs.filter((wo) => doesWoMatchSoLine(wo, item, idx));
            const plannedBags = lineWOs.reduce((sum, wo) => sum + Number(wo.targetPcs ?? wo.targetQuantity ?? 0), 0);

            const orderedQty = Number(item.quantity || 0);
            const unit = item.unit || fg.uom?.symbol || fg.uom?.name || 'Pcs';
            const fgBom = bomByFgId.get(String(fg._id)) || null;
            const bagSpec = resolveBagWeightSpec(fg, fgBom);
            const conv = convertSoQtyToBags(orderedQty, unit, fg, fgBom);
            const orderedBags = conv.hasConversion && conv.convertedBags !== null ? conv.convertedBags : orderedQty;
            const remainingQty = Math.max(0, Number((orderedBags - plannedBags).toFixed(3)));
            const plannedInSoConv = convertBagsToSoUnit(plannedBags, unit, fg, fgBom);
            const plannedInSoUnit = plannedInSoConv.hasConversion && plannedInSoConv.convertedQty !== null ? plannedInSoConv.convertedQty : plannedBags;
            const remainingInSoUnit = ['kg', 'kgs', 'kilogram', 'kilograms'].includes(String(unit || '').toLowerCase())
                ? Math.max(0, Number((orderedQty - plannedInSoUnit).toFixed(2)))
                : remainingQty;
            const plannedKg = bagSpec?.weightKg ? Number((plannedBags * bagSpec.weightKg).toFixed(2)) : 0;
            const remainingKg = bagSpec?.weightKg ? Number((remainingQty * bagSpec.weightKg).toFixed(2)) : 0;

            if (remainingQty <= 0) return;

            const soProdStatus = so.productionStatus || 'Not Planned';
            if (productionStatus && productionStatus !== 'All' && productionStatus !== 'All Statuses' && soProdStatus !== productionStatus) {
                return;
            }

            const dueDate = so.deliveryDue ? new Date(so.deliveryDue) : null;
            const isOverdue = Boolean(dueDate && dueDate < todayStart);
            const isDueSoon = Boolean(dueDate && !isOverdue && dueDate <= threeDaysAhead);
            if (isOverdue) overdueSoIds.add(String(so._id));
            if (soWOs.length === 0) noWoSoIds.add(String(so._id));

            const fgStock = Number(fg.currentStock || 0);
            const shortfall = Math.max(0, remainingQty - fgStock);

            const gsmVal = fg.fabricGSM ?? fg.gsm ?? null;
            const sizeStr = fg.dimensions?.width && fg.dimensions?.length
                ? `${fg.dimensions.width}x${fg.dimensions.length}${fg.dimensions.unit || 'cm'}`
                : '';

            lines.push({
                _id: `${so._id}_${lineId}`,
                salesOrderId: so._id,
                soNumber: so.soNumber,
                soStatus: so.status,
                productionStatus: soProdStatus,
                orderDate: so.orderDate,
                deliveryDue: so.deliveryDue,
                isOverdue,
                isDueSoon,
                customer: so.customer,
                lineId,
                lineIndex: idx + 1,
                totalLines,
                finishedGood: {
                    _id: fg._id,
                    code: fg.code,
                    name: fg.name,
                    gsm: gsmVal,
                    size: sizeStr,
                    currentStock: fgStock,
                    uom: fg.uom?.symbol || fg.uom?.name || 'Bags',
                    inks: fg.inks || [],
                    materialQualityFabric: fg.materialQualityFabric || '',
                    fabricLaminationType: fg.fabricLaminationType || '',
                    materialColour: fg.materialColour || '',
                    printSides: fg.printSides || 'NONE',
                    frontColours: fg.frontColours || 0,
                    backColours: fg.backColours || 0
                },
                orderedQuantity: orderedQty,
                orderedUnit: unit,
                convertedOrderedBags: orderedBags,
                hasUnitConversion: conv.hasConversion,
                conversionNote: conv.conversionNote,
                plannedQuantity: plannedBags,
                plannedBags,
                plannedInSoUnit,
                plannedKg,
                remainingQuantity: remainingQty,
                remainingBags: remainingQty,
                remainingInSoUnit,
                remainingKg,
                avgBagWeightGrams: bagSpec?.weightGrams || null,
                avgBagWeightKg: bagSpec?.weightKg || null,
                weightSource: bagSpec?.source || null,
                fgCurrentStock: fgStock,
                shortfall,
                linkedWorkOrders: lineWOs.map((w) => ({
                    _id: w._id,
                    workOrderNumber: w.workOrderNumber,
                    targetQuantity: w.targetQuantity,
                    completedQuantity: w.completedQuantity || 0,
                    status: w.status
                })),
                poAttachments: so.sourceEnquiry?.poAttachments || [],
                sourceEnquiry: so.sourceEnquiry || null
            });
        });
    }

    if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        lines = lines.filter((l) => {
            const hay = [
                l.soNumber,
                l.customer?.companyName,
                l.customer?.name,
                l.customer?.code,
                l.finishedGood?.code,
                l.finishedGood?.name,
                l.productionStatus
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }

    const dir = sortOrder === 'desc' ? -1 : 1;
    lines.sort((a, b) => {
        if (sortBy === 'remainingQuantity') return (a.remainingQuantity - b.remainingQuantity) * dir;
        if (sortBy === 'soNumber') return String(a.soNumber).localeCompare(String(b.soNumber)) * dir;
        const da = a.deliveryDue ? new Date(a.deliveryDue).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.deliveryDue ? new Date(b.deliveryDue).getTime() : Number.MAX_SAFE_INTEGER;
        return (da - db) * dir;
    });

    const summary = {
        linesPending: lines.length,
        totalQuantityPending: lines.reduce((sum, l) => sum + Number(l.remainingQuantity || 0), 0),
        overdueOrders: overdueSoIds.size,
        ordersWithoutWo: noWoSoIds.size
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const total = lines.length;
    const paged = lines.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
        data: paged,
        summary,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1
        }
    };
};

/**
 * Notify production team & Tenant Admin when a Sales Order is CONFIRMED.
 */
const notifyProductionOnSoConfirm = async (salesOrderDoc, tenantId) => {
    try {
        if (!salesOrderDoc || !tenantId) return;
        const existing = await Notification.findOne({
            tenant: tenantId,
            module: 'PRODUCTION',
            'data.salesOrderId': salesOrderDoc._id,
            isRead: false
        }).lean();
        if (existing) return;

        await Notification.create({
            tenant: tenantId,
            type: 'SYSTEM',
            module: 'PRODUCTION',
            title: `Production Planning Needed: ${salesOrderDoc.soNumber}`,
            message: `New order ${salesOrderDoc.soNumber} has been confirmed and needs production planning.`,
            priority: 'HIGH',
            link: '/production?tab=pending-production',
            data: {
                salesOrderId: salesOrderDoc._id,
                soNumber: salesOrderDoc.soNumber
            },
            isRead: false
        });
    } catch (err) {
        console.error('[SO Production Notification] Non-fatal error:', err.message);
    }
};

module.exports = {
    getSoLineId,
    convertSoQtyToBags,
    doesWoMatchSoLine,
    recomputeSalesOrderProductionStatus,
    getPendingProductionLinesCore,
    notifyProductionOnSoConfirm
};
