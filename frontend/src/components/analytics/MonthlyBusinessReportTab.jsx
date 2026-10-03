import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    ShoppingBag,
    Layers,
    Package,
    Download,
    Printer,
    RefreshCw,
    Search,
    FileSpreadsheet,
    Calendar
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { generatePdfReport } from '../../utils/pdfExportUtils';

const escapeCsvCell = (val) => {
    if (val === undefined || val === null) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
};

const formatCsvDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const istTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (5.5 * 3600000));
    const day = String(istTime.getDate()).padStart(2, '0');
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const year = istTime.getFullYear();
    return `${day}/${month}/${year}`;
};

const getTodayDdMmYyyy = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const formatCardCurrency = (val) => {
    const num = Number(val) || 0;
    if (num === 0) return '₹0';
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (abs >= 10000000) {
        const cr = abs / 10000000;
        return `${sign}₹${cr.toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
        const l = abs / 100000;
        return `${sign}₹${l.toFixed(2)} L`;
    }
    return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatTableCurrency = (val) => {
    const num = Number(val) || 0;
    if (num === 0) return '₹0';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const MonthlyBusinessReportTab = forwardRef(function MonthlyBusinessReportTab(props, ref) {
    // Current IST Date resolution
    const getIstCurrentDate = () => {
        const now = new Date();
        const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 3600000));
        return {
            year: istTime.getFullYear(),
            month: istTime.getMonth() + 1
        };
    };

    const currentIst = getIstCurrentDate();
    const [selectedMonth, setSelectedMonth] = useState(currentIst.month);
    const [selectedYear, setSelectedYear] = useState(currentIst.year);
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Search filters for tables
    const [salesSearch, setSalesSearch] = useState('');
    const [purchaseSearch, setPurchaseSearch] = useState('');

    const monthsList = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    const yearOptions = Array.from({ length: 6 }, (_, i) => currentIst.year - i);

    const monthLabel = monthsList.find((m) => m.value === selectedMonth)?.label || 'Month';
    const periodLabel = `${monthLabel} ${selectedYear}`;

    const fetchReport = async () => {
        try {
            setIsLoading(true);
            const res = await axiosInstance.get('/analytics/monthly-report', {
                params: {
                    month: selectedMonth,
                    year: selectedYear
                }
            });
            if (res.data?.success) {
                setData(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching monthly business report:', error);
            const errDetail = error.response?.data?.message || 'Failed to load monthly business report.';
            toast.error(errDetail);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedMonth, selectedYear]);

    const summary = data?.summary || {
        totalSalesValue: 0,
        totalPurchaseValue: 0,
        totalBagsSold: 0,
        totalRawMaterialPurchasedKg: 0,
        netProductionBags: 0,
        grossMargin: 0,
        grossMarginPercent: 0
    };

    const salesDetails = data?.salesDetails || [];
    const purchaseDetails = data?.purchaseDetails || [];
    const productionSummary = data?.productionSummary || [];

    // Filtered lists for display
    const filteredSales = salesDetails.filter((s) => {
        if (!salesSearch.trim()) return true;
        const q = salesSearch.toLowerCase();
        return (
            (s.docNumber && s.docNumber.toLowerCase().includes(q)) ||
            (s.customerName && s.customerName.toLowerCase().includes(q)) ||
            (s.itemName && s.itemName.toLowerCase().includes(q))
        );
    });

    const filteredPurchases = purchaseDetails.filter((p) => {
        if (!purchaseSearch.trim()) return true;
        const q = purchaseSearch.toLowerCase();
        return (
            (p.docNumber && p.docNumber.toLowerCase().includes(q)) ||
            (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
            (p.itemName && p.itemName.toLowerCase().includes(q))
        );
    });

    // 1. Export Mini Sales CSV
    const exportSalesCsv = () => {
        const filename = `sales-report-${String(selectedMonth).padStart(2, '0')}-${selectedYear}.csv`;
        const csvLines = [
            [escapeCsvCell(`SALES REGISTER - ${periodLabel.toUpperCase()}`)],
            [escapeCsvCell('Generated Date'), escapeCsvCell(getTodayDdMmYyyy())],
            [escapeCsvCell('Total Sales Value (INR)'), escapeCsvCell(`₹${Number(summary.totalSalesValue || 0).toLocaleString('en-IN')}`)],
            [escapeCsvCell('Total Bags Sold'), escapeCsvCell(Number(summary.totalBagsSold || 0).toLocaleString('en-IN'))],
            [],
            [
                escapeCsvCell('Invoice / SO No'),
                escapeCsvCell('Date'),
                escapeCsvCell('Customer Name'),
                escapeCsvCell('Item Description'),
                escapeCsvCell('Quantity (Bags)'),
                escapeCsvCell('Rate (INR)'),
                escapeCsvCell('Total Value (INR)'),
                escapeCsvCell('Status')
            ]
        ];

        if (salesDetails.length === 0) {
            csvLines.push([escapeCsvCell('No sales invoices found for selected month')]);
        } else {
            salesDetails.forEach((s) => {
                csvLines.push([
                    escapeCsvCell(s.docNumber || s.invoiceNumber || '-'),
                    escapeCsvCell(formatCsvDate(s.date)),
                    escapeCsvCell(s.customerName || '-'),
                    escapeCsvCell(s.itemName || '-'),
                    escapeCsvCell(Number(s.quantity || 0).toLocaleString('en-IN')),
                    escapeCsvCell(`₹${Number(s.rate || 0).toFixed(2)}`),
                    escapeCsvCell(`₹${Number(s.totalValue || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(s.status || 'FINALIZED')
                ]);
            });
        }

        const csvContent = '\uFEFF' + csvLines.map((line) => line.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success(`Sales register for ${periodLabel} exported!`);
    };

    // 2. Export Mini Purchases CSV
    const exportPurchasesCsv = () => {
        const filename = `purchases-report-${String(selectedMonth).padStart(2, '0')}-${selectedYear}.csv`;
        const csvLines = [
            [escapeCsvCell(`PURCHASE REGISTER - ${periodLabel.toUpperCase()}`)],
            [escapeCsvCell('Generated Date'), escapeCsvCell(getTodayDdMmYyyy())],
            [escapeCsvCell('Total Purchase Value (INR)'), escapeCsvCell(`₹${Number(summary.totalPurchaseValue || 0).toLocaleString('en-IN')}`)],
            [escapeCsvCell('Total Raw Material Purchased (Kg)'), escapeCsvCell(Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN'))],
            [],
            [
                escapeCsvCell('PO / GRN No'),
                escapeCsvCell('Date'),
                escapeCsvCell('Supplier Name'),
                escapeCsvCell('Material Description'),
                escapeCsvCell('Quantity'),
                escapeCsvCell('Unit'),
                escapeCsvCell('Rate (INR)'),
                escapeCsvCell('Total Value (INR)'),
                escapeCsvCell('Status')
            ]
        ];

        if (purchaseDetails.length === 0) {
            csvLines.push([escapeCsvCell('No purchase orders found for selected month')]);
        } else {
            purchaseDetails.forEach((p) => {
                csvLines.push([
                    escapeCsvCell(p.docNumber || p.poNumber || '-'),
                    escapeCsvCell(formatCsvDate(p.date)),
                    escapeCsvCell(p.supplierName || '-'),
                    escapeCsvCell(p.itemName || '-'),
                    escapeCsvCell(Number(p.quantity || 0).toLocaleString('en-IN')),
                    escapeCsvCell(p.unit || 'Kg'),
                    escapeCsvCell(`₹${Number(p.rate || 0).toFixed(2)}`),
                    escapeCsvCell(`₹${Number(p.totalValue || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(p.status || 'CONFIRMED')
                ]);
            });
        }

        const csvContent = '\uFEFF' + csvLines.map((line) => line.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success(`Purchase register for ${periodLabel} exported!`);
    };

    // 3. Export Full Combined Monthly Report CSV
    const exportFullReport = () => {
        const monthNumStr = String(selectedMonth).padStart(2, '0');
        const filename = `monthly-report-${monthNumStr}-${selectedYear}.csv`;

        const csvLines = [
            [escapeCsvCell(`CONSOLIDATED MONTHLY BUSINESS REPORT - ${periodLabel.toUpperCase()}`)],
            [escapeCsvCell('Generated Date'), escapeCsvCell(getTodayDdMmYyyy())],
            [escapeCsvCell('Report Period'), escapeCsvCell(periodLabel)],
            [],
            [escapeCsvCell('=== 1. EXECUTIVE SUMMARY KPI CARDS ===')],
            [escapeCsvCell('Metric'), escapeCsvCell('Amount / Qty'), escapeCsvCell('Unit / Details')],
            [escapeCsvCell('Total Sales Value'), escapeCsvCell(`₹${Number(summary.totalSalesValue || 0).toLocaleString('en-IN')}`), escapeCsvCell('INR (Excl. Cancelled/Draft Invoices)')],
            [escapeCsvCell('Total Purchase Value'), escapeCsvCell(`₹${Number(summary.totalPurchaseValue || 0).toLocaleString('en-IN')}`), escapeCsvCell('INR (Excl. Cancelled/Draft POs)')],
            [escapeCsvCell('Gross Margin Estimate'), escapeCsvCell(`₹${Number(summary.grossMargin || 0).toLocaleString('en-IN')}`), escapeCsvCell(`Margin: ${summary.grossMarginPercent}% of Sales`)],
            [escapeCsvCell('Total Bags Sold'), escapeCsvCell(Number(summary.totalBagsSold || 0).toLocaleString('en-IN')), escapeCsvCell('Bags')],
            [escapeCsvCell('Total Raw Material Purchased'), escapeCsvCell(Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')), escapeCsvCell('Kg')],
            [escapeCsvCell('Net Production Output'), escapeCsvCell(Number(summary.netProductionBags || 0).toLocaleString('en-IN')), escapeCsvCell('Bags (Final Stage Baling & Packing)')],
            [],
            [escapeCsvCell('=== 2. SALES DETAIL REGISTER ===')],
            [
                escapeCsvCell('Invoice / SO No'),
                escapeCsvCell('Date'),
                escapeCsvCell('Customer Name'),
                escapeCsvCell('Item Description'),
                escapeCsvCell('Quantity (Bags)'),
                escapeCsvCell('Rate (INR)'),
                escapeCsvCell('Total Value (INR)'),
                escapeCsvCell('Status')
            ]
        ];

        if (salesDetails.length === 0) {
            csvLines.push([escapeCsvCell('No sales recorded for this period')]);
        } else {
            salesDetails.forEach((s) => {
                csvLines.push([
                    escapeCsvCell(s.docNumber || s.invoiceNumber || '-'),
                    escapeCsvCell(formatCsvDate(s.date)),
                    escapeCsvCell(s.customerName || '-'),
                    escapeCsvCell(s.itemName || '-'),
                    escapeCsvCell(Number(s.quantity || 0).toLocaleString('en-IN')),
                    escapeCsvCell(`₹${Number(s.rate || 0).toFixed(2)}`),
                    escapeCsvCell(`₹${Number(s.totalValue || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(s.status || 'FINALIZED')
                ]);
            });
        }

        csvLines.push([]);
        csvLines.push([escapeCsvCell('=== 3. PURCHASE DETAIL REGISTER ===')]);
        csvLines.push([
            escapeCsvCell('PO / GRN No'),
            escapeCsvCell('Date'),
            escapeCsvCell('Supplier Name'),
            escapeCsvCell('Material Description'),
            escapeCsvCell('Quantity'),
            escapeCsvCell('Unit'),
            escapeCsvCell('Rate (INR)'),
            escapeCsvCell('Total Value (INR)'),
            escapeCsvCell('Status')
        ]);

        if (purchaseDetails.length === 0) {
            csvLines.push([escapeCsvCell('No purchases recorded for this period')]);
        } else {
            purchaseDetails.forEach((p) => {
                csvLines.push([
                    escapeCsvCell(p.docNumber || p.poNumber || '-'),
                    escapeCsvCell(formatCsvDate(p.date)),
                    escapeCsvCell(p.supplierName || '-'),
                    escapeCsvCell(p.itemName || '-'),
                    escapeCsvCell(Number(p.quantity || 0).toLocaleString('en-IN')),
                    escapeCsvCell(p.unit || 'Kg'),
                    escapeCsvCell(`₹${Number(p.rate || 0).toFixed(2)}`),
                    escapeCsvCell(`₹${Number(p.totalValue || 0).toLocaleString('en-IN')}`),
                    escapeCsvCell(p.status || 'CONFIRMED')
                ]);
            });
        }

        csvLines.push([]);
        csvLines.push([escapeCsvCell('=== 4. PRODUCTION SUMMARY BY WORK ORDER ===')]);
        csvLines.push([
            escapeCsvCell('Work Order No'),
            escapeCsvCell('Customer Name'),
            escapeCsvCell('Product / Finished Good'),
            escapeCsvCell('Target Quantity (Bags)'),
            escapeCsvCell('Final Bags Produced'),
            escapeCsvCell('Status')
        ]);

        if (productionSummary.length === 0) {
            csvLines.push([escapeCsvCell('No active work orders found for this period')]);
        } else {
            productionSummary.forEach((w) => {
                csvLines.push([
                    escapeCsvCell(w.workOrderNumber || '-'),
                    escapeCsvCell(w.customerName || '-'),
                    escapeCsvCell(w.product?.specification || w.product?.name || w.finishedGood?.specification || w.finishedGood?.name || w.productName || w.finishedGoodName || '-'),
                    escapeCsvCell(Number(w.targetQuantity || 0).toLocaleString('en-IN')),
                    escapeCsvCell(Number(w.completedQuantity || w.completedBags || w.producedQuantity || w.producedQty || w.bagsProduced || 0).toLocaleString('en-IN')),
                    escapeCsvCell(w.status || '-')
                ]);
            });
        }

        const csvContent = '\uFEFF' + csvLines.map((line) => line.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success(`Full Monthly Report (${filename}) exported successfully!`);
    };

    // 4. Export Mini Sales PDF
    const exportSalesPdf = () => {
        const filename = `sales-report-${String(selectedMonth).padStart(2, '0')}-${selectedYear}.pdf`;
        generatePdfReport({
            title: `Sales Register (${periodLabel})`,
            subtitle: `Generated: ${getTodayDdMmYyyy()}`,
            generatedDate: getTodayDdMmYyyy(),
            filename,
            summaryCards: [
                { label: 'Total Sales Value', value: `₹${Number(summary.totalSalesValue || 0).toLocaleString('en-IN')}`, notes: 'Monthly Sales Total' },
                { label: 'Total Bags Sold', value: `${Number(summary.totalBagsSold || 0).toLocaleString('en-IN')} Bags`, notes: 'Quantity Shipped' }
            ],
            sections: [
                {
                    title: 'SALES INVOICES & ORDERS',
                    headers: ['Invoice / SO No', 'Date', 'Customer Name', 'Item Description', 'Qty (Bags)', 'Rate (₹)', 'Total Value (₹)', 'Status'],
                    rows: salesDetails.map((s) => [
                        s.docNumber || s.invoiceNumber || '-',
                        formatDateDisplay(s.date),
                        s.customerName || '-',
                        s.itemName || '-',
                        Number(s.quantity || 0).toLocaleString('en-IN'),
                        `₹${Number(s.rate || 0).toFixed(2)}`,
                        `₹${Number(s.totalValue || 0).toLocaleString('en-IN')}`,
                        s.status || 'FINALIZED'
                    ])
                }
            ]
        });
        toast.success(`Sales register PDF for ${periodLabel} exported!`);
    };

    // 5. Export Mini Purchases PDF
    const exportPurchasesPdf = () => {
        const filename = `purchases-report-${String(selectedMonth).padStart(2, '0')}-${selectedYear}.pdf`;
        generatePdfReport({
            title: `Purchase Register (${periodLabel})`,
            subtitle: `Generated: ${getTodayDdMmYyyy()}`,
            generatedDate: getTodayDdMmYyyy(),
            filename,
            summaryCards: [
                { label: 'Total Purchase Value', value: `₹${Number(summary.totalPurchaseValue || 0).toLocaleString('en-IN')}`, notes: 'Monthly Purchase Total' },
                { label: 'Raw Material Bought', value: `${Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')} Kg`, notes: 'Total Material Weight' }
            ],
            sections: [
                {
                    title: 'PURCHASE ORDERS & RECEIPTS',
                    headers: ['PO / GRN No', 'Date', 'Supplier Name', 'Material Description', 'Quantity', 'Unit', 'Rate (₹)', 'Total Value (₹)', 'Status'],
                    rows: purchaseDetails.map((p) => [
                        p.docNumber || p.poNumber || '-',
                        formatDateDisplay(p.date),
                        p.supplierName || '-',
                        p.itemName || '-',
                        Number(p.quantity || 0).toLocaleString('en-IN'),
                        p.unit || 'Kg',
                        `₹${Number(p.rate || 0).toFixed(2)}`,
                        `₹${Number(p.totalValue || 0).toLocaleString('en-IN')}`,
                        p.status || 'CONFIRMED'
                    ])
                }
            ]
        });
        toast.success(`Purchase register PDF for ${periodLabel} exported!`);
    };

    // 6. Export Full Consolidated Monthly Report PDF
    const exportFullReportPdf = () => {
        const monthNumStr = String(selectedMonth).padStart(2, '0');
        const filename = `monthly-report-${monthNumStr}-${selectedYear}.pdf`;

        generatePdfReport({
            title: `Monthly Business Report (${periodLabel})`,
            subtitle: `Period: ${periodLabel}`,
            generatedDate: getTodayDdMmYyyy(),
            filename,
            summaryCards: [
                { label: 'Total Sales', value: `₹${Number(summary.totalSalesValue || 0).toLocaleString('en-IN')}`, notes: `${Number(summary.totalBagsSold || 0).toLocaleString('en-IN')} Bags Sold` },
                { label: 'Total Purchases', value: `₹${Number(summary.totalPurchaseValue || 0).toLocaleString('en-IN')}`, notes: `${Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')} Kg Material` },
                { label: 'Gross Margin', value: `₹${Number(summary.grossMargin || 0).toLocaleString('en-IN')}`, notes: `${summary.grossMarginPercent}% of Sales` },
                { label: 'Total Bags Sold', value: `${Number(summary.totalBagsSold || 0).toLocaleString('en-IN')} Bags`, notes: 'Finished bags' },
                { label: 'Raw Material Bought', value: `${Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')} Kg`, notes: 'PP/HDPE & Inward RM' },
                { label: 'Net Production', value: `${Number(summary.netProductionBags || 0).toLocaleString('en-IN')} Bags`, notes: 'Baling & Packing complete' }
            ],
            sections: [
                {
                    title: '1. SALES DETAIL REGISTER',
                    subtitle: `Total Sales Value: ₹${Number(summary.totalSalesValue || 0).toLocaleString('en-IN')}`,
                    headers: ['Invoice / SO No', 'Date', 'Customer Name', 'Item Description', 'Qty (Bags)', 'Rate (₹)', 'Total Value (₹)', 'Status'],
                    rows: salesDetails.map((s) => [
                        s.docNumber || s.invoiceNumber || '-',
                        formatDateDisplay(s.date),
                        s.customerName || '-',
                        s.itemName || '-',
                        Number(s.quantity || 0).toLocaleString('en-IN'),
                        `₹${Number(s.rate || 0).toFixed(2)}`,
                        `₹${Number(s.totalValue || 0).toLocaleString('en-IN')}`,
                        s.status || 'FINALIZED'
                    ])
                },
                {
                    title: '2. PURCHASE DETAIL REGISTER',
                    subtitle: `Total Purchase Value: ₹${Number(summary.totalPurchaseValue || 0).toLocaleString('en-IN')}`,
                    headers: ['PO / GRN No', 'Date', 'Supplier Name', 'Material Description', 'Quantity', 'Unit', 'Rate (₹)', 'Total Value (₹)', 'Status'],
                    rows: purchaseDetails.map((p) => [
                        p.docNumber || p.poNumber || '-',
                        formatDateDisplay(p.date),
                        p.supplierName || '-',
                        p.itemName || '-',
                        Number(p.quantity || 0).toLocaleString('en-IN'),
                        p.unit || 'Kg',
                        `₹${Number(p.rate || 0).toFixed(2)}`,
                        `₹${Number(p.totalValue || 0).toLocaleString('en-IN')}`,
                        p.status || 'CONFIRMED'
                    ])
                },
                {
                    title: '3. PRODUCTION SUMMARY BY WORK ORDER',
                    headers: ['Work Order No', 'Customer Name', 'Product / Finished Good', 'Target Qty', 'Produced Qty', 'Status'],
                    rows: productionSummary.map((w) => [
                        w.workOrderNumber || '-',
                        w.customerName || '-',
                        w.product?.specification || w.product?.name || w.finishedGood?.specification || w.finishedGood?.name || w.productName || w.finishedGoodName || '-',
                        Number(w.targetQuantity || 0).toLocaleString('en-IN'),
                        Number(w.completedQuantity || w.completedBags || w.producedQuantity || w.producedQty || w.bagsProduced || 0).toLocaleString('en-IN'),
                        w.status || 'COMPLETED'
                    ])
                }
            ]
        });
        toast.success(`Full Monthly Report PDF (${filename}) generated!`);
    };

    useImperativeHandle(ref, () => ({
        exportCsv: exportFullReport,
        exportPdf: exportFullReportPdf
    }));

    return (
        <div className="space-y-6">
            {/* Header / Month-Year Selector Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card-bg p-4 rounded-xl border border-border shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-extrabold text-text-main tracking-tight uppercase">
                            Monthly Business Report: {periodLabel}
                        </h2>
                        <p className="text-xs text-text-muted">
                            Consolidated sales, procurement, production output and gross margin audit
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Month Selector */}
                    <div className="flex items-center gap-1.5 bg-app-bg border border-border px-3 py-1.5 rounded-lg shadow-xs">
                        <Calendar size={14} className="text-text-muted" />
                        <span className="text-[10px] font-bold text-text-muted uppercase">Month:</span>
                        <select
                            id="monthly-report-month-selector"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent text-text-main text-xs font-extrabold focus:outline-none cursor-pointer"
                        >
                            {monthsList.map((m) => (
                                <option key={m.value} value={m.value} className="bg-card-bg text-text-main">
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-1.5 bg-app-bg border border-border px-3 py-1.5 rounded-lg shadow-xs">
                        <span className="text-[10px] font-bold text-text-muted uppercase">Year:</span>
                        <select
                            id="monthly-report-year-selector"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-text-main text-xs font-extrabold focus:outline-none cursor-pointer"
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y} className="bg-card-bg text-text-main">
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchReport}
                        disabled={isLoading}
                        className="p-2 bg-app-bg hover:bg-border/60 text-text-muted hover:text-text-main border border-border rounded-lg transition-colors cursor-pointer"
                        title="Refresh Report Data"
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin text-amber-500' : ''} />
                    </button>

                    {/* Export Full Monthly Report CSV & PDF Buttons */}
                    <button
                        type="button"
                        onClick={exportFullReport}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-card-bg hover:bg-app-bg text-text-main font-bold border border-border rounded-lg text-xs transition-all shadow-xs cursor-pointer ml-auto sm:ml-0"
                        title="Export Full Monthly Report (CSV)"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={exportFullReportPdf}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                        title="Export Full Monthly Report (PDF)"
                    >
                        <Printer size={14} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {/* 1. Total Sales Value */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Sales</span>
                        <DollarSign size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-lg font-extrabold text-emerald-500 font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.totalSalesValue)}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 font-semibold">
                        {isLoading ? '' : `${Number(summary.totalBagsSold || 0).toLocaleString('en-IN')} Bags Sold`}
                    </div>
                </div>

                {/* 2. Total Purchase Value */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Purchases</span>
                        <ShoppingCart size={16} className="text-blue-500" />
                    </div>
                    <div className="text-lg font-extrabold text-blue-500 font-mono">
                        {isLoading ? '...' : formatCardCurrency(summary.totalPurchaseValue)}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 font-semibold">
                        {isLoading ? '' : `${Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')} Kg Inward`}
                    </div>
                </div>

                {/* 3. Gross Margin Estimate */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Gross Margin</span>
                        {summary.grossMargin >= 0 ? (
                            <TrendingUp size={16} className="text-amber-500" />
                        ) : (
                            <TrendingDown size={16} className="text-rose-500" />
                        )}
                    </div>
                    <div className={`text-lg font-extrabold font-mono ${summary.grossMargin >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {isLoading ? '...' : formatCardCurrency(summary.grossMargin)}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1 font-semibold">
                        {isLoading ? '' : `${summary.grossMarginPercent}% of Turnover`}
                    </div>
                </div>

                {/* 4. Total Bags Sold */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Bags Sold</span>
                        <ShoppingBag size={16} className="text-purple-500" />
                    </div>
                    <div className="text-lg font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : Number(summary.totalBagsSold || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                        Outward Dispatches
                    </div>
                </div>

                {/* 5. Total Raw Material Purchased */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">RM Purchased</span>
                        <Layers size={16} className="text-cyan-500" />
                    </div>
                    <div className="text-lg font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : `${Number(summary.totalRawMaterialPurchasedKg || 0).toLocaleString('en-IN')} Kg`}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                        Raw Material Inward
                    </div>
                </div>

                {/* 6. Net Production Output */}
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Net Production</span>
                        <Package size={16} className="text-amber-500" />
                    </div>
                    <div className="text-lg font-extrabold text-amber-500 font-mono">
                        {isLoading ? '...' : `${Number(summary.netProductionBags || 0).toLocaleString('en-IN')} Bags`}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                        Final Stage (Baling & Packing)
                    </div>
                </div>
            </div>

            {/* Sales Detail Table */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            Sales Detail Register ({salesDetails.length} Items)
                        </h3>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        {/* Search Filter */}
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search customer, invoice, item..."
                                value={salesSearch}
                                onChange={(e) => setSalesSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-card-bg border border-border rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Mini Sales CSV Export */}
                        {/* Mini Sales CSV & PDF Export */}
                        <button
                            type="button"
                            onClick={exportSalesCsv}
                            disabled={salesDetails.length === 0}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                            title="Export Sales CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={exportSalesPdf}
                            disabled={salesDetails.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                            title="Export Sales PDF"
                        >
                            <Printer size={13} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Invoice / SO No</th>
                                <th className="p-3 border-b border-border">Date</th>
                                <th className="p-3 border-b border-border">Customer Name</th>
                                <th className="p-3 border-b border-border">Item Description</th>
                                <th className="p-3 border-b border-border text-right font-mono">Qty (Bags)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Rate (₹)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Total Value</th>
                                <th className="p-3 border-b border-border text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-muted">
                                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs font-semibold">Loading sales register...</p>
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-muted">
                                        <ShoppingBag size={28} className="mx-auto mb-2 opacity-40 text-emerald-500" />
                                        <p className="font-semibold text-xs">No sales records found for this month</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((row, idx) => (
                                    <tr key={`${row.invoiceId}_${idx}`} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold font-mono text-text-main">{row.docNumber || row.invoiceNumber}</td>
                                        <td className="p-3 text-text-muted">{formatDateDisplay(row.date)}</td>
                                        <td className="p-3 font-semibold text-text-main">{row.customerName}</td>
                                        <td className="p-3 text-text-muted">{row.itemName}</td>
                                        <td className="p-3 text-right font-mono font-bold text-text-main">
                                            {Number(row.quantity || 0).toLocaleString('en-IN')}
                                        </td>
                                        <td className="p-3 text-right font-mono text-text-muted">
                                            ₹{Number(row.rate || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right font-mono font-extrabold text-emerald-500">
                                            {formatTableCurrency(row.totalValue)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                {row.status || 'FINALIZED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!isLoading && filteredSales.length > 0 && (
                            <tfoot>
                                <tr className="bg-app-bg/80 font-extrabold text-text-main border-t border-border">
                                    <td colSpan={4} className="p-3 text-right text-[11px] uppercase">
                                        Total Sales ({filteredSales.length} items):
                                    </td>
                                    <td className="p-3 text-right font-mono text-amber-500">
                                        {filteredSales.reduce((sum, r) => sum + Number(r.quantity || 0), 0).toLocaleString('en-IN')} Bags
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-muted">-</td>
                                    <td className="p-3 text-right font-mono text-emerald-500 text-sm">
                                        {formatTableCurrency(filteredSales.reduce((sum, r) => sum + Number(r.totalValue || 0), 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Purchase Detail Table */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            Purchase Detail Register ({purchaseDetails.length} Items)
                        </h3>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        {/* Search Filter */}
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search supplier, PO/GRN, material..."
                                value={purchaseSearch}
                                onChange={(e) => setPurchaseSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-card-bg border border-border rounded-lg text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Mini Purchases CSV & PDF Export */}
                        <button
                            type="button"
                            onClick={exportPurchasesCsv}
                            disabled={purchaseDetails.length === 0}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                            title="Export Purchases CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={exportPurchasesPdf}
                            disabled={purchaseDetails.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                            title="Export Purchases PDF"
                        >
                            <Printer size={13} />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">PO / GRN No</th>
                                <th className="p-3 border-b border-border">Date</th>
                                <th className="p-3 border-b border-border">Supplier Name</th>
                                <th className="p-3 border-b border-border">Material Description</th>
                                <th className="p-3 border-b border-border text-right font-mono">Qty</th>
                                <th className="p-3 border-b border-border text-right font-mono">Rate (₹)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Total Value</th>
                                <th className="p-3 border-b border-border text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-muted">
                                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs font-semibold">Loading purchase register...</p>
                                    </td>
                                </tr>
                            ) : filteredPurchases.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-text-muted">
                                        <ShoppingCart size={28} className="mx-auto mb-2 opacity-40 text-blue-500" />
                                        <p className="font-semibold text-xs">No purchase records found for this month</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPurchases.map((row, idx) => (
                                    <tr key={`${row.poId}_${idx}`} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold font-mono text-text-main">{row.docNumber || row.poNumber}</td>
                                        <td className="p-3 text-text-muted">{formatDateDisplay(row.date)}</td>
                                        <td className="p-3 font-semibold text-text-main">{row.supplierName}</td>
                                        <td className="p-3 text-text-muted">{row.itemName}</td>
                                        <td className="p-3 text-right font-mono font-bold text-text-main">
                                            {Number(row.quantity || 0).toLocaleString('en-IN')} {row.unit || 'Kg'}
                                        </td>
                                        <td className="p-3 text-right font-mono text-text-muted">
                                            ₹{Number(row.rate || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right font-mono font-extrabold text-blue-500">
                                            {formatTableCurrency(row.totalValue)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                {row.status || 'CONFIRMED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!isLoading && filteredPurchases.length > 0 && (
                            <tfoot>
                                <tr className="bg-app-bg/80 font-extrabold text-text-main border-t border-border">
                                    <td colSpan={4} className="p-3 text-right text-[11px] uppercase">
                                        Total Purchases ({filteredPurchases.length} items):
                                    </td>
                                    <td className="p-3 text-right font-mono text-amber-500">
                                        {filteredPurchases.reduce((sum, r) => sum + Number(r.quantity || 0), 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-muted">-</td>
                                    <td className="p-3 text-right font-mono text-blue-500 text-sm">
                                        {formatTableCurrency(filteredPurchases.reduce((sum, r) => sum + Number(r.totalValue || 0), 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Production Summary Breakdown by Work Order */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            Production Summary Breakdown ({productionSummary.length} Work Orders)
                        </h3>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-amber-500">
                        Total Final Output: {Number(summary.netProductionBags || 0).toLocaleString('en-IN')} Bags
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Work Order No</th>
                                <th className="p-3 border-b border-border">Customer</th>
                                <th className="p-3 border-b border-border">Finished Good / Product</th>
                                <th className="p-3 border-b border-border text-right font-mono">Target Qty</th>
                                <th className="p-3 border-b border-border text-right font-mono">Final Bags Produced</th>
                                <th className="p-3 border-b border-border text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs font-semibold">Loading production summary...</p>
                                    </td>
                                </tr>
                            ) : productionSummary.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <Package size={28} className="mx-auto mb-2 opacity-40 text-amber-500" />
                                        <p className="font-semibold text-xs">No production records found for this month</p>
                                    </td>
                                </tr>
                            ) : (
                                productionSummary.map((wo, idx) => (
                                    <tr key={wo.workOrderId || idx} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold font-mono text-text-main">{wo.workOrderNumber}</td>
                                        <td className="p-3 text-text-muted">{wo.customerName}</td>
                                        <td className="p-3 font-semibold text-text-main">
                                            {wo.product?.specification || wo.product?.name || wo.finishedGood?.specification || wo.finishedGood?.name || wo.productName || wo.finishedGoodName || '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono text-text-muted">
                                            {Number(wo.targetQuantity || 0).toLocaleString('en-IN')} {wo.unit || 'Bags'}
                                        </td>
                                        <td className="p-3 text-right font-mono font-extrabold text-amber-500">
                                            {Number(wo.completedQuantity || wo.completedBags || wo.producedQuantity || wo.producedQty || wo.bagsProduced || 0).toLocaleString('en-IN')} {wo.unit || 'Bags'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                {wo.status || 'IN_PROGRESS'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!isLoading && productionSummary.length > 0 && (
                            <tfoot>
                                <tr className="bg-app-bg/80 font-extrabold text-text-main border-t border-border">
                                    <td colSpan={3} className="p-3 text-right text-[11px] uppercase">
                                        Total Monthly Output:
                                    </td>
                                    <td className="p-3 text-right font-mono text-text-muted">
                                        {productionSummary.reduce((sum, w) => sum + Number(w.targetQuantity || 0), 0).toLocaleString('en-IN')} Bags
                                    </td>
                                    <td className="p-3 text-right font-mono text-amber-500 text-sm">
                                        {Number(summary.netProductionBags || 0).toLocaleString('en-IN')} Bags
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
});

export default MonthlyBusinessReportTab;
