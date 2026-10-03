import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Package, Layers, Boxes, ShieldAlert, Loader2, RefreshCw, Download, Printer } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { generatePdfReport } from '../../utils/pdfExportUtils';

const escapeCsvCell = (val) => {
    if (val === undefined || val === null) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
};

const getTodayDdMmYyyy = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const InventoryValuationTab = forwardRef(function InventoryValuationTab(props, ref) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchValuationData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await axiosInstance.get('/analytics/inventory-valuation');
            if (res.data?.success) {
                setData(res.data.data);
            } else {
                setError(res.data?.message || 'Failed to load valuation data');
            }
        } catch (err) {
            console.error('Error fetching inventory valuation:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load inventory valuation');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchValuationData();
    }, []);

    // Format currency in Indian style for KPI Cards (₹ Lakh / ₹ Crore)
    const formatCardCurrency = (val) => {
        const num = Number(val) || 0;
        if (num >= 10000000) {
            return `₹${(num / 10000000).toFixed(2)} Cr`;
        }
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} L`;
        }
        return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    };

    // Format currency in full en-IN format for table
    const formatTableCurrency = (val) => {
        const num = Number(val) || 0;
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format bag count subtitle
    const formatBagsCountSubtitle = (count) => {
        const num = Number(count) || 0;
        if (num >= 100000) {
            const inLakhs = (num / 100000).toFixed(1).replace(/\.0$/, '');
            return `${inLakhs} Lakh Finished Bags`;
        }
        return `${num.toLocaleString('en-IN')} Finished Bags`;
    };

    const summary = data?.summary;
    const ledgerList = data?.ledgerList || [];
    const slowMovingVal = summary?.slowMovingValue || 0;

    const exportCsv = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-inventory-valuation-${todayStr}.csv`;

        const csvLines = [
            [escapeCsvCell('EXECUTIVE AUDIT REPORT - INVENTORY VALUATION')],
            [escapeCsvCell('Generated Date'), escapeCsvCell(todayStr)],
            [escapeCsvCell('Valuation Method'), escapeCsvCell('Weighted Average Cost Method')],
            [],
            [escapeCsvCell('--- SUMMARY KPI CARDS ---')],
            [escapeCsvCell('Metric'), escapeCsvCell('Amount (INR)'), escapeCsvCell('Notes')],
            [escapeCsvCell('Total Inventory Asset Value'), escapeCsvCell(`₹${Number(summary?.totalInventoryAssetValue || 0).toLocaleString('en-IN')}`), escapeCsvCell('Audited Asset Valuation')],
            [escapeCsvCell('Raw Material Valuation'), escapeCsvCell(`₹${Number(summary?.rawMaterialValuation || 0).toLocaleString('en-IN')}`), escapeCsvCell(summary?.rawMaterialSubtitle || 'Raw Material Stock')],
            [escapeCsvCell('Finished Bags Valuation'), escapeCsvCell(`₹${Number(summary?.finishedBagsValuation || 0).toLocaleString('en-IN')}`), escapeCsvCell(`${Number(summary?.finishedBagsCount || 0).toLocaleString('en-IN')} Finished Bags`)],
            [escapeCsvCell('Slow Moving Stock Valuation'), escapeCsvCell(`₹${Number(slowMovingVal || 0).toLocaleString('en-IN')}`), escapeCsvCell(slowMovingVal > 0 ? 'Requires Clearance' : 'No slow moving stock')],
            [],
            [escapeCsvCell('--- STOCK ASSET VALUATION LEDGER ---')],
            [
                escapeCsvCell('Stock Item / Name'),
                escapeCsvCell('Stock Code'),
                escapeCsvCell('Item Classification'),
                escapeCsvCell('Current Quantity'),
                escapeCsvCell('Unit'),
                escapeCsvCell('Unit Rate (INR)'),
                escapeCsvCell('Total Valuation (INR)')
            ]
        ];

        if (ledgerList.length === 0) {
            csvLines.push([escapeCsvCell('No stock records found')]);
        } else {
            ledgerList.forEach((r) => {
                csvLines.push([
                    escapeCsvCell(r.name || r.category || '-'),
                    escapeCsvCell(r.code || '-'),
                    escapeCsvCell(r.type || '-'),
                    escapeCsvCell(Number(r.currentQuantity || 0)),
                    escapeCsvCell(r.unit || 'Kg'),
                    escapeCsvCell(Number(r.unitRate || 0)),
                    escapeCsvCell(`₹${Number(r.totalValuation || 0).toLocaleString('en-IN')}`)
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
        toast.success('Inventory Valuation executive audit report exported to CSV!');
    };

    const exportPdf = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-inventory-valuation-${todayStr}.pdf`;

        generatePdfReport({
            title: 'Inventory Valuation Audit Report',
            subtitle: 'Valuation Method: Weighted Average Cost Method',
            generatedDate: todayStr,
            filename,
            summaryCards: [
                { label: 'Total Inventory Asset Value', value: `₹${Number(summary?.totalInventoryAssetValue || 0).toLocaleString('en-IN')}`, notes: 'Audited asset valuation' },
                { label: 'Raw Material Valuation', value: `₹${Number(summary?.rawMaterialValuation || 0).toLocaleString('en-IN')}`, notes: summary?.rawMaterialSubtitle || 'Raw Material Stock' },
                { label: 'Finished Bags Valuation', value: `₹${Number(summary?.finishedBagsValuation || 0).toLocaleString('en-IN')}`, notes: `${Number(summary?.finishedBagsCount || 0).toLocaleString('en-IN')} Finished Bags` },
                { label: 'Slow Moving Stock', value: `₹${Number(slowMovingVal || 0).toLocaleString('en-IN')}`, notes: slowMovingVal > 0 ? 'Requires Clearance' : 'No slow moving stock' }
            ],
            sections: [
                {
                    title: 'STOCK ASSET VALUATION LEDGER (WEIGHTED AVERAGE COST METHOD)',
                    headers: ['Stock Item / Name', 'Stock Code', 'Item Classification', 'Current Quantity', 'Unit', 'Avg Unit Cost (INR)', 'Total Valuation (INR)'],
                    rows: ledgerList.map((item) => [
                        item.name || '-',
                        item.code || '-',
                        item.category || item.type || '-',
                        Number(item.currentStock || 0).toLocaleString('en-IN'),
                        item.uom || 'Kg',
                        `₹${Number(item.valuationRate || item.costPerUnit || 0).toFixed(2)}`,
                        `₹${Number(item.totalValuation || 0).toLocaleString('en-IN')}`
                    ])
                }
            ]
        });
        toast.success('Inventory Valuation audit report exported to PDF!');
    };

    useImperativeHandle(ref, () => ({
        exportCsv,
        exportPdf
    }));

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-card-bg border border-border rounded-xl font-sans">
                <Loader2 className="animate-spin text-primary mb-3" size={28} />
                <p className="text-xs font-semibold text-text-muted">Calculating real-time inventory valuation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-card-bg border border-border rounded-xl text-center font-sans space-y-3">
                <p className="text-xs text-rose-600 font-semibold">{error}</p>
                <button
                    type="button"
                    onClick={fetchValuationData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-sidebar-bg font-bold rounded-lg text-xs cursor-pointer hover:bg-primary-hover"
                >
                    <RefreshCw size={14} />
                    <span>Retry</span>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5 font-sans">
            {/* Top 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Inventory Asset Value */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total Inventory Asset Value</span>
                        <Package size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {formatCardCurrency(summary?.totalInventoryAssetValue)}
                    </div>
                    <div className="text-[10px] text-text-muted">Audited Asset Valuation</div>
                </div>

                {/* Card 2: Raw Material Valuation */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Raw Material Valuation</span>
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {formatCardCurrency(summary?.rawMaterialValuation)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                        {summary?.rawMaterialSubtitle || 'Raw Material Stock'}
                    </div>
                </div>

                {/* Card 3: Finished Bags Valuation */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Finished Bags Valuation</span>
                        <Boxes size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">
                        {formatCardCurrency(summary?.finishedBagsValuation)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">
                        {formatBagsCountSubtitle(summary?.finishedBagsCount)}
                    </div>
                </div>

                {/* Card 4: Slow Moving Stock */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Slow Moving Stock</span>
                        <ShieldAlert size={16} className="text-rose-500" />
                    </div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono">
                        {formatCardCurrency(slowMovingVal)}
                    </div>
                    <div className={slowMovingVal > 0 ? "text-[10px] text-rose-600 font-extrabold" : "text-[10px] text-text-muted font-medium"}>
                        {slowMovingVal > 0 ? 'Requires Clearance' : 'No slow moving stock'}
                    </div>
                </div>
            </div>

            {/* Valuation Ledger Table */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        STOCK ASSET VALUATION LEDGER (WEIGHTED AVERAGE COST METHOD)
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full">
                            • Verified Weighted Average Rates
                        </span>

                        <button
                            type="button"
                            onClick={exportCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                            title="Export Inventory Valuation to CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={exportPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                            title="Export Inventory Valuation to PDF"
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
                                <th className="p-3 border-b border-border">Stock Category</th>
                                <th className="p-3 border-b border-border">Item Classification</th>
                                <th className="p-3 border-b border-border font-mono">Current Quantity</th>
                                <th className="p-3 border-b border-border font-mono">Unit Rate</th>
                                <th className="p-3 border-b border-border font-mono">Total Valuation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {ledgerList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-text-muted text-xs font-semibold">
                                        No stock records found
                                    </td>
                                </tr>
                            ) : (
                                ledgerList.map((r, i) => (
                                    <tr key={r._id || i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold text-text-main">
                                            {r.name || r.category}
                                            {r.code && (
                                                <span className="ml-1.5 text-[10px] font-mono text-text-muted font-normal">
                                                    ({r.code})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                                r.type === 'Finished Goods'
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                    : r.type === 'WIP Fabric Roll'
                                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                            }`}>
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono font-semibold">
                                            {Number(r.currentQuantity || 0).toLocaleString('en-IN')} {r.unit || 'Kg'}
                                        </td>
                                        <td className="p-3 font-mono text-text-muted">
                                            ₹{Number(r.unitRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {r.unit || 'Kg'}
                                        </td>
                                        <td className="p-3 font-mono font-extrabold text-primary">
                                            {formatTableCurrency(r.totalValuation)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default InventoryValuationTab;
