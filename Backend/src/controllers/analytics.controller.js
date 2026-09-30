const mongoose = require('mongoose');
const Invoice = require('../models/invoice.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const ProductionLog = require('../models/productionLog.model');
const RawMaterial = require('../models/rawMaterial.model');
const Category = require('../models/category.model');
const WorkOrder = require('../models/workOrder.model');
const GRN = require('../models/grn.model');
const FinishedGood = require('../models/finishedGood.model');
const StockTransaction = require('../models/stockTransaction.model');
const Tenant = require('../models/tenant.model');
const MaterialReceipt = require('../models/materialReceipt.model');
const GstFiling = require('../models/gstFiling.model');
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
 * @desc    Get Financial P&L Analytics (Revenue, Cost, Profit aggregation per quarter/month)
 * @route   GET /api/analytics/financial-summary
 * @access  Private
 */
const getFinancialSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);

        // 1. Revenue Aggregation by Month from Invoices
        const invoiceAgg = await Invoice.aggregate([
            {
                $match: {
                    tenant: tenantObjId
                }
            },
            {
                $group: {
                    _id: { $month: '$invoiceDate' },
                    totalRevenue: { $sum: '$grandTotal' }
                }
            }
        ]);

        // 2. Cost Aggregation by Month from Purchase Orders
        const poAgg = await PurchaseOrder.aggregate([
            {
                $match: {
                    tenant: tenantObjId
                }
            },
            {
                $group: {
                    _id: { $month: '$poDate' },
                    totalCost: { $sum: '$totalValue' }
                }
            }
        ]);

        // Map monthly aggregations
        const revenueMap = {};
        invoiceAgg.forEach((item) => {
            revenueMap[item._id] = item.totalRevenue;
        });

        const costMap = {};
        poAgg.forEach((item) => {
            costMap[item._id] = item.totalCost;
        });

        // FY Quarters mapping (Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar)
        const q1Months = [4, 5, 6];
        const q2Months = [7, 8, 9];
        const q3Months = [10, 11, 12];
        const q4Months = [1, 2, 3];

        const calcQuarterTotals = (monthList) => {
            const rev = monthList.reduce((acc, m) => acc + (revenueMap[m] || 0), 0);
            const cost = monthList.reduce((acc, m) => acc + (costMap[m] || 0), 0);
            return { rev, cost };
        };

        const q1 = calcQuarterTotals(q1Months);
        const q2 = calcQuarterTotals(q2Months);
        const q3 = calcQuarterTotals(q3Months);
        const q4 = calcQuarterTotals(q4Months);

        const hasRealData = (q1.rev + q2.rev + q3.rev + q4.rev + q1.cost + q2.cost + q3.cost + q4.cost) > 0;

        // Baseline defaults if database has zero invoice/PO data yet for tenant
        const defaultChartData = [
            { period: 'Q1 (Apr-Jun)', revenue: 18000000, cost: 9000000, profit: 9000000 },
            { period: 'Q2 (Jul-Sep)', revenue: 27000000, cost: 12000000, profit: 15000000 },
            { period: 'Q3 (Oct-Dec)', revenue: 32000000, cost: 15000000, profit: 17000000 },
            { period: 'Q4 (Jan-Mar)', revenue: 41000000, cost: 19000000, profit: 22000000 }
        ];

        const chartData = hasRealData
            ? [
                  { period: 'Q1 (Apr-Jun)', revenue: q1.rev, cost: q1.cost, profit: q1.rev - q1.cost },
                  { period: 'Q2 (Jul-Sep)', revenue: q2.rev, cost: q2.cost, profit: q2.rev - q2.cost },
                  { period: 'Q3 (Oct-Dec)', revenue: q3.rev, cost: q3.cost, profit: q3.rev - q3.cost },
                  { period: 'Q4 (Jan-Mar)', revenue: q4.rev, cost: q4.cost, profit: q4.rev - q4.cost }
              ]
            : defaultChartData;

        const totalRevenue = chartData.reduce((acc, item) => acc + item.revenue, 0);
        const totalCost = chartData.reduce((acc, item) => acc + item.cost, 0);
        const netProfit = totalRevenue - totalCost;
        const netMarginPercent = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

        return res.status(200).json({
            success: true,
            hasRealData,
            data: chartData,
            summary: {
                totalRevenue,
                totalCost,
                netProfit,
                netMarginPercent
            }
        });
    } catch (error) {
        console.error('Error in getFinancialSummary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve financial summary analytics.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Production Yield & KPI Metrics
 * @route   GET /api/analytics/production-yield-metrics
 * @access  Private (ANALYTICS:READ / PRODUCTION:READ)
 */
const getProductionYieldMetrics = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { startDate, endDate } = req.query;

        // 1. Calculate IST boundaries for requested date range (or default to today in IST)
        const now = new Date();
        const istFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const istTodayString = istFormatter.format(now); // e.g. "2026-09-28"

        const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const istYesterdayString = istFormatter.format(yesterdayDate);

        const hasCustomStartDate = Boolean(startDate && typeof startDate === 'string' && startDate.trim() !== '' && startDate !== 'undefined');
        const hasCustomEndDate = Boolean(endDate && typeof endDate === 'string' && endDate.trim() !== '' && endDate !== 'undefined');
        const hasDateRange = hasCustomStartDate || hasCustomEndDate;

        let rangeStart = null;
        let rangeEnd = null;

        if (hasDateRange) {
            if (hasCustomStartDate) {
                rangeStart = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
            }
            if (hasCustomEndDate) {
                rangeEnd = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
            }
        } else {
            // When no range is selected, default to today in IST
            rangeStart = new Date(`${istTodayString}T00:00:00.000+05:30`);
            rangeEnd = new Date(`${istTodayString}T23:59:59.999+05:30`);
        }

        // 2. Base WorkOrder match stage using WO's createdAt and excluding CANCELLED and PENDING
        const woMatch = {
            tenant: tenantObjId,
            status: { $nin: ['CANCELLED', 'PENDING'] }
        };

        if (rangeStart && rangeEnd) {
            woMatch.createdAt = { $gte: rangeStart, $lte: rangeEnd };
        } else if (rangeStart) {
            woMatch.createdAt = { $gte: rangeStart };
        } else if (rangeEnd) {
            woMatch.createdAt = { $lte: rangeEnd };
        }

        // 3. Calculate Available Raw Fabric (KG): Real-time stock ready for conversion
        // Check both item-level stock (RawMaterial.currentStock) and roll-level stock (GRN.rolls)
        let rawMaterialFabricKg = 0;
        let allRawMaterialKg = 0;

        const rawMaterials = await RawMaterial.find({
            tenant: { $in: [tenantObjId, tenantId] },
            isActive: { $ne: false },
            currentStock: { $gt: 0 }
        }).populate('category', 'name type').lean();

        for (const rm of rawMaterials) {
            const stock = Number(rm.currentStock || 0);
            if (stock <= 0) continue;
            allRawMaterialKg += stock;

            const catName = String(rm.category?.name || '').toLowerCase();
            const name = String(rm.name || '').toLowerCase();
            const code = String(rm.code || '').toLowerCase();
            const desc = String(rm.materialDescription || '').toLowerCase();
            const qualityFabric = String(rm.materialQualityFabric || '').trim();

            const isFabric = (
                catName.includes('fabric') ||
                catName.includes('roll') ||
                name.includes('fabric') ||
                name.includes('roll') ||
                code.includes('fab') ||
                code.includes('roll') ||
                desc.includes('fabric') ||
                desc.includes('roll') ||
                qualityFabric !== '' ||
                Boolean(rm.fabricGrammage) ||
                Boolean(rm.fabricSize) ||
                Boolean(rm.fabricAverage)
            );

            if (isFabric) {
                rawMaterialFabricKg += stock;
            }
        }

        // Check if rolls are stored in GRN with available remaining stock
        let rollsAvailableKg = 0;
        const grns = await GRN.find({
            tenant: { $in: [tenantObjId, tenantId] },
            'rolls.0': { $exists: true }
        }).select('rolls').lean();

        if (grns.length > 0) {
            const activeWorkOrdersWithRolls = await WorkOrder.find({
                tenant: { $in: [tenantObjId, tenantId] },
                status: { $ne: 'CANCELLED' },
                'jobOrderDetails.rolls.0': { $exists: true }
            }).select('jobOrderDetails.rolls').lean();

            const rollConsumptionMap = {};
            for (const wo of activeWorkOrdersWithRolls) {
                const woRolls = wo.jobOrderDetails?.rolls || [];
                for (const r of woRolls) {
                    const consumed = Number(r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : 0)) || 0;
                    if (r.rollId) {
                        const idKey = String(r.rollId);
                        rollConsumptionMap[idKey] = (rollConsumptionMap[idKey] || 0) + consumed;
                    }
                    if (r.rollNumber || r.rollNo) {
                        const numKey = String(r.rollNumber || r.rollNo).trim().toUpperCase();
                        rollConsumptionMap[numKey] = (rollConsumptionMap[numKey] || 0) + consumed;
                    }
                }
            }

            for (const grn of grns) {
                for (const r of (grn.rolls || [])) {
                    const rollIdStr = String(r._id);
                    const rollNumStr = String(r.rollNumber || '').trim().toUpperCase();
                    const totalMeters = Number(r.fabricLength || 0);

                    const usedMeters = rollConsumptionMap[rollIdStr] || rollConsumptionMap[rollNumStr] || 0;
                    const remainingMeters = totalMeters > 0 ? Math.max(0, totalMeters - usedMeters) : (usedMeters > 0 ? 0 : 1);

                    if (remainingMeters > 0) {
                        const rollWeight = Number(r.netWeight != null ? r.netWeight : (r.totalQuantityKg != null ? r.totalQuantityKg : (r.grossWeight != null ? r.grossWeight : 0))) || 0;
                        if (rollWeight > 0) {
                            if (totalMeters > 0 && usedMeters > 0) {
                                rollsAvailableKg += (rollWeight * remainingMeters) / totalMeters;
                            } else {
                                rollsAvailableKg += rollWeight;
                            }
                        }
                    }
                }
            }
        }

        // Available Raw Fabric (KG): prioritize fabric/roll stock, fallback to general active raw material stock
        let availableKgForBags = 0;
        if (rawMaterialFabricKg > 0 && rollsAvailableKg > 0) {
            availableKgForBags = Math.max(rawMaterialFabricKg, rollsAvailableKg);
        } else if (rawMaterialFabricKg > 0) {
            availableKgForBags = rawMaterialFabricKg;
        } else if (rollsAvailableKg > 0) {
            availableKgForBags = rollsAvailableKg;
        } else {
            availableKgForBags = allRawMaterialKg;
        }

        availableKgForBags = Math.round(availableKgForBags * 100) / 100;

        // 4. Fetch all matching WorkOrders within date range
        const workOrders = await WorkOrder.find(woMatch).sort({ createdAt: -1 }).lean();

        const tableData = workOrders.map((wo) => {
            // Actual material issued from job order rolls (or fallback to targetQuantity)
            let inputKg = 0;
            if (Array.isArray(wo.jobOrderDetails?.rolls) && wo.jobOrderDetails.rolls.length > 0) {
                inputKg = wo.jobOrderDetails.rolls.reduce(
                    (sum, r) => sum + Number(r.netWeight || r.grossWeight || r.totalQuantityKg || 0),
                    0
                );
            }
            if (inputKg === 0 && wo.targetQuantity) {
                inputKg = Number(wo.targetQuantity);
            }

            // Sum cumulative wastage, defect rejects, and returns across all stages
            let sumDefect = 0;
            let sumWastage = 0;
            let sumReturn = 0;
            let lastStageGood = 0;

            if (Array.isArray(wo.stages)) {
                wo.stages.forEach((st) => {
                    sumDefect += Number(st.rejectedQty || 0);
                    sumWastage += Number(st.wastageKg || 0);
                    sumReturn += Number(st.returnToStore || 0);
                });

                // Final stage output (sequence 8 or last completed stage in flow)
                const finalStage = wo.stages.find((s) => s.sequence === 8 || s.stageName === 'BALING_PACKING');
                if (finalStage && finalStage.goodOutputQty) {
                    lastStageGood = Number(finalStage.goodOutputQty);
                } else {
                    const completedStages = wo.stages.filter((s) => s.status === 'COMPLETED');
                    if (completedStages.length > 0) {
                        const lastCompleted = completedStages.reduce(
                            (prev, curr) => (curr.sequence > prev.sequence ? curr : prev),
                            completedStages[0]
                        );
                        lastStageGood = Number(lastCompleted.goodOutputQty || 0);
                    }
                }
            }

            // Bags produced = completedQuantity of the final stage only (no summing across stages)
            const completedBags = Number(wo.completedQuantity || lastStageGood || 0);
            const netKg = Math.max(0, inputKg - sumReturn);

            return {
                workOrderId: wo._id,
                workOrderNumber: wo.workOrderNumber,
                targetQuantity: wo.targetQuantity,
                totalInputKg: inputKg,
                returnToStore: sumReturn,
                netInput: netKg,
                netKgUsed: netKg,
                bagsProduced: completedBags,
                totalBagsProduced: completedBags,
                wastageKg: sumWastage,
                totalWastageKg: sumWastage,
                rejects: sumDefect,
                totalRejectedBags: sumDefect,
                date: wo.createdAt
            };
        });

        const groupedByWorkOrder = tableData;

        // Group by Date for alternate view
        const dateMap = {};
        tableData.forEach((row) => {
            const dStr = row.date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(row.date)) : 'Unknown';
            if (!dateMap[dStr]) {
                dateMap[dStr] = {
                    date: dStr,
                    totalInputKg: 0,
                    returnToStore: 0,
                    netInput: 0,
                    netKgUsed: 0,
                    bagsProduced: 0,
                    totalBagsProduced: 0,
                    wastageKg: 0,
                    totalWastageKg: 0,
                    rejects: 0,
                    totalRejectedBags: 0
                };
            }
            dateMap[dStr].totalInputKg += row.totalInputKg || 0;
            dateMap[dStr].returnToStore += row.returnToStore || 0;
            dateMap[dStr].netInput += row.netInput || 0;
            dateMap[dStr].netKgUsed += row.netKgUsed || 0;
            dateMap[dStr].bagsProduced += row.bagsProduced || 0;
            dateMap[dStr].totalBagsProduced += row.totalBagsProduced || 0;
            dateMap[dStr].wastageKg += row.wastageKg || 0;
            dateMap[dStr].totalWastageKg += row.totalWastageKg || 0;
            dateMap[dStr].rejects += row.rejects || 0;
            dateMap[dStr].totalRejectedBags += row.totalRejectedBags || 0;
        });

        const groupedByDate = Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));

        // Aggregate overall totals directly from the 13 work orders
        const totalInputKg = tableData.reduce((acc, curr) => acc + (curr.totalInputKg || 0), 0);
        const totalReturnToStore = tableData.reduce((acc, curr) => acc + (curr.returnToStore || 0), 0);
        const netKgUsed = tableData.reduce((acc, curr) => acc + (curr.netKgUsed || 0), 0);
        const totalBagsProduced = tableData.reduce((acc, curr) => acc + (curr.totalBagsProduced || curr.bagsProduced || 0), 0);
        const totalWastageKg = tableData.reduce((acc, curr) => acc + (curr.totalWastageKg || 0), 0);
        const totalRejectedBags = tableData.reduce((acc, curr) => acc + (curr.totalRejectedBags || 0), 0);

        const yieldRatioBagsPerKg = netKgUsed > 0 ? Number((totalBagsProduced / netKgUsed).toFixed(2)) : 0;
        const avgKgPerBag = totalBagsProduced > 0 ? Number((netKgUsed / totalBagsProduced).toFixed(3)) : 0;

        // Calculate yesterday bags using the exact same final stage completed bags definition
        const startOfYesterday = new Date(`${istYesterdayString}T00:00:00.000+05:30`);
        const endOfYesterday = new Date(`${istYesterdayString}T23:59:59.999+05:30`);

        const yesterdayWorkOrders = await WorkOrder.find({
            tenant: tenantObjId,
            status: { $nin: ['CANCELLED', 'PENDING'] },
            createdAt: { $gte: startOfYesterday, $lte: endOfYesterday }
        }).select('completedQuantity stages').lean();

        let yesterdayBags = yesterdayWorkOrders.reduce((sum, wo) => {
            let bags = Number(wo.completedQuantity || 0);
            if (bags === 0 && Array.isArray(wo.stages)) {
                const finalStage = wo.stages.find((s) => s.sequence === 8 || s.stageName === 'BALING_PACKING');
                if (finalStage && finalStage.goodOutputQty) {
                    bags = Number(finalStage.goodOutputQty);
                } else {
                    const completedStages = wo.stages.filter((s) => s.status === 'COMPLETED');
                    if (completedStages.length > 0) {
                        const lastCompleted = completedStages.reduce((prev, curr) => (curr.sequence > prev.sequence ? curr : prev), completedStages[0]);
                        bags = Number(lastCompleted.goodOutputQty || 0);
                    }
                }
            }
            return sum + bags;
        }, 0);

        const todayBags = totalBagsProduced;
        const bagChangeDiff = todayBags - yesterdayBags;
        const bagChangePercent = yesterdayBags > 0
            ? Number(((bagChangeDiff / yesterdayBags) * 100).toFixed(1))
            : (todayBags > 0 ? 100 : 0);

        return res.status(200).json({
            success: true,
            data: {
                todayVsYesterdayBags: {
                    todayBags,
                    yesterdayBags,
                    diff: bagChangeDiff,
                    changePercent: bagChangePercent
                },
                availableKgForBags,
                kgUsedVsBagsProduced: {
                    overall: {
                        totalInputKg,
                        totalReturnToStore,
                        netKgUsed,
                        totalBagsProduced,
                        totalWastageKg,
                        totalRejectedBags,
                        yieldRatioBagsPerKg,
                        avgKgPerBag
                    },
                    tableData: groupedByWorkOrder,
                    groupedByWorkOrder,
                    groupedByDate
                },
                tableData: groupedByWorkOrder,
                todayBags,
                yesterdayBags,
                totalInputKg,
                netKgUsed,
                totalBagsProduced,
                totalWastageKg,
                totalRejectedBags
            }
        });
    } catch (error) {
        console.error('Error in getProductionYieldMetrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve production yield and KPI metrics.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Inventory Valuation Analytics & Asset Ledger (Weighted Average Cost Method)
 * @route   GET /api/analytics/inventory-valuation
 * @access  Private (ANALYTICS:READ / INVENTORY:READ)
 */
const getInventoryValuation = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);

        // 1. Calculate Weighted Average Purchase Rates per Raw Material from Purchase Orders
        const poRateAgg = await PurchaseOrder.aggregate([
            {
                $match: {
                    tenant: tenantObjId,
                    status: { $nin: ['CANCELLED', 'DRAFT'] }
                }
            },
            { $unwind: '$items' },
            {
                $match: {
                    'items.ratePerUnit': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: '$items.rawMaterial',
                    totalSpend: {
                        $sum: {
                            $multiply: [
                                '$items.ratePerUnit',
                                { $ifNull: ['$items.receivedQuantity', '$items.orderedQuantity'] }
                            ]
                        }
                    },
                    totalQty: {
                        $sum: { $ifNull: ['$items.receivedQuantity', '$items.orderedQuantity'] }
                    },
                    lastRate: { $last: '$items.ratePerUnit' }
                }
            }
        ]);

        const poRateMap = new Map();
        poRateAgg.forEach((p) => {
            const avgRate = p.totalQty > 0 ? (p.totalSpend / p.totalQty) : p.lastRate;
            poRateMap.set(String(p._id), Math.round(avgRate * 100) / 100);
        });

        // 2. Query Active Raw Materials with current stock > 0
        const rawMaterialDocs = await RawMaterial.find({
            tenant: tenantObjId,
            isActive: { $ne: false },
            currentStock: { $gt: 0 }
        })
            .select('name code category uom currentStock pricePerUnit lastPurchasePrice materialDescription materialQualityFabric fabricGrammage fabricSize fabricAverage')
            .populate('category', 'name type')
            .populate('uom', 'symbol name')
            .lean();

        // 3. Query Active Finished Goods with current stock > 0
        const finishedGoodDocs = await FinishedGood.find({
            tenant: tenantObjId,
            isActive: { $ne: false },
            currentStock: { $gt: 0 }
        })
            .select('name code category uom currentStock pricePerBag wholesalePrice retailPrice')
            .populate('category', 'name type')
            .populate('uom', 'symbol name')
            .lean();

        // 4. Query Stock Transactions in last 90 days to identify active stock movements
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const activeMovementItemIds = await StockTransaction.distinct('item', {
            tenant: tenantObjId,
            transactionType: { $in: ['STOCK_OUT', 'PRODUCTION_CONSUMPTION', 'POS_SALE', 'TRANSFER', 'ADJUSTMENT'] },
            createdAt: { $gte: ninetyDaysAgo }
        });
        const activeMovementSet = new Set(activeMovementItemIds.map((id) => String(id)));

        // 5. Query WIP Fabric Rolls from GRN with remaining meters stock
        const grns = await GRN.find({
            tenant: tenantObjId,
            'rolls.0': { $exists: true }
        }).select('items rolls').lean();

        let grnRollsKg = 0;
        let grnRollsValue = 0;

        if (grns.length > 0) {
            const activeWorkOrders = await WorkOrder.find({
                tenant: tenantObjId,
                status: { $ne: 'CANCELLED' },
                'jobOrderDetails.rolls.0': { $exists: true }
            }).select('jobOrderDetails.rolls').lean();

            const rollConsumptionMap = {};
            for (const wo of activeWorkOrders) {
                const woRolls = wo.jobOrderDetails?.rolls || [];
                for (const r of woRolls) {
                    const consumed = Number(r.fabricLength != null ? r.fabricLength : (r.length != null ? r.length : 0)) || 0;
                    if (r.rollId) rollConsumptionMap[String(r.rollId)] = (rollConsumptionMap[String(r.rollId)] || 0) + consumed;
                    if (r.rollNumber || r.rollNo) {
                        const numKey = String(r.rollNumber || r.rollNo).trim().toUpperCase();
                        rollConsumptionMap[numKey] = (rollConsumptionMap[numKey] || 0) + consumed;
                    }
                }
            }

            for (const grn of grns) {
                const rawMatId = grn.items?.[0]?.rawMaterial ? String(grn.items[0].rawMaterial) : null;
                const rollRate = (rawMatId && poRateMap.get(rawMatId)) || 135; // Standard/PO rate for fabric

                for (const r of (grn.rolls || [])) {
                    const rollIdStr = String(r._id);
                    const rollNumStr = String(r.rollNumber || '').trim().toUpperCase();
                    const totalMeters = Number(r.fabricLength || 0);

                    const usedMeters = rollConsumptionMap[rollIdStr] || rollConsumptionMap[rollNumStr] || 0;
                    const remainingMeters = totalMeters > 0 ? Math.max(0, totalMeters - usedMeters) : (usedMeters > 0 ? 0 : 1);

                    if (remainingMeters > 0) {
                        const rollWeight = Number(r.netWeight != null ? r.netWeight : (r.totalQuantityKg != null ? r.totalQuantityKg : (r.grossWeight != null ? r.grossWeight : 0))) || 0;
                        if (rollWeight > 0) {
                            const availKg = totalMeters > 0 && usedMeters > 0 ? (rollWeight * remainingMeters) / totalMeters : rollWeight;
                            grnRollsKg += availKg;
                            grnRollsValue += availKg * rollRate;
                        }
                    }
                }
            }
        }

        // 6. Process Raw Materials and Separate WIP Fabric Items
        const rawMaterialItems = [];
        let rawMaterialValuation = 0;
        let wipFabricKg = grnRollsKg;
        let wipFabricValuation = grnRollsValue;
        let slowMovingValue = 0;
        const allCategories = new Set();

        for (const rm of rawMaterialDocs) {
            const qty = Number(rm.currentStock || 0);
            if (qty <= 0) continue;

            const rmIdStr = String(rm._id);
            const unitRate = poRateMap.get(rmIdStr) || Number(rm.lastPurchasePrice || rm.pricePerUnit || 0);
            const totalValuation = Math.round(qty * unitRate * 100) / 100;
            const uomStr = (typeof rm.uom === 'object' ? (rm.uom?.symbol || rm.uom?.name) : rm.uom) || 'Kg';
            const catName = rm.category?.name || 'Raw Material';
            allCategories.add(catName.toLowerCase());

            const isFabric = (
                catName.toLowerCase().includes('fabric') ||
                catName.toLowerCase().includes('roll') ||
                rm.name.toLowerCase().includes('fabric') ||
                rm.name.toLowerCase().includes('roll') ||
                rm.code.toLowerCase().includes('fab') ||
                (rm.materialQualityFabric && String(rm.materialQualityFabric).trim() !== '') ||
                Boolean(rm.fabricGrammage) ||
                Boolean(rm.fabricSize)
            );

            if (isFabric) {
                wipFabricKg += qty;
                wipFabricValuation += totalValuation;
            } else {
                rawMaterialValuation += totalValuation;
                rawMaterialItems.push({
                    _id: rm._id,
                    name: rm.name,
                    code: rm.code,
                    category: 'Raw Material',
                    subCategory: catName,
                    type: 'Raw Material',
                    currentQuantity: qty,
                    unit: uomStr,
                    unitRate,
                    totalValuation
                });
            }

            // Check if slow moving (no movements in last 90 days)
            if (!activeMovementSet.has(rmIdStr)) {
                slowMovingValue += totalValuation;
            }
        }

        // 7. Process Finished Goods
        const finishedGoodsItems = [];
        let finishedBagsValuation = 0;
        let finishedBagsCount = 0;

        for (const fg of finishedGoodDocs) {
            const qty = Number(fg.currentStock || 0);
            if (qty <= 0) continue;

            const fgIdStr = String(fg._id);
            const unitRate = Number(fg.pricePerBag || fg.wholesalePrice || fg.retailPrice || 0);
            const totalValuation = Math.round(qty * unitRate * 100) / 100;

            finishedBagsCount += qty;
            finishedBagsValuation += totalValuation;

            finishedGoodsItems.push({
                _id: fg._id,
                name: fg.name,
                code: fg.code,
                category: 'Finished Goods',
                subCategory: fg.category?.name || 'Finished Bags',
                type: 'Finished Goods',
                currentQuantity: qty,
                unit: 'Bags',
                unitRate,
                totalValuation
            });

            if (!activeMovementSet.has(fgIdStr)) {
                slowMovingValue += totalValuation;
            }
        }

        // 8. Build WIP Fabric Object
        wipFabricKg = Math.round(wipFabricKg * 100) / 100;
        wipFabricValuation = Math.round(wipFabricValuation * 100) / 100;
        const wipUnitRate = wipFabricKg > 0 ? Math.round((wipFabricValuation / wipFabricKg) * 100) / 100 : 0;

        const wipFabric = {
            name: 'Unprinted Tubular Fabric / WIP Fabric Rolls',
            category: 'WIP Fabric Roll',
            type: 'WIP Fabric Roll',
            currentQuantity: wipFabricKg,
            unit: 'Kg',
            unitRate: wipUnitRate,
            totalValuation: wipFabricValuation
        };

        // 9. Combine all Ledger items
        const ledgerList = [...rawMaterialItems];
        if (wipFabricKg > 0) {
            ledgerList.push(wipFabric);
        }
        ledgerList.push(...finishedGoodsItems);

        // Sort descending by total valuation
        ledgerList.sort((a, b) => b.totalValuation - a.totalValuation);

        // 10. Summary Totals
        rawMaterialValuation = Math.round(rawMaterialValuation * 100) / 100;
        finishedBagsValuation = Math.round(finishedBagsValuation * 100) / 100;
        slowMovingValue = Math.round(slowMovingValue * 100) / 100;
        const totalInventoryAssetValue = Math.round((rawMaterialValuation + wipFabricValuation + finishedBagsValuation) * 100) / 100;

        // Subtitle check: "PP Granules & Additives" if those categories exist, otherwise generic "Raw Material Stock"
        const hasGranulesOrAdditives = Array.from(allCategories).some(c => c.includes('granule') || c.includes('masterbatch') || c.includes('filler') || c.includes('resin') || c.includes('additive'));
        const rawMaterialSubtitle = hasGranulesOrAdditives ? 'PP Granules & Additives' : 'Raw Material Stock';

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalInventoryAssetValue,
                    rawMaterialValuation,
                    finishedBagsValuation,
                    finishedBagsCount,
                    slowMovingValue,
                    wipValuation: wipFabricValuation,
                    rawMaterialSubtitle,
                    valuationMethod: 'Weighted Average Cost Method'
                },
                rawMaterial: rawMaterialItems,
                wipFabric,
                finishedGoods: finishedGoodsItems,
                ledgerList
            }
        });
    } catch (error) {
        console.error('Error in getInventoryValuation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve inventory valuation analytics.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Sales & GST Tax Register Analytics (GSTR-1, GSTR-3B Statutory Register)
 * @route   GET /api/analytics/gst-register
 * @access  Private
 */
const getGstTaxRegister = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);

        // Fetch company GSTIN, state, and filing frequency from Tenant settings
        const tenantDoc = await Tenant.findById(tenantId).lean();
        const companyGstin = tenantDoc?.gstin || '';
        let companyStateCode = tenantDoc?.stateCode || '';
        if (!companyStateCode && companyGstin && companyGstin.length >= 2) {
            companyStateCode = companyGstin.substring(0, 2);
        }
        const gstFilingFrequency = tenantDoc?.gstFilingFrequency || 'Monthly';

        // Determine current Financial Year in IST (today 28 Sep 2026 -> FY 2026-27, fy=2026)
        const now = new Date();
        const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
        const currentYear = istDate.getFullYear();
        const currentMonth = istDate.getMonth() + 1; // 1 to 12
        const currentDay = istDate.getDate();
        const istDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const currentFy = currentMonth >= 4 ? currentYear : currentYear - 1;

        let fy = parseInt(req.query.fy, 10);
        if (isNaN(fy)) {
            fy = currentFy;
        }

        // IST FY boundaries: 1st April 00:00:00 IST to 31st March 23:59:59.999 IST
        const fyStart = new Date(`${fy}-04-01T00:00:00+05:30`);
        const fyEnd = new Date(`${fy + 1}-03-31T23:59:59.999+05:30`);

        // 1. Sales & Output GST aggregation (Finalized Invoices only)
        const invoiceAgg = await Invoice.aggregate([
            {
                $match: {
                    tenant: tenantObjId,
                    isActive: { $ne: false },
                    status: { $nin: ['CANCELLED', 'Cancelled', 'cancelled', 'DRAFT', 'Draft', 'draft', 'VOID', 'Void', 'void'] },
                    invoiceDate: { $gte: fyStart, $lte: fyEnd }
                }
            },
            {
                $lookup: {
                    from: 'customers',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customerDoc'
                }
            },
            {
                $unwind: {
                    path: '$customerDoc',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    monthKey: {
                        $dateToString: {
                            format: '%Y-%m',
                            date: '$invoiceDate',
                            timezone: 'Asia/Kolkata'
                        }
                    },
                    invTaxable: {
                        $cond: [
                            { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] },
                            { $sum: '$items.taxableValue' },
                            { $subtract: [{ $ifNull: ['$grandTotal', 0] }, { $ifNull: ['$gstAmount', 0] }] }
                        ]
                    },
                    hasStoredTaxes: {
                        $gt: [
                            { $add: [{ $ifNull: ['$cgstAmount', 0] }, { $ifNull: ['$sgstAmount', 0] }, { $ifNull: ['$igstAmount', 0] }] },
                            0
                        ]
                    },
                    isSameState: {
                        $cond: [
                            { $eq: ['$customerType', 'WALK_IN'] },
                            true,
                            {
                                $cond: [
                                    { $eq: [{ $ifNull: ['$customerDoc.state', ''] }, companyStateCode] },
                                    true,
                                    false
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    effectiveCgst: {
                        $cond: [
                            '$hasStoredTaxes',
                            { $ifNull: ['$cgstAmount', 0] },
                            {
                                $cond: [
                                    '$isSameState',
                                    { $divide: [{ $ifNull: ['$gstAmount', 0] }, 2] },
                                    0
                                ]
                            }
                        ]
                    },
                    effectiveSgst: {
                        $cond: [
                            '$hasStoredTaxes',
                            { $ifNull: ['$sgstAmount', 0] },
                            {
                                $cond: [
                                    '$isSameState',
                                    { $divide: [{ $ifNull: ['$gstAmount', 0] }, 2] },
                                    0
                                ]
                            }
                        ]
                    },
                    effectiveIgst: {
                        $cond: [
                            '$hasStoredTaxes',
                            { $ifNull: ['$igstAmount', 0] },
                            {
                                $cond: [
                                    '$isSameState',
                                    0,
                                    { $ifNull: ['$gstAmount', 0] }
                                ]
                            }
                        ]
                    },
                    effectiveTotalGst: {
                        $cond: [
                            { $gt: [{ $ifNull: ['$gstAmount', 0] }, 0] },
                            '$gstAmount',
                            { $add: [{ $ifNull: ['$cgstAmount', 0] }, { $ifNull: ['$sgstAmount', 0] }, { $ifNull: ['$igstAmount', 0] }] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$monthKey',
                    taxableSales: { $sum: '$invTaxable' },
                    cgst: { $sum: '$effectiveCgst' },
                    sgst: { $sum: '$effectiveSgst' },
                    igst: { $sum: '$effectiveIgst' },
                    totalGstLiability: { $sum: '$effectiveTotalGst' }
                }
            }
        ]);

        // 2. Input Tax Credit (ITC) from confirmed Purchase Orders & Material Receipts
        const poAgg = await PurchaseOrder.aggregate([
            {
                $match: {
                    tenant: tenantObjId,
                    isActive: { $ne: false },
                    status: { $in: ['SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'] },
                    poDate: { $gte: fyStart, $lte: fyEnd }
                }
            },
            {
                $addFields: {
                    monthKey: {
                        $dateToString: {
                            format: '%Y-%m',
                            date: '$poDate',
                            timezone: 'Asia/Kolkata'
                        }
                    },
                    taxable: {
                        $cond: [
                            { $gt: [{ $ifNull: ['$totalValue', 0] }, 0] },
                            '$totalValue',
                            {
                                $sum: {
                                    $map: {
                                        input: { $ifNull: ['$items', []] },
                                        as: 'it',
                                        in: { $multiply: [{ $ifNull: ['$$it.orderedQuantity', 0] }, { $ifNull: ['$$it.ratePerUnit', 0] }] }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$monthKey',
                    itc: { $sum: { $multiply: ['$taxable', 0.18] } } // Computed at standard 18% GST rate on purchase taxable values
                }
            }
        ]);

        const mrAgg = await MaterialReceipt.aggregate([
            {
                $match: {
                    tenant: tenantObjId,
                    date: { $gte: fyStart, $lte: fyEnd }
                }
            },
            {
                $addFields: {
                    monthKey: {
                        $dateToString: {
                            format: '%Y-%m',
                            date: '$date',
                            timezone: 'Asia/Kolkata'
                        }
                    },
                    itcAmount: {
                        $multiply: [
                            { $ifNull: ['$basicPrice', 0] },
                            { $divide: [{ $ifNull: ['$gstPercent', 0] }, 100] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$monthKey',
                    itc: { $sum: '$itcAmount' }
                }
            }
        ]);

        // Map aggregated results
        const salesMap = {};
        invoiceAgg.forEach((item) => {
            salesMap[item._id] = item;
        });

        const itcMap = {};
        poAgg.forEach((p) => {
            itcMap[p._id] = (itcMap[p._id] || 0) + (p.itc || 0);
        });
        mrAgg.forEach((m) => {
            itcMap[m._id] = (itcMap[m._id] || 0) + (m.itc || 0);
        });

        // 3. Construct 12 Financial Year months (Apr -> Mar) with IST boundaries
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const fyMonthsConfig = [
            { year: fy, month: 4 },
            { year: fy, month: 5 },
            { year: fy, month: 6 },
            { year: fy, month: 7 },
            { year: fy, month: 8 },
            { year: fy, month: 9 },
            { year: fy, month: 10 },
            { year: fy, month: 11 },
            { year: fy, month: 12 },
            { year: fy + 1, month: 1 },
            { year: fy + 1, month: 2 },
            { year: fy + 1, month: 3 }
        ];

        const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        // Fetch saved GST filing records for this tenant and FY months
        const targetMonths = fyMonthsConfig.map((cfg) => `${cfg.year}-${String(cfg.month).padStart(2, '0')}`);
        const filingRecords = await GstFiling.find({
            tenant: tenantObjId,
            month: { $in: targetMonths }
        }).lean();

        const filingsMap = {};
        filingRecords.forEach((f) => {
            filingsMap[`${f.month}_${f.returnType}`] = f;
        });

        const months = [];

        for (const cfg of fyMonthsConfig) {
            const mKey = `${cfg.year}-${String(cfg.month).padStart(2, '0')}`;

            // Do not return future months beyond current month for current FY
            if (fy === currentFy && mKey > currentYearMonth) {
                continue;
            }
            if (fy > currentFy) {
                continue;
            }

            const sales = salesMap[mKey] || {};
            const itcVal = Number((itcMap[mKey] || 0).toFixed(2));
            const taxableSales = Number((sales.taxableSales || 0).toFixed(2));
            const cgst = Number((sales.cgst || 0).toFixed(2));
            const sgst = Number((sales.sgst || 0).toFixed(2));
            const igst = Number((sales.igst || 0).toFixed(2));
            const totalGstLiability = Number((sales.totalGstLiability || (cgst + sgst + igst)).toFixed(2));

            // Due Date Calculation for next month in IST:
            // Monthly: GSTR-1 = 11th, GSTR-3B = 20th
            // Quarterly: GSTR-1 = 13th, GSTR-3B = 22nd
            const nextMonth = cfg.month === 12 ? 1 : cfg.month + 1;
            const nextYear = cfg.month === 12 ? cfg.year + 1 : cfg.year;
            const nextMonthStr = String(nextMonth).padStart(2, '0');

            const gstr1Day = gstFilingFrequency === 'Quarterly' ? '13' : '11';
            const gstr3bDay = gstFilingFrequency === 'Quarterly' ? '22' : '20';
            const dueDateGstr1 = `${nextYear}-${nextMonthStr}-${gstr1Day}`;
            const dueDateGstr3b = `${nextYear}-${nextMonthStr}-${gstr3bDay}`;

            const hasActivity = taxableSales > 0 || totalGstLiability > 0 || itcVal > 0;
            const filing1 = filingsMap[`${mKey}_GSTR-1`];
            const filing3b = filingsMap[`${mKey}_GSTR-3B`];

            // Resolve Return Status per business rules
            const resolveReturnStatus = (filing, dueDateStr) => {
                if (filing) return 'Filed';
                if (!hasActivity) return '-';
                if (mKey === currentYearMonth) return 'Not Due Yet';
                if (istDateStr > dueDateStr) return 'Overdue';
                if (mKey < currentYearMonth && istDateStr <= dueDateStr) return 'Pending';
                return 'Not Due Yet';
            };

            const status1 = resolveReturnStatus(filing1, dueDateGstr1);
            const status3b = resolveReturnStatus(filing3b, dueDateGstr3b);

            months.push({
                monthKey: mKey,
                returnPeriod: `${monthNames[cfg.month - 1]} ${cfg.year}`,
                taxableSales,
                cgst,
                sgst,
                igst,
                totalGstLiability,
                itc: itcVal,
                gstr1: {
                    status: status1,
                    dueDate: dueDateGstr1,
                    filedDate: filing1 ? filing1.filedDate : null,
                    arnNumber: filing1?.arnNumber || '',
                    taxPaid: filing1?.taxPaid || 0,
                    filingId: filing1?._id || null
                },
                gstr3b: {
                    status: status3b,
                    dueDate: dueDateGstr3b,
                    filedDate: filing3b ? filing3b.filedDate : null,
                    arnNumber: filing3b?.arnNumber || '',
                    taxPaid: filing3b?.taxPaid || 0,
                    filingId: filing3b?._id || null
                }
            });
        }

        // Summary calculations
        let totalTaxableTurnover = 0;
        let totalGstCollected = 0;
        let inputTaxCredit = 0;

        months.forEach((m) => {
            totalTaxableTurnover += m.taxableSales;
            totalGstCollected += m.totalGstLiability;
            inputTaxCredit += m.itc;
        });

        totalTaxableTurnover = Number(totalTaxableTurnover.toFixed(2));
        totalGstCollected = Number(totalGstCollected.toFixed(2));
        inputTaxCredit = Number(inputTaxCredit.toFixed(2));

        const netTaxPayable = Number(Math.max(0, totalGstCollected - inputTaxCredit).toFixed(2));
        const itcCarryForward = Number(Math.max(0, inputTaxCredit - totalGstCollected).toFixed(2));

        return res.status(200).json({
            success: true,
            data: {
                companyGstin,
                financialYear: `FY ${fy}-${String(fy + 1).slice(-2)}`,
                fy,
                gstFilingFrequency,
                summary: {
                    totalTaxableTurnover,
                    totalGstCollected,
                    inputTaxCredit,
                    netTaxPayable,
                    itcCarryForward,
                    gstRateLabel: 'CGST + SGST + IGST'
                },
                months
            }
        });
    } catch (error) {
        console.error('Error in getGstTaxRegister:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve GST tax register analytics.',
            error: error.message
        });
    }
};

/**
 * @desc    Create or update a GST Filing record (GSTR-1 or GSTR-3B)
 * @route   POST /api/analytics/gst-filing
 * @access  Private (ANALYTICS module)
 */
const saveGstFiling = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { month, returnType, filedDate, arnNumber, taxPaid } = req.body;

        if (!month || !returnType) {
            return res.status(400).json({
                success: false,
                message: 'Month (YYYY-MM) and returnType (GSTR-1 or GSTR-3B) are required.'
            });
        }

        if (!['GSTR-1', 'GSTR-3B'].includes(returnType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid returnType. Must be GSTR-1 or GSTR-3B.'
            });
        }

        // Determine financialYear from month string (e.g. "2026-04" -> "FY 2026-27")
        const parts = String(month).split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(m)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid month format. Expected YYYY-MM.'
            });
        }

        const fy = m >= 4 ? y : y - 1;
        const financialYear = `FY ${fy}-${String(fy + 1).slice(-2)}`;

        const filing = await GstFiling.findOneAndUpdate(
            {
                tenant: tenantObjId,
                month: String(month).trim(),
                returnType
            },
            {
                $set: {
                    financialYear,
                    status: 'Filed',
                    filedDate: filedDate ? new Date(filedDate) : new Date(),
                    arnNumber: arnNumber ? String(arnNumber).trim() : '',
                    taxPaid: !isNaN(Number(taxPaid)) && Number(taxPaid) >= 0 ? Number(taxPaid) : 0,
                    filedBy: req.user?._id || null
                }
            },
            { upsert: true, new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: `${returnType} filing for ${month} saved successfully.`,
            data: filing
        });
    } catch (error) {
        console.error('Error saving GST filing:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to record GST filing.',
            error: error.message
        });
    }
};

/**
 * @desc    Delete/Undo a GST Filing record
 * @route   DELETE /api/analytics/gst-filing/:id
 * @access  Private (ANALYTICS module)
 */
const deleteGstFiling = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filing record ID format.'
            });
        }

        const filing = await GstFiling.findOneAndDelete({
            _id: new mongoose.Types.ObjectId(id),
            tenant: tenantObjId
        });

        if (!filing) {
            return res.status(404).json({
                success: false,
                message: 'GST filing record not found or does not belong to your organization.'
            });
        }

        return res.status(200).json({
            success: true,
            message: `${filing.returnType} filing for ${filing.month} has been undone.`
        });
    } catch (error) {
        console.error('Error deleting GST filing:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to undo GST filing.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Operator Productivity Analytics across Work Orders (Final stage finished bags)
 * @route   GET /api/analytics/operator-productivity
 * @access  Private (ANALYTICS:READ / PRODUCTION:READ)
 */
const getOperatorProductivityMetrics = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const tenantObjId = new mongoose.Types.ObjectId(tenantId);
        const { startDate, endDate, operatorId } = req.query;

        // 1. Calculate IST boundaries for requested date range
        const hasCustomStartDate = Boolean(startDate && typeof startDate === 'string' && startDate.trim() !== '' && startDate !== 'undefined');
        const hasCustomEndDate = Boolean(endDate && typeof endDate === 'string' && endDate.trim() !== '' && endDate !== 'undefined');

        let rangeStart = null;
        let rangeEnd = null;

        if (hasCustomStartDate) {
            rangeStart = new Date(`${startDate.trim()}T00:00:00.000+05:30`);
        }
        if (hasCustomEndDate) {
            rangeEnd = new Date(`${endDate.trim()}T23:59:59.999+05:30`);
        }

        // 2. Fetch all Work Orders for this tenant to identify their final stage and metadata
        const workOrders = await WorkOrder.find({
            tenant: tenantObjId,
            status: { $nin: ['CANCELLED', 'PENDING'] }
        }).select('_id workOrderNumber status stages completedQuantity createdAt').lean();

        const woMap = new Map();
        workOrders.forEach((wo) => {
            const nonSkipped = (wo.stages || []).filter((s) => s.status !== 'SKIPPED');
            const finalStage = nonSkipped.find((s) => s.sequence === 8 || s.stageName === 'BALING_PACKING') || nonSkipped[nonSkipped.length - 1];
            const finalStageName = finalStage?.stageName || 'BALING_PACKING';

            woMap.set(String(wo._id), {
                workOrderId: wo._id,
                workOrderNumber: wo.workOrderNumber,
                status: wo.status,
                finalStageName,
                createdAt: wo.createdAt,
                completedQuantity: Number(wo.completedQuantity || finalStage?.completedQuantity || finalStage?.goodOutputQty || 0),
                loggedFinalQty: 0
            });
        });

        // 3. Query ProductionLog documents
        const logFilter = {
            tenant: tenantObjId
        };

        if (rangeStart && rangeEnd) {
            logFilter.date = { $gte: rangeStart, $lte: rangeEnd };
        } else if (rangeStart) {
            logFilter.date = { $gte: rangeStart };
        } else if (rangeEnd) {
            logFilter.date = { $lte: rangeEnd };
        }

        if (operatorId && mongoose.isValidObjectId(operatorId)) {
            logFilter.operator = new mongoose.Types.ObjectId(operatorId);
        }

        const logs = await ProductionLog.find(logFilter)
            .populate('operator', 'name employeeCode department designation')
            .populate('workOrder', 'workOrderNumber status')
            .sort({ date: 1 })
            .lean();

        // 4. Process logs on Final Stages (to prevent double counting across stages)
        const operatorAgg = new Map();
        let totalFinalBagsProduced = 0;
        let unattributedBags = 0;

        logs.forEach((log) => {
            const woIdStr = String(log.workOrder?._id || log.workOrder);
            const woInfo = woMap.get(woIdStr);
            const stageName = log.stage || log.stageName;

            // Check if this log is on the final stage of this Work Order
            const isFinalStage = woInfo
                ? (stageName === woInfo.finalStageName || log.stageSequence === 8 || stageName === 'BALING_PACKING')
                : (log.stageSequence === 8 || stageName === 'BALING_PACKING');

            if (!isFinalStage) {
                return; // Exclude non-final stages from finished goods count
            }

            const qty = Number(log.quantity || 0);
            if (qty <= 0) return;

            totalFinalBagsProduced += qty;
            if (woInfo) {
                woInfo.loggedFinalQty += qty;
            }

            const op = log.operator;
            const isUnassigned = !op || log.remarks?.includes('legacy');

            if (isUnassigned) {
                unattributedBags += qty;
            }

            const opId = op?._id ? String(op._id) : 'legacy-unassigned';
            const opName = op?.name || (isUnassigned ? 'Legacy / Unassigned' : 'Unknown Operator');
            const opCode = op?.employeeCode || (isUnassigned ? 'LEGACY' : '');
            const dept = op?.department || 'PRODUCTION';

            if (!operatorAgg.has(opId)) {
                operatorAgg.set(opId, {
                    operatorId: opId,
                    operatorName: opName,
                    employeeCode: opCode,
                    department: dept,
                    totalBags: 0,
                    workOrdersMap: new Map(),
                    dailyMap: new Map(),
                    isLegacy: isUnassigned
                });
            }

            const record = operatorAgg.get(opId);
            record.totalBags += qty;

            // Work order breakdown
            const woNum = log.workOrder?.workOrderNumber || woInfo?.workOrderNumber || 'WO-Unknown';
            const dateStr = getIstDateString(log.date);

            if (!record.workOrdersMap.has(woIdStr)) {
                record.workOrdersMap.set(woIdStr, {
                    workOrderId: woIdStr,
                    workOrderNumber: woNum,
                    totalQuantity: 0,
                    lastDate: dateStr
                });
            }
            const woEntry = record.workOrdersMap.get(woIdStr);
            woEntry.totalQuantity += qty;
            woEntry.lastDate = dateStr;

            // Date breakdown
            record.dailyMap.set(dateStr, (record.dailyMap.get(dateStr) || 0) + qty);
        });

        // 5. Check for legacy Work Orders in range with 0 ProductionLog entries
        let legacyWosWithoutLogsBags = 0;
        let legacyWosCount = 0;

        workOrders.forEach((wo) => {
            const woInfo = woMap.get(String(wo._id));
            if (!woInfo) return;

            // Check if WO creation date is in range
            let inDateRange = true;
            if (rangeStart && wo.createdAt < rangeStart) inDateRange = false;
            if (rangeEnd && wo.createdAt > rangeEnd) inDateRange = false;

            if (inDateRange && woInfo.loggedFinalQty === 0 && woInfo.completedQuantity > 0) {
                legacyWosWithoutLogsBags += woInfo.completedQuantity;
                legacyWosCount += 1;
            }
        });

        // 6. Format operator records for table output
        const operatorsResult = [];

        operatorAgg.forEach((op) => {
            // Find best single day
            let bestDay = null;
            let maxDayQty = 0;

            op.dailyMap.forEach((q, d) => {
                if (q > maxDayQty) {
                    maxDayQty = q;
                    bestDay = { date: d, quantity: q };
                }
            });

            const dailyBreakdown = Array.from(op.dailyMap.entries())
                .map(([d, q]) => ({ date: d, quantity: q }))
                .sort((a, b) => a.date.localeCompare(b.date));

            const workOrdersList = Array.from(op.workOrdersMap.values())
                .sort((a, b) => b.totalQuantity - a.totalQuantity);

            operatorsResult.push({
                operatorId: op.operatorId,
                operatorName: op.operatorName,
                employeeCode: op.employeeCode,
                department: op.department,
                totalBags: op.totalBags,
                workOrderCount: workOrdersList.length,
                workOrders: workOrdersList,
                bestSingleDay: bestDay || { date: '-', quantity: op.totalBags },
                dailyBreakdown,
                isLegacy: op.isLegacy
            });
        });

        // Sort operators by total bags produced descending
        operatorsResult.sort((a, b) => b.totalBags - a.totalBags);

        const totalActiveOperators = operatorsResult.filter((o) => !o.isLegacy && o.totalBags > 0).length;
        const totalLegacyUnattributed = unattributedBags + legacyWosWithoutLogsBags;

        const topOperator = operatorsResult.find((o) => !o.isLegacy && o.totalBags > 0);

        // Fetch all active employees for filter dropdown
        const allEmployees = await Employee.find({
            tenant: tenantObjId,
            isActive: { $ne: false }
        }).select('_id name employeeCode department').lean();

        const availableOperators = allEmployees.map((e) => ({
            operatorId: String(e._id),
            name: e.name,
            employeeCode: e.employeeCode || '',
            department: e.department || ''
        }));

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalOperatorsActive: totalActiveOperators,
                    totalBagsProduced: totalFinalBagsProduced,
                    legacyUnattributedBags: totalLegacyUnattributed,
                    legacyWosCount,
                    topOperatorName: topOperator?.operatorName || 'N/A',
                    topOperatorBags: topOperator?.totalBags || 0,
                    avgBagsPerOperator: totalActiveOperators > 0 ? Math.round(totalFinalBagsProduced / totalActiveOperators) : 0
                },
                operators: operatorsResult,
                availableOperators
            }
        });
    } catch (error) {
        console.error('Error in getOperatorProductivityMetrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve operator productivity metrics.',
            error: error.message
        });
    }
};

module.exports = {
    getFinancialSummary,
    getProductionYieldMetrics,
    getInventoryValuation,
    getGstTaxRegister,
    getOperatorProductivityMetrics,
    saveGstFiling,
    deleteGstFiling
};

