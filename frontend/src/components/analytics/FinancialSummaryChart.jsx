import { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, PieChart, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const formatCurrencyYAxis = (val) => {
    if (val >= 10000000) {
        return `₹${(val / 10000000).toFixed(1)} Cr`;
    }
    if (val >= 100000) {
        return `₹${(val / 100000).toFixed(0)} L`;
    }
    return `₹${val}`;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded-lg shadow-xl text-xs font-sans space-y-1.5 z-50">
                <div className="font-extrabold border-b border-slate-700 pb-1 text-amber-400">{label}</div>
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between gap-4 items-center">
                        <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.name}:</span>
                        </span>
                        <span className="font-mono font-bold">
                            ₹{Number(entry.value || 0).toLocaleString('en-IN')}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function FinancialSummaryChart() {
    const [chartData, setChartData] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiveFromDb, setIsLiveFromDb] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        axiosInstance.get('/analytics/financial-summary')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setChartData(res.data.data);
                    setSummaryData(res.data.summary || null);
                    setIsLiveFromDb(res.data.hasRealData || false);
                }
            })
            .catch((err) => {
                console.error('Error fetching financial summary analytics:', err);
                toast.error('Failed to load financial analytics from database');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    // Summary calculations fallback
    const totalRev = summaryData?.totalRevenue || chartData.reduce((acc, i) => acc + (i.revenue || 0), 0);
    const totalCost = summaryData?.totalCost || chartData.reduce((acc, i) => acc + (i.cost || 0), 0);
    const netProf = summaryData?.netProfit || (totalRev - totalCost);
    const marginPct = summaryData?.netMarginPercent !== undefined
        ? summaryData.netMarginPercent
        : (totalRev > 0 ? ((netProf / totalRev) * 100).toFixed(1) : 0);

    return (
        <div className="space-y-6 font-sans">
            {/* KPI Summary Cards Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Gross Revenue (FY 26-27)</span>
                        <DollarSign size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : formatCurrencyYAxis(totalRev)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                        <TrendingUp size={12} /> Live Invoices Sum
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Operating Expenses (COGS)</span>
                        <TrendingDown size={16} className="text-slate-700" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">
                        {isLoading ? '...' : formatCurrencyYAxis(totalCost)}
                    </div>
                    <div className="text-[10px] text-text-muted font-medium">Purchases & Material POs</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Net EBITDA Profit</span>
                        <PieChart size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">
                        {isLoading ? '...' : formatCurrencyYAxis(netProf)}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                        <TrendingUp size={12} /> {marginPct}% Net Margin
                    </div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Financial Audit Status</span>
                        <ShieldCheck size={16} className="text-primary" />
                    </div>
                    <div className="text-sm font-extrabold text-text-main uppercase">
                        {isLiveFromDb ? 'Live DB Aggregated' : 'Audited Baseline'}
                    </div>
                    <div className="text-[10px] text-text-muted font-mono">Statutory Multi-Tenant GST</div>
                </div>
            </div>

            {/* Main Recharts Grouped Bar Chart Container */}
            <div className="bg-card-bg border border-border p-5 rounded-xl shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                        <h3 className="text-sm font-extrabold text-text-main tracking-wide uppercase">
                            FINANCIAL PERFORMANCE TREND (FY 2026-27)
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            Quarterly Revenue vs. Operating Expenses & Net Margin EBITDA Breakdown
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                            isLiveFromDb
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                            • {isLiveFromDb ? 'MongoDB Pipeline Aggregation' : 'Database Financial Ledger'}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="w-full h-80 flex flex-col items-center justify-center text-text-muted gap-2 font-sans">
                        <Loader2 size={32} className="animate-spin text-amber-500" />
                        <span className="text-xs font-semibold text-text-main">
                            Aggregating Invoices & Purchase Orders from Database...
                        </span>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="w-full h-80 flex flex-col items-center justify-center text-text-muted gap-2 font-sans">
                        <AlertCircle size={36} className="text-amber-500 opacity-60" />
                        <span className="text-sm font-bold text-text-main">
                            No financial data available for the selected period
                        </span>
                        <span className="text-xs text-text-muted">
                            Issue customer invoices or purchase orders to populate real-time analytics.
                        </span>
                    </div>
                ) : (
                    <div className="w-full h-80 pt-2 font-sans">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                                barGap={8}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis
                                    dataKey="period"
                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={formatCurrencyYAxis}
                                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Bar
                                    name="Gross Revenue"
                                    dataKey="revenue"
                                    fill="#F59E0B"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={45}
                                />
                                <Bar
                                    name="Operational Cost"
                                    dataKey="cost"
                                    fill="#1E293B"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={45}
                                />
                                <Bar
                                    name="Net EBITDA Profit"
                                    dataKey="profit"
                                    fill="#10B981"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={45}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
