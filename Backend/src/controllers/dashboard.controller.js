const mongoose = require('mongoose');
const SalesOrder = require('../models/salesOrder.model');
const WorkOrder = require('../models/workOrder.model');
const Invoice = require('../models/invoice.model');
const RawMaterial = require('../models/rawMaterial.model');
const FinishedGood = require('../models/finishedGood.model');
const Machine = require('../models/machine.model');
const AttendanceLog = require('../models/attendanceLog.model');
const Employee = require('../models/employee.model');
const Customer = require('../models/customer.model');
const Supplier = require('../models/supplier.model');
const GRN = require('../models/grn.model');

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

/**
 * @desc    Global ERP Search across transactions, Master Data, and Fabric Rolls
 * @route   GET /api/dashboard/global-search
 *          GET /api/search
 * @access  Private (Authenticated users)
 */
const globalSearch = async (req, res) => {
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
        const q = String(req.query.q || req.query.query || req.query.search || '').trim();

        if (!q || q.length < 1) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

        // Parallel queries across all entities
        const [
            workOrders,
            invoices,
            salesOrders,
            grns,
            customers,
            suppliers,
            employees,
            machines,
            rawMaterials,
            finishedGoods,
            grnRolls,
            woRolls
        ] = await Promise.all([
            // 1. Work Orders
            WorkOrder.find({
                tenant: tenantObjId,
                $or: [
                    { workOrderNumber: regex },
                    { 'jobOrderDetails.jobOrderNumber': regex }
                ]
            })
            .select('workOrderNumber status targetQuantity completedQuantity finishedGood customer')
            .populate('customer', 'companyName code')
            .populate('finishedGood', 'name code')
            .limit(6)
            .lean(),

            // 2. Invoices
            Invoice.find({
                tenant: tenantObjId,
                invoiceNumber: regex
            })
            .select('invoiceNumber status totalAmount customer invoiceDate')
            .populate('customer', 'companyName code')
            .limit(6)
            .lean(),

            // 3. Sales Orders
            SalesOrder.find({
                tenant: tenantObjId,
                $or: [
                    { soNumber: regex },
                    { customerOrderNumber: regex }
                ]
            })
            .select('soNumber status totalAmount customer')
            .populate('customer', 'companyName code')
            .limit(6)
            .lean(),

            // 4. GRNs & Lot Numbers
            GRN.find({
                tenant: tenantObjId,
                $or: [
                    { grnNumber: regex },
                    { supplierInvoiceNumber: regex },
                    { 'items.batchNumber': regex },
                    { 'items.lotNumber': regex }
                ]
            })
            .select('grnNumber supplier supplierInvoiceNumber status receivedDate items')
            .populate('supplier', 'name code')
            .limit(6)
            .lean(),

            // 5. Customers
            Customer.find({
                tenant: tenantObjId,
                $or: [
                    { code: regex },
                    { customerCode: regex },
                    { companyName: regex },
                    { gstin: regex }
                ]
            })
            .select('code customerCode companyName city state status isActive')
            .limit(6)
            .lean(),

            // 6. Suppliers
            Supplier.find({
                tenant: tenantObjId,
                $or: [
                    { code: regex },
                    { supplierCode: regex },
                    { name: regex },
                    { companyName: regex }
                ]
            })
            .select('code supplierCode name companyName city state status isActive')
            .limit(6)
            .lean(),

            // 7. Employees
            Employee.find({
                tenant: tenantObjId,
                $or: [
                    { employeeCode: regex },
                    { code: regex },
                    { name: regex },
                    { department: regex }
                ]
            })
            .select('employeeCode code name department designation isActive')
            .limit(6)
            .lean(),

            // 8. Machines
            Machine.find({
                tenant: tenantObjId,
                $or: [
                    { code: regex },
                    { machineCode: regex },
                    { name: regex },
                    { section: regex }
                ]
            })
            .select('code machineCode name section status isActive')
            .limit(6)
            .lean(),

            // 9. Raw Materials
            RawMaterial.find({
                tenant: tenantObjId,
                $or: [
                    { code: regex },
                    { itemCode: regex },
                    { name: regex },
                    { materialDescription: regex }
                ]
            })
            .select('code itemCode name materialDescription currentStock isActive')
            .limit(6)
            .lean(),

            // 10. Finished Goods
            FinishedGood.find({
                tenant: tenantObjId,
                $or: [
                    { code: regex },
                    { itemCode: regex },
                    { name: regex }
                ]
            })
            .select('code itemCode name currentStock fabricGSM dimensions isActive')
            .limit(6)
            .lean(),

            // 11. Fabric Rolls in GRNs
            GRN.find({
                tenant: tenantObjId,
                $or: [
                    { 'rolls.rollNumber': regex },
                    { 'items.rolls.rollNumber': regex }
                ]
            })
            .select('grnNumber supplier rolls items')
            .populate('supplier', 'name code')
            .limit(8)
            .lean(),

            // 12. Fabric Rolls in Work Orders
            WorkOrder.find({
                tenant: tenantObjId,
                'jobOrderDetails.rolls.rollNumber': regex
            })
            .select('workOrderNumber jobOrderDetails.rolls')
            .limit(8)
            .lean()
        ]);

        const results = [];

        // Format Fabric Rolls (deduplicated)
        const seenRolls = new Set();
        (grnRolls || []).forEach((grn) => {
            const allRolls = [...(grn.rolls || []), ...((grn.items || []).flatMap((it) => it.rolls || []))];
            allRolls.forEach((r) => {
                const rNum = String(r.rollNumber || '').trim();
                if (rNum && regex.test(rNum) && !seenRolls.has(rNum.toUpperCase())) {
                    seenRolls.add(rNum.toUpperCase());
                    results.push({
                        id: `roll-${rNum}`,
                        type: 'Fabric Roll',
                        code: rNum,
                        title: `${rNum} — Fabric Roll`,
                        name: `${r.fabricLength || r.length || 0}m Inward Roll (${grn.supplier?.name || 'Inward'})`,
                        subtitle: `GRN: ${grn.grnNumber} • ${r.width || ''}" width • ${r.grossWeight || r.netWeight || 0}kg`,
                        category: 'INVENTORY',
                        url: `/inventory?tab=fabric-rolls&roll=${encodeURIComponent(rNum)}`
                    });
                }
            });
        });

        (woRolls || []).forEach((wo) => {
            (wo.jobOrderDetails?.rolls || []).forEach((r) => {
                const rNum = String(r.rollNumber || r.rollNo || '').trim();
                if (rNum && regex.test(rNum) && !seenRolls.has(rNum.toUpperCase())) {
                    seenRolls.add(rNum.toUpperCase());
                    results.push({
                        id: `roll-${rNum}`,
                        type: 'Fabric Roll',
                        code: rNum,
                        title: `${rNum} — Fabric Roll`,
                        name: `Consumed Roll in WO ${wo.workOrderNumber}`,
                        subtitle: `Allocated to Work Order ${wo.workOrderNumber}`,
                        category: 'INVENTORY',
                        url: `/inventory?tab=fabric-rolls&roll=${encodeURIComponent(rNum)}`
                    });
                }
            });
        });

        // Format Work Orders
        (workOrders || []).forEach((wo) => {
            results.push({
                id: wo._id,
                type: 'Work Order',
                code: wo.workOrderNumber,
                title: `${wo.workOrderNumber} — Work Order`,
                name: `${wo.customer?.companyName || 'Standard Client'} • ${wo.finishedGood?.name || 'Finished Good'}`,
                subtitle: `Target: ${Number(wo.targetQuantity || 0).toLocaleString('en-IN')} Bags • Status: ${wo.status}`,
                category: 'PRODUCTION',
                url: `/production?tab=work-orders&id=${wo._id}`
            });
        });

        // Format Invoices
        (invoices || []).forEach((inv) => {
            results.push({
                id: inv._id,
                type: 'Invoice',
                code: inv.invoiceNumber,
                title: `${inv.invoiceNumber} — Invoice`,
                name: inv.customer?.companyName || 'Customer Invoice',
                subtitle: `Amount: ₹${Number(inv.totalAmount || 0).toLocaleString('en-IN')} • Status: ${inv.status}`,
                category: 'BILLING',
                url: `/sales?tab=invoices&id=${inv._id}`
            });
        });

        // Format Sales Orders
        (salesOrders || []).forEach((so) => {
            results.push({
                id: so._id,
                type: 'Sales Order',
                code: so.soNumber,
                title: `${so.soNumber} — Sales Order`,
                name: so.customer?.companyName || 'Customer Order',
                subtitle: `Total: ₹${Number(so.totalAmount || 0).toLocaleString('en-IN')} • Status: ${so.status}`,
                category: 'SALES',
                url: `/sales?tab=sales-orders&id=${so._id}`
            });
        });

        // Format GRNs / Lot Numbers
        (grns || []).forEach((grn) => {
            const batchOrLot = (grn.items || []).find((it) => it.lotNumber || it.batchNumber);
            const lotText = batchOrLot ? (batchOrLot.lotNumber || batchOrLot.batchNumber) : '';
            results.push({
                id: grn._id,
                type: 'GRN / Lot Number',
                code: grn.grnNumber,
                title: `${grn.grnNumber} — Goods Receipt Note`,
                name: `${grn.supplier?.name || 'Supplier'} ${lotText ? `• Lot #${lotText}` : ''}`,
                subtitle: `Supplier Inv: ${grn.supplierInvoiceNumber || '-'} • Status: ${grn.status}`,
                category: 'PROCUREMENT',
                url: `/procurement?tab=grns&id=${grn._id}`
            });
        });

        // Format Customers (Master Data)
        (customers || []).forEach((c) => {
            const code = c.code || c.customerCode || 'CUST';
            results.push({
                id: c._id,
                type: 'Customer',
                code,
                title: `${code} — ${c.companyName}`,
                name: c.companyName,
                subtitle: `Customer • ${c.city || ''} ${c.state || ''} ${c.gstin ? `• GST: ${c.gstin}` : ''}`.trim(),
                category: 'MASTER_DATA',
                url: `/master-data?tab=customers&id=${c._id}`
            });
        });

        // Format Suppliers (Master Data)
        (suppliers || []).forEach((s) => {
            const code = s.code || s.supplierCode || 'SUP';
            const name = s.name || s.companyName;
            results.push({
                id: s._id,
                type: 'Supplier',
                code,
                title: `${code} — ${name}`,
                name,
                subtitle: `Supplier • ${s.city || ''} ${s.state || ''}`,
                category: 'MASTER_DATA',
                url: `/master-data?tab=suppliers&id=${s._id}`
            });
        });

        // Format Employees (Master Data)
        (employees || []).forEach((emp) => {
            const code = emp.employeeCode || emp.code || 'EMP';
            results.push({
                id: emp._id,
                type: 'Employee',
                code,
                title: `${code} — ${emp.name}`,
                name: emp.name,
                subtitle: `Employee • ${emp.department || ''} - ${emp.designation || ''}`,
                category: 'MASTER_DATA',
                url: `/master-data?tab=employees&id=${emp._id}`
            });
        });

        // Format Machines (Master Data)
        (machines || []).forEach((m) => {
            const code = m.code || m.machineCode || 'MAC';
            results.push({
                id: m._id,
                type: 'Machine',
                code,
                title: `${code} — ${m.name}`,
                name: m.name,
                subtitle: `Machine • Section: ${m.section || '-'} • Status: ${m.status || 'Available'}`,
                category: 'MASTER_DATA',
                url: `/master-data?tab=machines&id=${m._id}`
            });
        });

        // Format Raw Materials (Master Data)
        (rawMaterials || []).forEach((rm) => {
            const code = rm.code || rm.itemCode || 'RM';
            results.push({
                id: rm._id,
                type: 'Raw Material',
                code,
                title: `${code} — ${rm.name}`,
                name: rm.name,
                subtitle: `Raw Material • Stock: ${Number(rm.currentStock || 0).toLocaleString('en-IN')}`,
                category: 'MASTER_DATA',
                url: `/master-data?tab=raw-materials&id=${rm._id}`
            });
        });

        // Format Finished Goods (Master Data)
        (finishedGoods || []).forEach((fg) => {
            const code = fg.code || fg.itemCode || 'FG';
            results.push({
                id: fg._id,
                type: 'Finished Bag',
                code,
                title: `${code} — ${fg.name}`,
                name: fg.name,
                subtitle: `Finished Good • Stock: ${Number(fg.currentStock || 0).toLocaleString('en-IN')} Bags`,
                category: 'MASTER_DATA',
                url: `/master-data?tab=finished-goods&id=${fg._id}`
            });
        });

        // Sort results: exact code match first, then starts-with, then others
        const lowerQ = q.toLowerCase();
        results.sort((a, b) => {
            const aCodeExact = (a.code || '').toLowerCase() === lowerQ;
            const bCodeExact = (b.code || '').toLowerCase() === lowerQ;
            if (aCodeExact && !bCodeExact) return -1;
            if (!aCodeExact && bCodeExact) return 1;

            const aCodeStarts = (a.code || '').toLowerCase().startsWith(lowerQ);
            const bCodeStarts = (b.code || '').toLowerCase().startsWith(lowerQ);
            if (aCodeStarts && !bCodeStarts) return -1;
            if (!aCodeStarts && bCodeStarts) return 1;

            return 0;
        });

        return res.status(200).json({
            success: true,
            totalMatches: results.length,
            data: results
        });
    } catch (error) {
        console.error('Error in globalSearch:', error);
        return res.status(500).json({
            success: false,
            message: 'Global search execution failed.',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardSummary,
    globalSearch
};
