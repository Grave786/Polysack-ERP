const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model');
const GRN = require('../models/grn.model');
const RawMaterial = require('../models/rawMaterial.model');
const FinishedGood = require('../models/finishedGood.model');

/**
 * Helper to format year & month numbers into YYYY-MM string
 */
const formatYearMonth = (year, month) => {
    return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * @desc    Get Financial P&L Summary Report (Report #1)
 * @route   GET /api/reports/pl-summary
 * @access  Private (ANALYTICS:READ / SALES:READ permission)
 */
const getPLSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { startDate, endDate, location } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate query parameters are required (format: YYYY-MM-DD).'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid startDate or endDate format. Please provide valid ISO date strings (e.g. 2026-01-01).'
            });
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be after endDate.'
            });
        }

        end.setHours(23, 59, 59, 999);
        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

        const invoiceMatch = {
            tenant: tenantObjectId,
            isActive: true,
            invoiceDate: { $gte: start, $lte: end }
        };

        const grnMatch = {
            tenant: tenantObjectId,
            receivedDate: { $gte: start, $lte: end }
        };

        if (location && mongoose.Types.ObjectId.isValid(location)) {
            grnMatch.receivingLocation = new mongoose.Types.ObjectId(location);
        }

        const revenuePipeline = [
            { $match: invoiceMatch },
            {
                $group: {
                    _id: {
                        year: { $year: "$invoiceDate" },
                        month: { $month: "$invoiceDate" }
                    },
                    taxableRevenue: {
                        $sum: {
                            $subtract: ["$grandTotal", { $ifNull: ["$gstAmount", 0] }]
                        }
                    },
                    grossRevenue: { $sum: "$grandTotal" },
                    gstCollected: { $sum: { $ifNull: ["$gstAmount", 0] } },
                    invoiceCount: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ];

        const costPipeline = [
            { $match: grnMatch },
            {
                $lookup: {
                    from: 'purchaseorders',
                    localField: 'purchaseOrder',
                    foreignField: '_id',
                    as: 'po'
                }
            },
            { $unwind: '$po' },
            { $unwind: '$items' },
            {
                $project: {
                    receivedDate: 1,
                    receivedQuantity: '$items.receivedQuantity',
                    rawMaterial: '$items.rawMaterial',
                    poItems: '$po.items'
                }
            },
            {
                $project: {
                    receivedDate: 1,
                    receivedQuantity: 1,
                    matchingPoItem: {
                        $filter: {
                            input: '$poItems',
                            as: 'poItem',
                            cond: { $eq: ['$$poItem.rawMaterial', '$rawMaterial'] }
                        }
                    }
                }
            },
            {
                $project: {
                    receivedDate: 1,
                    receivedQuantity: 1,
                    ratePerUnit: { $arrayElemAt: ['$matchingPoItem.ratePerUnit', 0] }
                }
            },
            {
                $project: {
                    receivedDate: 1,
                    itemCost: { $multiply: ['$receivedQuantity', { $ifNull: ['$ratePerUnit', 0] }] }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$receivedDate' },
                        month: { $month: '$receivedDate' }
                    },
                    materialCost: { $sum: '$itemCost' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        const [revenueResults, costResults] = await Promise.all([
            Invoice.aggregate(revenuePipeline),
            GRN.aggregate(costPipeline)
        ]);

        const monthlyMap = new Map();

        for (const rev of revenueResults) {
            const key = formatYearMonth(rev._id.year, rev._id.month);
            monthlyMap.set(key, {
                year: rev._id.year,
                month: rev._id.month,
                period: key,
                revenue: Number(rev.taxableRevenue.toFixed(2)),
                grossRevenue: Number(rev.grossRevenue.toFixed(2)),
                gstCollected: Number(rev.gstCollected.toFixed(2)),
                invoiceCount: rev.invoiceCount,
                costOfGoods: 0,
                grossProfit: 0
            });
        }

        for (const cost of costResults) {
            const key = formatYearMonth(cost._id.year, cost._id.month);
            const existing = monthlyMap.get(key) || {
                year: cost._id.year,
                month: cost._id.month,
                period: key,
                revenue: 0,
                grossRevenue: 0,
                gstCollected: 0,
                invoiceCount: 0,
                costOfGoods: 0,
                grossProfit: 0
            };

            existing.costOfGoods = Number(cost.materialCost.toFixed(2));
            monthlyMap.set(key, existing);
        }

        const monthlyBuckets = Array.from(monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period));

        let totalRevenue = 0;
        let totalGrossRevenue = 0;
        let totalGstCollected = 0;
        let totalCostOfGoods = 0;
        let totalInvoices = 0;

        for (const bucket of monthlyBuckets) {
            bucket.grossProfit = Number((bucket.revenue - bucket.costOfGoods).toFixed(2));
            totalRevenue += bucket.revenue;
            totalGrossRevenue += bucket.grossRevenue;
            totalGstCollected += bucket.gstCollected;
            totalCostOfGoods += bucket.costOfGoods;
            totalInvoices += bucket.invoiceCount;
        }

        const totalGrossProfit = Number((totalRevenue - totalCostOfGoods).toFixed(2));

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    startDate,
                    endDate,
                    totalRevenue: Number(totalRevenue.toFixed(2)),
                    totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
                    totalGstCollected: Number(totalGstCollected.toFixed(2)),
                    totalCostOfGoods: Number(totalCostOfGoods.toFixed(2)),
                    totalGrossProfit,
                    totalInvoices,
                    grossProfitMarginPercent: totalRevenue > 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(2)) : 0
                },
                monthlyTrend: monthlyBuckets
            }
        });
    } catch (error) {
        console.error('Error in getPLSummary:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Financial P&L Summary report.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Production Yield & Scrap Report (Report #2 - Fixed to COMPLETED status only)
 * @route   GET /api/reports/production-yield
 * @access  Private (ANALYTICS:READ / SALES:READ permission)
 */
const getProductionYieldReport = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { startDate, endDate, machine, finishedGood } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate query parameters are required (format: YYYY-MM-DD).'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid startDate or endDate format. Please provide valid ISO date strings (e.g. 2026-01-01).'
            });
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be after endDate.'
            });
        }

        end.setHours(23, 59, 59, 999);
        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

        // FIX 1: Filter WorkOrders to status 'COMPLETED' ONLY for accurate yield math
        const woCompletedMatch = {
            tenant: tenantObjectId,
            isActive: true,
            status: 'COMPLETED',
            createdAt: { $gte: start, $lte: end }
        };

        const woAllStatusMatch = {
            tenant: tenantObjectId,
            isActive: true,
            createdAt: { $gte: start, $lte: end }
        };

        if (machine && mongoose.Types.ObjectId.isValid(machine)) {
            const mId = new mongoose.Types.ObjectId(machine);
            woCompletedMatch.assignedMachine = mId;
            woAllStatusMatch.assignedMachine = mId;
        }

        if (finishedGood && mongoose.Types.ObjectId.isValid(finishedGood)) {
            const fgId = new mongoose.Types.ObjectId(finishedGood);
            woCompletedMatch.finishedGood = fgId;
            woAllStatusMatch.finishedGood = fgId;
        }

        // Build StockTransaction QC_REJECTED Match filter
        const txnMatch = {
            tenant: tenantObjectId,
            transactionType: 'QC_REJECTED',
            createdAt: { $gte: start, $lte: end }
        };

        if (finishedGood && mongoose.Types.ObjectId.isValid(finishedGood)) {
            txnMatch.item = new mongoose.Types.ObjectId(finishedGood);
        }

        const WorkOrder = require('../models/workOrder.model');
        const StockTransaction = require('../models/stockTransaction.model');

        // Pipeline 1: WorkOrder Status Counts (ALL statuses in date range)
        const woStatusCountsPipeline = [
            { $match: woAllStatusMatch },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ];

        // Pipeline 2: COMPLETED WorkOrders Summary (Yield Math)
        const woSummaryPipeline = [
            { $match: woCompletedMatch },
            {
                $group: {
                    _id: null,
                    totalPlanned: { $sum: "$targetQuantity" },
                    totalActual: { $sum: "$completedQuantity" }
                }
            }
        ];

        // Pipeline 3: Monthly COMPLETED WorkOrders Trend
        const woMonthlyPipeline = [
            { $match: woCompletedMatch },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    plannedQuantity: { $sum: "$targetQuantity" },
                    actualQuantity: { $sum: "$completedQuantity" },
                    workOrderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ];

        // Pipeline 4: By Machine Breakdown (COMPLETED WOs)
        const woMachinePipeline = [
            { $match: woCompletedMatch },
            {
                $group: {
                    _id: "$assignedMachine",
                    totalPlanned: { $sum: "$targetQuantity" },
                    totalActual: { $sum: "$completedQuantity" },
                    completedCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'machines',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'machineInfo'
                }
            },
            {
                $project: {
                    machineId: "$_id",
                    totalPlanned: 1,
                    totalActual: 1,
                    completedCount: 1,
                    machine: { $arrayElemAt: ["$machineInfo", 0] }
                }
            }
        ];

        // Pipeline 5 & 6: Rejections Summary & Monthly from StockTransaction (QC_REJECTED)
        const txnSummaryPipeline = [
            { $match: txnMatch },
            {
                $group: {
                    _id: null,
                    totalRejected: { $sum: "$quantity" }
                }
            }
        ];

        const txnMonthlyPipeline = [
            { $match: txnMatch },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    rejectedQuantity: { $sum: "$quantity" }
                }
            }
        ];

        const [
            woStatusResults,
            woSummaryResults,
            woMonthlyResults,
            woMachineResults,
            txnSummaryResults,
            txnMonthlyResults
        ] = await Promise.all([
            WorkOrder.aggregate(woStatusCountsPipeline),
            WorkOrder.aggregate(woSummaryPipeline),
            WorkOrder.aggregate(woMonthlyPipeline),
            WorkOrder.aggregate(woMachinePipeline),
            StockTransaction.aggregate(txnSummaryPipeline),
            StockTransaction.aggregate(txnMonthlyPipeline)
        ]);

        // Extract Status Counts
        let completedWorkOrderCount = 0;
        let inProgressWorkOrderCount = 0;
        let cancelledWorkOrderCount = 0;

        for (const st of woStatusResults) {
            if (st._id === 'COMPLETED') completedWorkOrderCount = st.count;
            else if (st._id === 'IN_PROGRESS') inProgressWorkOrderCount = st.count;
            else if (st._id === 'CANCELLED') cancelledWorkOrderCount = st.count;
        }

        const totalPlanned = woSummaryResults[0]?.totalPlanned || 0;
        const totalActual = woSummaryResults[0]?.totalActual || 0;
        const totalRejected = txnSummaryResults[0]?.totalRejected || 0;

        const overallYieldPercent = totalPlanned > 0 ? Number(((totalActual / totalPlanned) * 100).toFixed(2)) : 0;

        /**
         * CONFIRMED REJECTION RATE FORMULA:
         * rejectionRatePercent = totalProduced > 0 ? (totalRejected / (totalActual + totalRejected)) * 100 : 0
         * Where:
         * - totalActual = Good output quantity from COMPLETED WorkOrders
         * - totalRejected = QC_REJECTED StockTransaction quantity in date range
         * - totalProduced = totalActual + totalRejected (total physical units produced)
         * Formula represents: rejected units ÷ (good units + rejected units).
         */
        const totalProduced = totalActual + totalRejected;
        const rejectionRatePercent = totalProduced > 0 ? Number(((totalRejected / totalProduced) * 100).toFixed(2)) : 0;

        // Map Monthly Trend
        const monthlyMap = new Map();

        for (const m of woMonthlyResults) {
            const key = formatYearMonth(m._id.year, m._id.month);
            monthlyMap.set(key, {
                year: m._id.year,
                month: m._id.month,
                period: key,
                plannedQuantity: m.plannedQuantity,
                actualQuantity: m.actualQuantity,
                rejectedQuantity: 0,
                completedWorkOrderCount: m.workOrderCount,
                yieldPercent: m.plannedQuantity > 0 ? Number(((m.actualQuantity / m.plannedQuantity) * 100).toFixed(2)) : 0,
                rejectionRatePercent: 0
            });
        }

        for (const rej of txnMonthlyResults) {
            const key = formatYearMonth(rej._id.year, rej._id.month);
            const existing = monthlyMap.get(key) || {
                year: rej._id.year,
                month: rej._id.month,
                period: key,
                plannedQuantity: 0,
                actualQuantity: 0,
                rejectedQuantity: 0,
                completedWorkOrderCount: 0,
                yieldPercent: 0,
                rejectionRatePercent: 0
            };

            existing.rejectedQuantity = Number(rej.rejectedQuantity.toFixed(2));
            const periodTotalProduced = existing.actualQuantity + existing.rejectedQuantity;
            existing.rejectionRatePercent = periodTotalProduced > 0 ? Number(((existing.rejectedQuantity / periodTotalProduced) * 100).toFixed(2)) : 0;
            monthlyMap.set(key, existing);
        }

        const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period));

        // Format By Machine Breakdown
        const byMachine = woMachineResults.map(mac => {
            const planned = mac.totalPlanned || 0;
            const actual = mac.totalActual || 0;
            const yieldPct = planned > 0 ? Number(((actual / planned) * 100).toFixed(2)) : 0;

            return {
                machineId: mac.machineId,
                machineName: mac.machine ? mac.machine.name : 'Unassigned Machine',
                machineCode: mac.machine ? mac.machine.code : 'N/A',
                section: mac.machine ? mac.machine.section : 'UNASSIGNED',
                totalPlanned: planned,
                totalActual: actual,
                yieldPercent: yieldPct,
                completedWorkOrderCount: mac.completedCount
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    startDate,
                    endDate,
                    totalPlanned,
                    totalActual,
                    overallYieldPercent,
                    totalRejected,
                    rejectionRatePercent,
                    completedWorkOrderCount,
                    inProgressWorkOrderCount,
                    cancelledWorkOrderCount
                },
                monthlyTrend,
                byMachine
            }
        });
    } catch (error) {
        console.error('Error in getProductionYieldReport:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Production Yield & Scrap report.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Inventory Valuation Report (Report #3)
 * @route   GET /api/reports/inventory-valuation
 * @access  Private (ANALYTICS:READ / SALES:READ permission)
 */
const getInventoryValuationReport = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

        // Fetch Raw Materials for tenant
        const rawMaterialsDocs = await RawMaterial.find({ tenant: tenantObjectId, isActive: true })
            .populate('category', 'name')
            .populate('uom', 'symbol name')
            .sort({ name: 1 });

        // Fetch Finished Goods for tenant
        const finishedGoodsDocs = await FinishedGood.find({ tenant: tenantObjectId, isActive: true })
            .populate('category', 'name')
            .populate('uom', 'symbol name')
            .sort({ name: 1 });

        let totalRawMaterialValue = 0;
        let totalFinishedGoodValue = 0;
        let totalPendingQCStockValue = 0;

        const rawMaterials = rawMaterialsDocs.map(rm => {
            const currentStock = rm.currentStock || 0;
            const unitCost = rm.pricePerUnit || 0;
            const totalValue = Number((currentStock * unitCost).toFixed(2));
            totalRawMaterialValue += totalValue;

            return {
                id: rm._id,
                code: rm.code,
                name: rm.name,
                category: rm.category ? rm.category.name : 'Uncategorized',
                uom: rm.uom ? rm.uom.symbol : '',
                currentStock,
                unitCost,
                totalValue
            };
        });

        const finishedGoods = finishedGoodsDocs.map(fg => {
            const currentStock = fg.currentStock || 0;
            const pendingQCStock = fg.pendingQCStock || 0;
            const unitPrice = fg.pricePerBag || 0;

            const sellableStockValue = Number((currentStock * unitPrice).toFixed(2));
            const pendingQCValue = Number((pendingQCStock * unitPrice).toFixed(2));

            totalFinishedGoodValue += sellableStockValue;
            totalPendingQCStockValue += pendingQCValue;

            return {
                id: fg._id,
                code: fg.code,
                name: fg.name,
                category: fg.category ? fg.category.name : 'Uncategorized',
                uom: fg.uom ? fg.uom.symbol : '',
                currentStock,
                pendingQCStock,
                unitPrice,
                sellableStockValue,
                pendingQCStockValue: pendingQCValue
            };
        });

        totalRawMaterialValue = Number(totalRawMaterialValue.toFixed(2));
        totalFinishedGoodValue = Number(totalFinishedGoodValue.toFixed(2));
        totalPendingQCStockValue = Number(totalPendingQCStockValue.toFixed(2));
        const totalInventoryValue = Number((totalRawMaterialValue + totalFinishedGoodValue).toFixed(2));

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalRawMaterialValue,
                    totalFinishedGoodValue,
                    totalInventoryValue,
                    totalPendingQCStockValue,
                    valuationBasis: {
                        rawMaterial: "PURCHASE_COST (pricePerUnit)",
                        finishedGood: "SELLING_PRICE (pricePerBag - no manufacturing cost field available on FinishedGood model)"
                    }
                },
                rawMaterials,
                finishedGoods
            }
        });
    } catch (error) {
        console.error('Error in getInventoryValuationReport:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Inventory Valuation report.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Sales & GST Tax Register Report (Report #4)
 * @route   GET /api/reports/gst-register
 * @access  Private (ANALYTICS:READ / SALES:READ permission)
 */
const getGstRegisterReport = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { startDate, endDate, customerType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Both startDate and endDate query parameters are required (format: YYYY-MM-DD).'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid startDate or endDate format. Please provide valid ISO date strings (e.g. 2026-01-01).'
            });
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be after endDate.'
            });
        }

        if (customerType && customerType !== 'WALK_IN' && customerType !== 'REGISTERED') {
            return res.status(400).json({
                success: false,
                message: "Invalid customerType filter. Must be 'WALK_IN' or 'REGISTERED'."
            });
        }

        end.setHours(23, 59, 59, 999);
        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

        const filter = {
            tenant: tenantObjectId,
            isActive: true,
            invoiceDate: { $gte: start, $lte: end }
        };

        if (customerType) {
            filter.customerType = customerType;
        }

        const invoices = await Invoice.find(filter)
            .populate('customer', 'companyName code contactPerson phone gstin address city state')
            .sort({ invoiceDate: 1 });

        let totalTaxableValue = 0;
        let totalCgstAmount = 0;
        let totalSgstAmount = 0;
        let totalIgstAmount = 0;
        let totalGstAmount = 0;
        let totalGrandTotal = 0;

        const registerItems = invoices.map(inv => {
            const isWalkIn = inv.customerType === 'WALK_IN';
            const customerName = isWalkIn
                ? (inv.walkInCustomer?.name || 'Counter Retail Customer')
                : (inv.customer?.companyName || 'Registered Customer');
            const customerGstin = isWalkIn
                ? (inv.walkInCustomer?.gstin || 'UNREGISTERED')
                : (inv.customer?.gstin || 'UNREGISTERED');

            const gstAmount = Number((inv.gstAmount || 0).toFixed(2));
            const grandTotal = Number(inv.grandTotal.toFixed(2));
            const taxableValue = Number((grandTotal - gstAmount).toFixed(2));

            const cgstAmount = Number((inv.cgstAmount || 0).toFixed(2));
            const sgstAmount = Number((inv.sgstAmount || 0).toFixed(2));
            const igstAmount = Number((inv.igstAmount || 0).toFixed(2));

            totalTaxableValue += taxableValue;
            totalCgstAmount += cgstAmount;
            totalSgstAmount += sgstAmount;
            totalIgstAmount += igstAmount;
            totalGstAmount += gstAmount;
            totalGrandTotal += grandTotal;

            return {
                id: inv._id,
                invoiceNumber: inv.invoiceNumber,
                invoiceDate: inv.invoiceDate,
                customerType: inv.customerType || (isWalkIn ? 'WALK_IN' : 'REGISTERED'),
                customerName,
                customerGstin,
                taxableValue,
                gstRate: inv.gstRate || 18,
                cgstAmount,
                sgstAmount,
                igstAmount,
                gstAmount,
                grandTotal,
                paymentStatus: inv.paymentStatus,
                paymentMode: inv.paymentMode || null
            };
        });

        totalTaxableValue = Number(totalTaxableValue.toFixed(2));
        totalCgstAmount = Number(totalCgstAmount.toFixed(2));
        totalSgstAmount = Number(totalSgstAmount.toFixed(2));
        totalIgstAmount = Number(totalIgstAmount.toFixed(2));
        totalGstAmount = Number(totalGstAmount.toFixed(2));
        totalGrandTotal = Number(totalGrandTotal.toFixed(2));

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    startDate,
                    endDate,
                    customerTypeFilter: customerType || 'ALL',
                    totalInvoiceCount: registerItems.length,
                    totalTaxableValue,
                    totalCgstAmount,
                    totalSgstAmount,
                    totalIgstAmount,
                    totalGstAmount,
                    totalGrandTotal
                },
                invoices: registerItems
            }
        });
    } catch (error) {
        console.error('Error in getGstRegisterReport:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Sales & GST Tax Register report.',
            error: error.message
        });
    }
};

module.exports = {
    getPLSummary,
    getProductionYieldReport,
    getInventoryValuationReport,
    getGstRegisterReport
};
