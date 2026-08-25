const mongoose = require('mongoose');
const SalesOrder = require('../models/salesOrder.model');
const WorkOrder = require('../models/workOrder.model');
const Invoice = require('../models/invoice.model');
const RawMaterial = require('../models/rawMaterial.model');
const FinishedGood = require('../models/finishedGood.model');
const Machine = require('../models/machine.model');
const AttendanceLog = require('../models/attendanceLog.model');
const Employee = require('../models/employee.model');

/**
 * Helper to calculate percentage change vs previous period
 */
const calculateTrendPercent = (current, previous) => {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev === 0) {
        return curr > 0 ? 100 : 0;
    }
    return Number((((curr - prev) / prev) * 100).toFixed(2));
};

/**
 * @desc    Get Executive Dashboard Summary & KPIs
 * @route   GET /api/dashboard/summary
 * @access  Private (SALES:READ / ANALYTICS:READ permission)
 */
const getDashboardSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
        const now = new Date();

        // 1. Date Windows: Today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

        // 2. Date Windows: Current Month & Previous Month
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Parallel Execution of Dashboard Aggregations
        const [
            // KPI 1: Sales Orders Count (Current vs Prev Month)
            currMonthSO,
            prevMonthSO,

            // KPI 2: Today's Production Bags (Today vs Yesterday)
            todayProdResult,
            yesterdayProdResult,

            // KPI 3: Monthly Revenue (Current vs Prev Month)
            currRevenueResult,
            prevRevenueResult,

            // KPI 4: Inventory Valuation
            rawMaterialDocs,
            finishedGoodDocs,

            // KPI 5: Pending Dispatches Count
            pendingDispatchesCount,

            // KPI 6: Machine Utilization
            totalActiveMachines,
            runningMachineIds,

            // KPI 7: Production Efficiency / Yield (Current Month COMPLETED WOs)
            currEfficiencyResult,

            // KPI 8: Attendance Rate (Current Month)
            totalLogsThisMonth,
            presentLogsThisMonth,

            // KPI 9: Receivables
            receivablesResult
        ] = await Promise.all([
            // SO Counts
            SalesOrder.countDocuments({ tenant: tenantObjectId, isActive: true, createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            SalesOrder.countDocuments({ tenant: tenantObjectId, isActive: true, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),

            // Today's & Yesterday's Production (Bags) from COMPLETED WOs
            WorkOrder.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, status: 'COMPLETED', updatedAt: { $gte: todayStart, $lte: todayEnd } } },
                { $group: { _id: null, totalBags: { $sum: "$completedQuantity" } } }
            ]),
            WorkOrder.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, status: 'COMPLETED', updatedAt: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
                { $group: { _id: null, totalBags: { $sum: "$completedQuantity" } } }
            ]),

            // Monthly Revenue (Current vs Prev Month from Invoice)
            Invoice.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, invoiceDate: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
                { $group: { _id: null, taxableRevenue: { $sum: { $subtract: ["$grandTotal", { $ifNull: ["$gstAmount", 0] }] } } } }
            ]),
            Invoice.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, invoiceDate: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
                { $group: { _id: null, taxableRevenue: { $sum: { $subtract: ["$grandTotal", { $ifNull: ["$gstAmount", 0] }] } } } }
            ]),

            // Inventory Stock Documents
            RawMaterial.find({ tenant: tenantObjectId, isActive: true }).select('currentStock pricePerUnit'),
            FinishedGood.find({ tenant: tenantObjectId, isActive: true }).select('currentStock pendingQCStock pricePerBag'),

            // Pending Dispatches (SalesOrders approved or partially dispatched)
            SalesOrder.countDocuments({ tenant: tenantObjectId, isActive: true, status: { $in: ['APPROVED', 'PARTIALLY_DISPATCHED'] } }),

            // Machine Utilization
            Machine.countDocuments({ tenant: tenantObjectId, isActive: true }),
            WorkOrder.distinct('assignedMachine', { tenant: tenantObjectId, isActive: true, status: 'IN_PROGRESS', assignedMachine: { $ne: null } }),

            // Efficiency / Yield % (Current Month COMPLETED WOs)
            WorkOrder.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, status: 'COMPLETED', createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
                { $group: { _id: null, totalPlanned: { $sum: "$targetQuantity" }, totalActual: { $sum: "$completedQuantity" } } }
            ]),

            // Attendance Logs (Current Month)
            AttendanceLog.countDocuments({ tenant: tenantObjectId, date: { $gte: currentMonthStart, $lte: currentMonthEnd } }),
            AttendanceLog.countDocuments({ tenant: tenantObjectId, date: { $gte: currentMonthStart, $lte: currentMonthEnd }, status: { $in: ['PRESENT', 'HALF_DAY'] } }),

            // Receivables (Unpaid & Partially Paid Invoices)
            Invoice.aggregate([
                { $match: { tenant: tenantObjectId, isActive: true, paymentStatus: { $ne: 'PAID' } } },
                { $group: { _id: null, totalDue: { $sum: "$dueAmount" } } }
            ])
        ]);

        // Process KPI Calculations

        // 1. Total Sales Orders
        const salesOrdersCount = currMonthSO;
        const salesOrdersTrend = calculateTrendPercent(currMonthSO, prevMonthSO);

        // 2. Today's Production (bags)
        const todayBags = todayProdResult[0]?.totalBags || 0;
        const yesterdayBags = yesterdayProdResult[0]?.totalBags || 0;
        const productionTrend = calculateTrendPercent(todayBags, yesterdayBags);

        // 3. Monthly Revenue
        const currRevenue = Number((currRevenueResult[0]?.taxableRevenue || 0).toFixed(2));
        const prevRevenue = Number((prevRevenueResult[0]?.taxableRevenue || 0).toFixed(2));
        const revenueTrend = calculateTrendPercent(currRevenue, prevRevenue);

        // 4. Inventory Valuation
        let rawMaterialValue = 0;
        for (const rm of rawMaterialDocs) {
            rawMaterialValue += (rm.currentStock || 0) * (rm.pricePerUnit || 0);
        }

        let finishedGoodValue = 0;
        for (const fg of finishedGoodDocs) {
            finishedGoodValue += (fg.currentStock || 0) * (fg.pricePerBag || 0);
        }

        const totalInventoryValuation = Number((rawMaterialValue + finishedGoodValue).toFixed(2));

        // 5. Pending Dispatches
        const pendingDispatches = pendingDispatchesCount;

        // 6. Machine Utilization %
        const runningMachinesCount = runningMachineIds ? runningMachineIds.length : 0;
        const machineUtilizationPercent = totalActiveMachines > 0
            ? Number(((runningMachinesCount / totalActiveMachines) * 100).toFixed(2))
            : 0;

        // 7. Production Efficiency / Yield %
        const totalPlanned = currEfficiencyResult[0]?.totalPlanned || 0;
        const totalActual = currEfficiencyResult[0]?.totalActual || 0;
        const productionEfficiencyPercent = totalPlanned > 0
            ? Number(((totalActual / totalPlanned) * 100).toFixed(2))
            : 0;

        // 8. Attendance Rate %
        const attendanceRatePercent = totalLogsThisMonth > 0
            ? Number(((presentLogsThisMonth / totalLogsThisMonth) * 100).toFixed(2))
            : 0;

        // 9. Receivables
        const totalReceivables = Number((receivablesResult[0]?.totalDue || 0).toFixed(2));

        // 10. Payables
        const totalPayables = 0.00;

        return res.status(200).json({
            success: true,
            data: {
                totalSalesOrders: {
                    value: salesOrdersCount,
                    unit: 'orders',
                    trendPercent: salesOrdersTrend,
                    period: 'vs last month'
                },
                todaysProductionBags: {
                    value: todayBags,
                    unit: 'bags',
                    trendPercent: productionTrend,
                    period: 'vs yesterday'
                },
                monthlyRevenue: {
                    value: currRevenue,
                    unit: 'INR',
                    trendPercent: revenueTrend,
                    period: 'vs last month'
                },
                inventoryValuation: {
                    value: totalInventoryValuation,
                    unit: 'INR',
                    rawMaterialValue: Number(rawMaterialValue.toFixed(2)),
                    finishedGoodValue: Number(finishedGoodValue.toFixed(2))
                },
                pendingDispatchOrders: {
                    value: pendingDispatches,
                    unit: 'orders pending'
                },
                machineUtilization: {
                    percent: machineUtilizationPercent,
                    runningMachines: runningMachinesCount,
                    totalMachines: totalActiveMachines
                },
                productionEfficiency: {
                    yieldPercent: productionEfficiencyPercent,
                    totalPlanned,
                    totalActual
                },
                attendanceRate: {
                    percent: attendanceRatePercent,
                    presentLogs: presentLogsThisMonth,
                    totalLogs: totalLogsThisMonth
                },
                financialSummary: {
                    receivables: totalReceivables,
                    payables: totalPayables,
                    payablesTracked: false
                }
            }
        });
    } catch (error) {
        console.error('Error in getDashboardSummary:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to generate Executive Dashboard summary.',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardSummary
};
