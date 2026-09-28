import { useState, useEffect } from 'react';
import { Activity, Flame, Layers, Package, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

export default function ProductionYieldTab() {
    const [startDate, setStartDate] = useState(''); // Empty string allows fetching all records
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Default today
    const [tableData, setTableData] = useState([]);

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

    // Extract metrics with safe defaults
    const todayBags = metrics?.todayVsYesterdayBags?.todayBags ?? metrics?.todayBags ?? 0;
    const yesterdayBags = metrics?.todayVsYesterdayBags?.yesterdayBags ?? metrics?.yesterdayBags ?? 0;
    const changePercent = metrics?.todayVsYesterdayBags?.changePercent ?? 0;
    const availableFabricKg = metrics?.availableKgForBags ?? 0;

    const overall = metrics?.kgUsedVsBagsProduced?.overall;
    const totalWastageKg = overall?.totalWastageKg ?? metrics?.totalWastageKg ?? 0;
    const totalRejects = overall?.totalRejectedBags ?? metrics?.totalRejectedBags ?? 0;
    const totalReturnToStore = overall?.totalReturnToStore ?? 0;

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
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            PROCESS YIELD & SCRAP RECOVERY BREAKDOWN
                        </h3>
                        <p className="text-[10px] text-text-muted mt-0.5">
                            Correlation of material input, production output, machine wastage and defect rejects
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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

                        {isLoading && (
                            <RefreshCw size={14} className="animate-spin text-primary shrink-0" />
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Work Order</th>
                                <th className="p-3 border-b border-border font-mono">Net Input (KG)</th>
                                <th className="p-3 border-b border-border font-mono">Bags Produced (Qty)</th>
                                <th className="p-3 border-b border-border font-mono">Wastage (KG)</th>
                                <th className="p-3 border-b border-border font-mono">Rejects (Qty)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {tableData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-text-muted">
                                        No production stage records found yet.
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((row, i) => (
                                    <tr key={i} className="hover:bg-app-bg/50 transition-colors text-text-main">
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
                                        <td className="p-3 font-mono font-medium">{Number(row.netInput ?? row.netKgUsed ?? 0).toLocaleString()} kg</td>
                                        <td className="p-3 font-mono font-bold text-emerald-700">{Number(row.bagsProduced ?? row.totalBagsProduced ?? 0).toLocaleString()}</td>
                                        <td className="p-3 font-mono font-medium text-rose-600">{Number(row.wastageKg ?? row.totalWastageKg ?? 0).toLocaleString()} kg</td>
                                        <td className="p-3 font-mono font-bold text-amber-700">{Number(row.rejects ?? row.totalRejectedBags ?? 0).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

