import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Activity, Flame, Layers, Package, TrendingUp, TrendingDown, RefreshCw, Download, Printer, Search, X } from 'lucide-react';
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

const getTodayDdMmYyyy = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const ProductionYieldTab = forwardRef(function ProductionYieldTab(props, ref) {
    const [startDate, setStartDate] = useState(''); // Empty string allows fetching all records
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Default today
    const [tableData, setTableData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMetrics = async () => {
        try {
            setIsLoading(true);
            const params = {};
            if (startDate && startDate.trim()) params.startDate = startDate.trim();
            if (endDate && endDate.trim()) params.endDate = endDate.trim();

            const res = await axiosInstance.get('/analytics/production-yield-metrics', { params });
            if (res.data?.success) {
                setMetrics(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching production yield metrics:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [startDate, endDate]);

    // Update dynamic table data when metrics change
    useEffect(() => {
        const rawWoList = metrics?.tableData || metrics?.kgUsedVsBagsProduced?.tableData || metrics?.kgUsedVsBagsProduced?.groupedByWorkOrder || [];
        setTableData(rawWoList);
    }, [metrics]);

    // Filter table data by search term
    const filteredTableData = tableData.filter((row) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const woNum = String(row.workOrderNumber || '').toLowerCase();
        return woNum.includes(term);
    });

    // Extract metrics with safe defaults
    const todayBags = metrics?.todayVsYesterdayBags?.todayBags ?? metrics?.todayBags ?? 0;
    const yesterdayBags = metrics?.todayVsYesterdayBags?.yesterdayBags ?? metrics?.yesterdayBags ?? 0;
    const changePercent = metrics?.todayVsYesterdayBags?.changePercent ?? 0;
    const availableFabricKg = metrics?.availableKgForBags ?? 0;

    const overall = metrics?.kgUsedVsBagsProduced?.overall;
    const totalWastageKg = overall?.totalWastageKg ?? metrics?.totalWastageKg ?? 0;
    const totalRejects = overall?.totalRejectedBags ?? metrics?.totalRejectedBags ?? 0;
    const totalReturnToStore = overall?.totalReturnToStore ?? 0;

    const exportCsv = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-production-yield-${todayStr}.csv`;

        const csvLines = [
            [escapeCsvCell('EXECUTIVE AUDIT REPORT - PRODUCTION YIELD & SCRAP RECOVERY')],
            [escapeCsvCell('Generated Date'), escapeCsvCell(todayStr)],
            [escapeCsvCell('Date Filter Range'), escapeCsvCell(`From: ${startDate ? formatCsvDate(startDate) : 'All Beginning'} To: ${endDate ? formatCsvDate(endDate) : 'Today'}`)],
            [],
            [escapeCsvCell('--- SUMMARY KPI CARDS ---')],
            [escapeCsvCell('Metric'), escapeCsvCell('Value'), escapeCsvCell('Unit / Notes')],
            [escapeCsvCell('Total Production'), escapeCsvCell(Number(todayBags || 0).toLocaleString('en-IN')), escapeCsvCell('Bags')],
            [escapeCsvCell('Available Raw Fabric'), escapeCsvCell(Number(availableFabricKg || 0).toLocaleString('en-IN')), escapeCsvCell('Kg in stock')],
            [escapeCsvCell('Total Process Scrap'), escapeCsvCell(Number(totalWastageKg || 0).toLocaleString('en-IN')), escapeCsvCell('Kg machine wastage')],
            [escapeCsvCell('Total Rejected Defects'), escapeCsvCell(Number(totalRejects || 0).toLocaleString('en-IN')), escapeCsvCell('Bags rejected')],
            [escapeCsvCell('Material Returned to Store'), escapeCsvCell(Number(totalReturnToStore || 0).toLocaleString('en-IN')), escapeCsvCell('Kg returned')],
            [],
            [escapeCsvCell('--- PROCESS YIELD & SCRAP RECOVERY BREAKDOWN ---')],
            [
                escapeCsvCell('Work Order #'),
                escapeCsvCell('Date'),
                escapeCsvCell('Target Bags'),
                escapeCsvCell('Net Input (Kg)'),
                escapeCsvCell('Final Bags Produced'),
                escapeCsvCell('Total Baling'),
                escapeCsvCell('Weight per Baling (Kg)'),
                escapeCsvCell('Total Net Weight (Kg)'),
                escapeCsvCell('Qty Rejected (Pcs)'),
                escapeCsvCell('Qty Rejected (Kg)'),
                escapeCsvCell('Scrap (Kg)')
            ]
        ];

        if (filteredTableData.length === 0) {
            csvLines.push([escapeCsvCell('No production stage records found for selected period')]);
        } else {
            filteredTableData.forEach((row) => {
                csvLines.push([
                    escapeCsvCell(row.workOrderNumber || 'N/A'),
                    escapeCsvCell(row.date ? formatCsvDate(row.date) : '-'),
                    escapeCsvCell(Number(row.targetQuantity ?? row.targetBags ?? 0)),
                    escapeCsvCell(Number(row.netInput ?? row.netKgUsed ?? 0)),
                    escapeCsvCell(Number(row.finalBagsProduced ?? row.bagsProduced ?? row.totalBagsProduced ?? 0)),
                    escapeCsvCell(row.totalBaling || '-'),
                    escapeCsvCell(row.weightPerBalingKg != null ? Number(row.weightPerBalingKg) : '-'),
                    escapeCsvCell(row.totalNetWeightKg != null ? Number(row.totalNetWeightKg) : '-'),
                    escapeCsvCell(Number(row.qtyRejectedPcs ?? row.rejects ?? row.totalRejectedBags ?? 0)),
                    escapeCsvCell(row.qtyRejectedKg != null ? Number(row.qtyRejectedKg) : 0),
                    escapeCsvCell(Number(row.scrapKg ?? row.wastageKg ?? row.totalWastageKg ?? 0))
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
        toast.success('Production Yield executive audit report exported to CSV!');
    };

    const handleExportTableCsv = () => {
        let dateStr = 'all';
        if (endDate && endDate.trim()) {
            const parts = endDate.trim().split('-');
            if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                dateStr = formatCsvDate(endDate);
            }
        } else if (startDate && startDate.trim()) {
            dateStr = formatCsvDate(startDate);
        }

        const filename = `production-yield-breakdown-${dateStr}.csv`;

        const headers = [
            'Work Order #',
            'Date',
            'Target Bags',
            'Net Input (Kg)',
            'Final Bags Produced',
            'Total Baling',
            'Weight per Baling (Kg)',
            'Total Net Weight (Kg)',
            'Qty Rejected (Pcs)',
            'Qty Rejected (Kg)',
            'Scrap (Kg)'
        ];

        const csvRows = [headers.map(escapeCsvCell).join(',')];

        if (filteredTableData.length === 0) {
            toast('No records to export for the selected date range.', { icon: 'ℹ️' });
        } else {
            filteredTableData.forEach((row) => {
                const cells = [
                    row.workOrderNumber || 'N/A',
                    row.date ? formatCsvDate(row.date) : '',
                    Number(row.targetQuantity ?? row.targetBags ?? 0),
                    Number(row.netInput ?? row.netKgUsed ?? 0),
                    Number(row.finalBagsProduced ?? row.bagsProduced ?? row.totalBagsProduced ?? 0),
                    row.totalBaling || '-',
                    row.weightPerBalingKg != null ? Number(row.weightPerBalingKg) : '-',
                    row.totalNetWeightKg != null ? Number(row.totalNetWeightKg) : '-',
                    Number(row.qtyRejectedPcs ?? row.rejects ?? row.totalRejectedBags ?? 0),
                    row.qtyRejectedKg != null ? Number(row.qtyRejectedKg) : 0,
                    Number(row.scrapKg ?? row.wastageKg ?? row.totalWastageKg ?? 0)
                ];
                csvRows.push(cells.map(escapeCsvCell).join(','));
            });
        }

        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        if (filteredTableData.length > 0) {
            toast.success(`Exported ${filteredTableData.length} records to CSV!`);
        }
    };

    const exportPdf = () => {
        const todayStr = getTodayDdMmYyyy();
        const dateRangeStr = `From: ${startDate ? formatCsvDate(startDate) : 'All Beginning'} To: ${endDate ? formatCsvDate(endDate) : 'Today'}`;
        generatePdfReport({
            title: 'Production Yield & Scrap Recovery Report',
            subtitle: dateRangeStr,
            generatedDate: todayStr,
            filename: `executive-audit-report-production-yield-${todayStr}.pdf`,
            summaryCards: [
                { label: 'Total Production', value: `${Number(todayBags || 0).toLocaleString('en-IN')} Bags`, notes: 'Bags produced' },
                { label: 'Available Raw Fabric', value: `${Number(availableFabricKg || 0).toLocaleString('en-IN')} Kg`, notes: 'In-stock fabric' },
                { label: 'Total Process Scrap', value: `${Number(totalWastageKg || 0).toLocaleString('en-IN')} Kg`, notes: 'Machine wastage' },
                { label: 'Total Rejected Defects', value: `${Number(totalRejects || 0).toLocaleString('en-IN')} Bags`, notes: 'Rejected defects' },
                { label: 'Material Returned', value: `${Number(totalReturnToStore || 0).toLocaleString('en-IN')} Kg`, notes: 'Returned to store' }
            ],
            sections: [
                {
                    title: 'PROCESS YIELD & SCRAP RECOVERY BREAKDOWN',
                    headers: [
                        'WO #',
                        'Target (Bags)',
                        'Net In (Kg)',
                        'Final (Bags)',
                        'Total Baling',
                        'Wt/Bale (Kg)',
                        'Tot Net Wt (Kg)',
                        'Rej (Pcs)',
                        'Rej (Kg)',
                        'Scrap (Kg)'
                    ],
                    rows: filteredTableData.map((row) => [
                        row.workOrderNumber || 'N/A',
                        Number(row.targetQuantity ?? row.targetBags ?? 0).toLocaleString('en-IN'),
                        Number(row.netInput ?? row.netKgUsed ?? 0).toLocaleString('en-IN'),
                        Number(row.finalBagsProduced ?? row.bagsProduced ?? row.totalBagsProduced ?? 0).toLocaleString('en-IN'),
                        row.totalBaling || '-',
                        row.weightPerBalingKg != null ? `${Number(row.weightPerBalingKg).toFixed(2)} kg` : '-',
                        row.totalNetWeightKg != null ? `${Number(row.totalNetWeightKg).toFixed(2)} kg` : '-',
                        Number(row.qtyRejectedPcs ?? row.rejects ?? row.totalRejectedBags ?? 0).toLocaleString('en-IN'),
                        row.qtyRejectedKg != null && Number(row.qtyRejectedKg) > 0 ? `${Number(row.qtyRejectedKg).toFixed(2)} kg` : '0 kg',
                        Number(row.scrapKg ?? row.wastageKg ?? row.totalWastageKg ?? 0).toLocaleString('en-IN') + ' kg'
                    ])
                }
            ]
        });
        toast.success('Production Yield audit report exported to PDF!');
    };

    useImperativeHandle(ref, () => ({
        exportCsv,
        exportPdf
    }));

    return (
        <div className="space-y-5 font-sans">
            {/* Top 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Today's Production (Bags) */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Production (Bags)</span>
                        <Package size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {todayBags.toLocaleString()} <span className="text-xs font-normal text-text-muted">Bags</span>
                    </div>
                    <div className="text-[10px] flex items-center gap-1 font-semibold">
                        {changePercent > 0 ? (
                            <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                                <TrendingUp size={12} />
                                +{changePercent}% vs Yesterday
                            </span>
                        ) : changePercent < 0 ? (
                            <span className="text-rose-600 flex items-center gap-0.5 font-bold">
                                <TrendingDown size={12} />
                                {changePercent}% vs Yesterday
                            </span>
                        ) : (
                            <span className="text-text-muted">
                                0% vs Yesterday ({yesterdayBags.toLocaleString()} bags)
                            </span>
                        )}
                    </div>
                </div>

                {/* Card 2: Available Raw Fabric (Kg) */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Available Raw Fabric (Kg)</span>
                        <Layers size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-black-00 font-mono">
                        {availableFabricKg.toLocaleString()} <span className="text-xs font-normal text-text-muted">Kg</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                        In-stock fabric & rolls ready for conversion
                    </div>
                </div>

                {/* Card 3: Total Process Scrap / Wastage */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Process Scrap</span>
                        <Flame size={16} className="text-rose-500" />
                    </div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono">
                        {totalWastageKg.toLocaleString()} <span className="text-xs font-normal text-text-muted">Kg</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                        Lumps & unrecoverable machine scrap
                    </div>
                </div>

                {/* Card 4: Total Rejected Defects */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Rejected Defects</span>
                        <Activity size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-amber-700 font-mono">
                        {totalRejects.toLocaleString()} <span className="text-xs font-normal text-text-muted">Bags</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                        {totalReturnToStore > 0 ? `${totalReturnToStore.toLocaleString()} Kg returned to store` : 'Quality reject bags recorded'}
                    </div>
                </div>
            </div>

            {/* Table: Process Yield & Scrap Recovery Breakdown */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            PROCESS YIELD & SCRAP RECOVERY BREAKDOWN
                        </h3>
                        <p className="text-[10px] text-text-muted mt-0.5">
                            Work-order and baling-level breakdown of material input, production output, baling weights, defects, and scrap
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1.5 border border-border rounded-lg text-xs shadow-2xs">
                            <Search size={13} className="text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search WO #..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent text-xs text-text-main placeholder:text-text-muted focus:outline-none w-28 sm:w-36"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-text-muted hover:text-text-main">
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Date Range Inputs */}
                        <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                            <label className="text-[10px] font-bold text-text-muted uppercase">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                            <label className="text-[10px] font-bold text-text-muted uppercase">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                            />
                        </div>

                        {/* Export CSV Button */}
                        <button
                            type="button"
                            onClick={handleExportTableCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
                            title="Export Process Yield & Scrap table records to CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        {/* Export PDF Button */}
                        <button
                            type="button"
                            onClick={exportPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
                            title="Export Process Yield & Scrap report to PDF"
                        >
                            <Printer size={13} />
                            <span>Export PDF</span>
                        </button>

                        {isLoading && (
                            <RefreshCw size={14} className="animate-spin text-primary shrink-0" />
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans whitespace-nowrap min-w-[1100px]">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Work Order #</th>
                                <th className="p-3 border-b border-border text-right font-mono">Target Bags</th>
                                <th className="p-3 border-b border-border text-right font-mono">Net Input (Kg)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Final Bags Produced</th>
                                <th className="p-3 border-b border-border font-mono">Total Baling</th>
                                <th className="p-3 border-b border-border text-right font-mono">Weight per Baling (Kg)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Total Net Weight (Kg)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Qty Rejected (Pcs)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Qty Rejected (Kg)</th>
                                <th className="p-3 border-b border-border text-right font-mono">Scrap (Kg)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredTableData.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-6 text-center text-text-muted">
                                        {tableData.length === 0 ? 'No production stage records found yet.' : 'No matching work orders found for the search query.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredTableData.map((row, i) => {
                                    const hasBaling = Boolean(row.totalBaling);
                                    return (
                                        <tr key={i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                            {/* 1. Work Order # */}
                                            <td className="p-3 font-bold text-text-main">
                                                <div>
                                                    <span className="font-mono">{row.workOrderNumber || 'N/A'}</span>
                                                    {row.date && (
                                                        <span className="block text-[10px] text-text-muted font-normal font-sans">
                                                            {new Date(row.date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 2. Target Bags */}
                                            <td className="p-3 text-right font-mono font-medium text-text-muted">
                                                {Number(row.targetQuantity ?? row.targetBags ?? 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* 3. Net Input (Kg) */}
                                            <td className="p-3 text-right font-mono font-medium">
                                                {Number(row.netInput ?? row.netKgUsed ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg
                                            </td>

                                            {/* 4. Final Bags Produced */}
                                            <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                                {Number(row.finalBagsProduced ?? row.bagsProduced ?? row.totalBagsProduced ?? 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* 5. Total Baling */}
                                            <td className="p-3 font-mono font-medium text-text-main">
                                                {hasBaling ? (
                                                    <span className="inline-block bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold">
                                                        {row.totalBaling}
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted">-</span>
                                                )}
                                            </td>

                                            {/* 6. Weight per Baling (Kg) */}
                                            <td className="p-3 text-right font-mono font-medium">
                                                {hasBaling && row.weightPerBalingKg != null ? (
                                                    <span>{Number(row.weightPerBalingKg).toFixed(3)} kg</span>
                                                ) : (
                                                    <span className="text-text-muted">-</span>
                                                )}
                                            </td>

                                            {/* 7. Total Net Weight (Kg) */}
                                            <td className="p-3 text-right font-mono font-bold text-text-main">
                                                {hasBaling && row.totalNetWeightKg != null ? (
                                                    <span>{Number(row.totalNetWeightKg).toFixed(3)} kg</span>
                                                ) : (
                                                    <span className="text-text-muted">-</span>
                                                )}
                                            </td>

                                            {/* 8. Qty Rejected (Pcs) */}
                                            <td className="p-3 text-right font-mono font-bold text-amber-700">
                                                {Number(row.qtyRejectedPcs ?? row.rejects ?? row.totalRejectedBags ?? 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* 9. Qty Rejected (Kg) */}
                                            <td className="p-3 text-right font-mono font-medium text-amber-800">
                                                {row.qtyRejectedKg != null && Number(row.qtyRejectedKg) > 0 ? (
                                                    `${Number(row.qtyRejectedKg).toFixed(3)} kg`
                                                ) : (
                                                    Number(row.qtyRejectedPcs ?? row.rejects ?? row.totalRejectedBags ?? 0) === 0 ? '0 kg' : '-'
                                                )}
                                            </td>

                                            {/* 10. Scrap (Kg) */}
                                            <td className="p-3 text-right font-mono font-medium text-rose-600">
                                                {Number(row.scrapKg ?? row.wastageKg ?? row.totalWastageKg ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

export default ProductionYieldTab;
