import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Users, Package, Award, Calendar, Download, RefreshCw, AlertCircle, TrendingUp, ChevronRight, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

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

const OperatorProductivityTab = forwardRef(function OperatorProductivityTab(props, ref) {
    const [startDate, setStartDate] = useState(''); // Empty string allows fetching all records
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Default today
    const [selectedOperatorId, setSelectedOperatorId] = useState('');

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Selected operator for modal breakdown
    const [selectedOperatorModal, setSelectedOperatorModal] = useState(null);

    const fetchProductivityData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const params = {};
            if (startDate && startDate.trim()) params.startDate = startDate.trim();
            if (endDate && endDate.trim()) params.endDate = endDate.trim();
            if (selectedOperatorId && selectedOperatorId.trim()) params.operatorId = selectedOperatorId.trim();

            const res = await axiosInstance.get('/analytics/operator-productivity', { params });
            if (res.data?.success) {
                setData(res.data.data);
            } else {
                setError(res.data?.message || 'Failed to load operator productivity data');
            }
        } catch (err) {
            console.error('Error fetching operator productivity:', err);
            setError(err.response?.data?.message || 'Failed to load operator productivity');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProductivityData();
    }, [startDate, endDate, selectedOperatorId]);

    const summary = data?.summary || {
        totalOperatorsActive: 0,
        totalBagsProduced: 0,
        legacyUnattributedBags: 0,
        legacyWosCount: 0,
        topOperatorName: 'N/A',
        topOperatorBags: 0,
        avgBagsPerOperator: 0
    };

    const operators = data?.operators || [];
    const availableOperators = data?.availableOperators || [];

    // Export CSV with real rows
    const exportCsv = () => {
        const todayStr = getTodayDdMmYyyy();
        const filename = `executive-audit-report-operator-productivity-${todayStr}.csv`;

        const csvLines = [
            [escapeCsvCell('EXECUTIVE AUDIT REPORT - OPERATOR PRODUCTIVITY')],
            [escapeCsvCell('Generated Date'), escapeCsvCell(todayStr)],
            [escapeCsvCell('Date Filter Range'), escapeCsvCell(`From: ${startDate ? formatCsvDate(startDate) : 'All Beginning'} To: ${endDate ? formatCsvDate(endDate) : 'Today'}`)],
            [],
            [escapeCsvCell('--- SUMMARY KPI CARDS ---')],
            [escapeCsvCell('Metric'), escapeCsvCell('Value'), escapeCsvCell('Notes')],
            [escapeCsvCell('Active Operators'), escapeCsvCell(Number(summary.totalOperatorsActive || 0)), escapeCsvCell('Operators with logged output')],
            [escapeCsvCell('Total Finished Bags Produced'), escapeCsvCell(Number(summary.totalBagsProduced || 0).toLocaleString('en-IN')), escapeCsvCell('Final stage output')],
            [escapeCsvCell('Historical / Unassigned Bags'), escapeCsvCell(Number(summary.legacyUnattributedBags || 0).toLocaleString('en-IN')), escapeCsvCell(`${summary.legacyWosCount || 0} legacy WOs`)],
            [escapeCsvCell('Top Performer'), escapeCsvCell(summary.topOperatorName || 'N/A'), escapeCsvCell(`${Number(summary.topOperatorBags || 0).toLocaleString('en-IN')} Bags`)],
            [escapeCsvCell('Average per Operator'), escapeCsvCell(Number(summary.avgBagsPerOperator || 0).toLocaleString('en-IN')), escapeCsvCell('Bags per active operator')],
            [],
            [escapeCsvCell('--- OPERATOR PRODUCTIVITY RANKINGS & METRICS ---')],
            [
                escapeCsvCell('Operator Name'),
                escapeCsvCell('Employee Code'),
                escapeCsvCell('Department'),
                escapeCsvCell('Total Finished Bags Produced'),
                escapeCsvCell('Work Orders Contributed'),
                escapeCsvCell('Best Single Day Date'),
                escapeCsvCell('Best Single Day Quantity')
            ]
        ];

        if (operators.length === 0) {
            csvLines.push([escapeCsvCell('No operator productivity records found for selected period')]);
        } else {
            operators.forEach((op) => {
                csvLines.push([
                    escapeCsvCell(op.operatorName || 'Unknown'),
                    escapeCsvCell(op.employeeCode || '-'),
                    escapeCsvCell(op.department || '-'),
                    escapeCsvCell(Number(op.totalBags || 0)),
                    escapeCsvCell(Number(op.workOrderCount || 0)),
                    escapeCsvCell(op.bestSingleDay?.date ? formatCsvDate(op.bestSingleDay.date) : '-'),
                    escapeCsvCell(Number(op.bestSingleDay?.quantity || 0))
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
        toast.success('Operator Productivity executive audit report exported to CSV!');
    };

    useImperativeHandle(ref, () => ({
        exportCsv
    }));

    const handleExportCsv = exportCsv;

    return (
        <div className="space-y-5 font-sans">
            {/* Top 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Active Operators */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Active Operators</span>
                        <Users size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : summary.totalOperatorsActive} <span className="text-xs font-normal text-text-muted">Operators</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                        Operators with logged finished goods output
                    </div>
                </div>

                {/* Card 2: Total Finished Bags Produced */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Bags Produced</span>
                        <Package size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">
                        {isLoading ? '...' : Number(summary.totalBagsProduced || 0).toLocaleString('en-IN')} <span className="text-xs font-normal text-text-muted">Bags</span>
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold">
                        Final Stage Finished Goods Output
                    </div>
                </div>

                {/* Card 3: Top Performing Operator */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Top Contributor</span>
                        <Award size={16} className="text-amber-500" />
                    </div>
                    <div className="text-sm font-extrabold text-text-main truncate" title={summary.topOperatorName}>
                        {isLoading ? '...' : summary.topOperatorName}
                    </div>
                    <div className="text-[10px] text-amber-700 font-mono font-bold">
                        {Number(summary.topOperatorBags || 0).toLocaleString('en-IN')} Bags in range
                    </div>
                </div>

                {/* Card 4: Average Bags per Operator */}
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Avg Output / Operator</span>
                        <TrendingUp size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-primary font-mono">
                        {isLoading ? '...' : Number(summary.avgBagsPerOperator || 0).toLocaleString('en-IN')} <span className="text-xs font-normal text-text-muted">Bags</span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                        Per active operator in selected period
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            OPERATOR PRODUCTION CONTRIBUTIONS & PRODUCTIVITY
                        </h3>
                        <p className="text-[10px] text-text-muted mt-0.5">
                            Cross-Work-Order finished goods produced by operator (Final stage only, no double-counting)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Operator Dropdown Filter */}
                        <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                            <label className="text-[10px] font-bold text-text-muted uppercase">Operator:</label>
                            <select
                                value={selectedOperatorId}
                                onChange={(e) => setSelectedOperatorId(e.target.value)}
                                className="bg-transparent text-xs font-bold text-text-main focus:outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="" className="bg-card-bg text-text-main">All Operators</option>
                                {availableOperators.map((op) => (
                                    <option key={op.operatorId} value={op.operatorId} className="bg-card-bg text-text-main">
                                        {op.name} {op.employeeCode ? `(${op.employeeCode})` : ''}
                                    </option>
                                ))}
                            </select>
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

                        {/* CSV Export Button */}
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
                            title="Export operator productivity records to CSV"
                        >
                            <Download size={13} />
                            <span>Export CSV</span>
                        </button>

                        {isLoading && (
                            <RefreshCw size={14} className="animate-spin text-primary shrink-0" />
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Operator Details</th>
                                <th className="p-3 border-b border-border">Department</th>
                                <th className="p-3 border-b border-border font-mono text-center">Total Bags Produced</th>
                                <th className="p-3 border-b border-border font-mono text-center">WOs Contributed</th>
                                <th className="p-3 border-b border-border font-mono text-center">Best Single Day</th>
                                <th className="p-3 border-b border-border text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs font-semibold">Loading operator productivity...</p>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-rose-600 font-semibold">
                                        {error}
                                    </td>
                                </tr>
                            ) : operators.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <Users size={28} className="mx-auto mb-2 opacity-40 text-primary" />
                                        <p className="text-xs font-bold text-text-main">No operator production records found for selected period.</p>
                                        <p className="text-[11px] text-text-muted mt-0.5">
                                            Log operator production in Work Orders to see cross-order productivity.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                operators.map((row, i) => (
                                    <tr key={row.operatorId || i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                        <td className="p-3 font-bold text-text-main">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-extrabold text-[11px] shrink-0">
                                                    {row.operatorName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-text-main">{row.operatorName}</span>
                                                    {row.employeeCode && row.employeeCode !== 'LEGACY' && (
                                                        <span className="block text-[10px] font-mono text-text-muted font-normal">
                                                            {row.employeeCode}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-text-muted">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-app-bg border border-border">
                                                {row.department || 'PRODUCTION'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono font-extrabold text-emerald-700 text-center text-sm">
                                            {Number(row.totalBags || 0).toLocaleString('en-IN')} <span className="text-[10px] font-normal text-text-muted">Bags</span>
                                        </td>
                                        <td className="p-3 font-mono font-bold text-primary text-center">
                                            {row.workOrderCount} <span className="text-[10px] font-normal text-text-muted">WOs</span>
                                        </td>
                                        <td className="p-3 font-mono text-center">
                                            {row.bestSingleDay?.quantity > 0 ? (
                                                <div>
                                                    <span className="font-bold text-text-main">{Number(row.bestSingleDay.quantity).toLocaleString('en-IN')} Bags</span>
                                                    <span className="block text-[10px] text-text-muted font-normal">{row.bestSingleDay.date}</span>
                                                </div>
                                            ) : (
                                                <span className="text-text-muted">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedOperatorModal(row)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-app-bg hover:bg-border text-text-muted hover:text-text-main rounded-md text-xs font-semibold border border-border transition-colors cursor-pointer"
                                            >
                                                <span>Breakdown</span>
                                                <ChevronRight size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footnote for Legacy / Unattributed WOs */}
                {summary.legacyUnattributedBags > 0 && (
                    <div className="p-3 bg-amber-50/60 border-t border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={15} className="text-amber-600 shrink-0" />
                            <span>
                                <strong>Legacy / unattributed production:</strong> {Number(summary.legacyUnattributedBags).toLocaleString('en-IN')} Bags (from {summary.legacyWosCount || 'historical'} Work Orders completed before operator logging was activated).
                            </span>
                        </div>
                        <span className="text-[10px] text-amber-700 font-semibold italic shrink-0">
                            Preserved in total yield reconciliation
                        </span>
                    </div>
                )}
            </div>

            {/* Operator WO Breakdown Modal */}
            {selectedOperatorModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-text-main">
                                    {selectedOperatorModal.operatorName} — Production Breakdown
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {selectedOperatorModal.employeeCode ? `Code: ${selectedOperatorModal.employeeCode} • ` : ''}
                                    Total: <strong className="text-emerald-700 font-mono">{Number(selectedOperatorModal.totalBags || 0).toLocaleString('en-IN')} Bags</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedOperatorModal(null)}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Work Orders List */}
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                Contributed Work Orders ({selectedOperatorModal.workOrders?.length || 0})
                            </h4>
                            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-app-bg/40">
                                {selectedOperatorModal.workOrders?.map((wo, i) => (
                                    <div key={wo.workOrderId || i} className="p-2.5 flex items-center justify-between text-xs hover:bg-app-bg/80">
                                        <div>
                                            <span className="font-bold text-text-main font-mono">{wo.workOrderNumber}</span>
                                            <span className="block text-[10px] text-text-muted">Last entry: {wo.lastDate}</span>
                                        </div>
                                        <span className="font-mono font-extrabold text-emerald-700">
                                            {Number(wo.totalQuantity || 0).toLocaleString('en-IN')} Bags
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Daily Production Breakdown */}
                        {selectedOperatorModal.dailyBreakdown?.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                    Daily Timeline
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                    {selectedOperatorModal.dailyBreakdown.map((d, i) => (
                                        <div key={i} className="p-2 bg-app-bg border border-border rounded-lg">
                                            <span className="text-[10px] text-text-muted font-mono block">{d.date}</span>
                                            <span className="font-mono font-bold text-primary">{Number(d.quantity).toLocaleString('en-IN')} Bags</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setSelectedOperatorModal(null)}
                                className="px-4 py-1.5 bg-primary text-sidebar-bg font-extrabold rounded-lg text-xs hover:bg-primary-hover transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default OperatorProductivityTab;
