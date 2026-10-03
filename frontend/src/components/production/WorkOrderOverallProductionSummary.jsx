import { useState, useEffect } from 'react';
import { Layers, Users, Package, AlertCircle, RefreshCw, CheckCircle2, Award, Calendar, Clock } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

const STAGE_NAME_MAP = {
    TAPE_EXTRUSION: 'Tape Extrusion',
    CIRCULAR_WEAVING: 'Circular Weaving',
    EXTRUSION_LAMINATION: 'Extrusion Lamination',
    FLEXO_PRINTING: 'Flexo Printing',
    CUTTING_SEWING: 'Cutting & Sewing',
    STITCHING: 'Stitching',
    HANDLE_ATTACHMENT: 'Handle Attachment',
    BALING_PACKING: 'Baling & Packing'
};

const getStageDisplayTitle = (st) => {
    if (!st) return 'Stage';
    const key = String(st.stageName || '').toUpperCase();
    if (STAGE_NAME_MAP[key]) return STAGE_NAME_MAP[key];
    if (st.label) {
        return st.label
            .toLowerCase()
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }
    return String(st.stageName || '').replace(/_/g, ' ');
};

export default function WorkOrderOverallProductionSummary({ workOrderId, lastUpdated }) {
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSummary = async () => {
        if (!workOrderId) return;
        try {
            setIsLoading(true);
            setError(null);
            const res = await axiosInstance.get(`/work-orders/${workOrderId}/production-summary`);
            if (res.data?.success) {
                setSummaryData(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching overall production summary:', err);
            setError(err.response?.data?.message || 'Failed to load overall production summary');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [workOrderId, lastUpdated]);

    if (isLoading && !summaryData) {
        return (
            <div className="bg-card-bg border border-border rounded-xl p-6 flex flex-col items-center justify-center font-sans space-y-2">
                <RefreshCw size={20} className="animate-spin text-primary" />
                <p className="text-xs text-text-muted font-semibold">Loading overall production matrix...</p>
            </div>
        );
    }

    if (error && !summaryData) {
        return null;
    }

    const stages = summaryData?.stages || [];
    if (stages.length === 0) {
        return null;
    }

    const operators = summaryData?.operators || [];
    const targetQty = Number(summaryData?.targetQuantity || 0);
    const woUnit = summaryData?.unit || 'Bags';
    const finishedGoodsQty = Number(summaryData?.finishedGoodsQty || 0);
    const hasLegacyStages = summaryData?.hasLegacyStages;

    const activeOperators = operators.filter((op) => op.totalAcrossStages > 0);
    const timeline = summaryData?.timeline || [];
    const finalStageName = summaryData?.finishedGoodsStageName;
    const finalStageObj = stages.find((s) => s.stageName === finalStageName) || stages[stages.length - 1];
    const finalStageOperatorsCount = finalStageObj?.byOperator?.filter((op) => op.quantity > 0)?.length || 0;

    return (
        <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden font-sans space-y-0">
            {/* Header */}
            <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            Overall Production Summary
                        </h3>
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Consolidated stage-by-stage operator matrix and finished goods reconciliation. Note: Stage quantities are not summed across stages since the same units move through the pipeline; only the final stage reflects actual finished goods produced.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={fetchSummary}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-card-bg hover:bg-border text-text-muted hover:text-text-main rounded-md text-xs font-semibold border border-border transition-colors cursor-pointer"
                        title="Refresh summary"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin text-primary' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead>
                        <tr className="bg-gray-50 text-slate-800 border-b border-gray-200">
                            <th className="p-3.5 min-w-[160px] sticky left-0 bg-gray-50 z-10 shadow-r text-left uppercase text-[10px] font-bold tracking-wider text-slate-800 border-r border-gray-200">
                                Operator
                            </th>
                            {stages.map((st) => (
                                <th key={st.stageName} className="p-3 text-center align-middle min-w-[140px] bg-gray-50 border-r border-gray-200">
                                    <div className="text-slate-800 text-xs font-bold uppercase tracking-wide mb-1">
                                        {getStageDisplayTitle(st)}
                                    </div>
                                    <div className="text-slate-500 text-[10px] font-mono">
                                        Target: {Number(st.targetQuantity || 0).toLocaleString('en-IN')}
                                    </div>
                                </th>
                            ))}
                            <th className="p-3.5 text-center font-mono font-bold bg-emerald-50 min-w-[150px] border-l border-gray-200 text-[10px] uppercase tracking-wider text-emerald-800">
                                Contribution to Finished Goods
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-main">
                        {activeOperators.length === 0 ? (
                            <tr>
                                <td colSpan={stages.length + 2} className="p-6 text-center text-text-muted">
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                        <AlertCircle size={20} className="text-amber-500 opacity-60" />
                                        <p className="font-semibold text-xs text-text-main">No operator production logs recorded yet.</p>
                                        <p className="text-[11px] text-text-muted">
                                            Use the stage tracker below to log daily operator contributions.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            activeOperators.map((op) => (
                                <tr key={op.operatorId} className="hover:bg-app-bg/50 transition-colors">
                                    <td className="p-3 font-semibold text-text-main sticky left-0 bg-card-bg z-10 shadow-r border-r border-border">
                                        <div className="font-bold text-text-main text-xs">{op.operatorName}</div>
                                        {op.employeeCode && op.employeeCode !== 'LEGACY' && (
                                            <div className="text-[10px] text-text-muted font-mono">{op.employeeCode}</div>
                                        )}
                                    </td>
                                    {stages.map((st) => {
                                        const qty = op.stages?.[st.stageName] || 0;
                                        return (
                                            <td key={st.stageName} className="p-3 text-center font-mono font-semibold">
                                                {qty > 0 ? (
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        {qty.toLocaleString('en-IN')} {woUnit}
                                                    </span>
                                                ) : st.isLegacy ? (
                                                    <span className="text-[10px] text-amber-700 italic font-sans">
                                                        -
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted text-[11px]">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="p-3 text-center font-mono font-bold text-emerald-800 bg-emerald-50/40 border-l border-gray-200">
                                        {(op.stages?.[finalStageName] || op.finishedGoodsQty) ? (
                                            <span className="font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                                                {Number(op.stages?.[finalStageName] || op.finishedGoodsQty).toLocaleString('en-IN')} {woUnit}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted text-[11px]">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}

                        {/* Legacy Stages Indicator Row if applicable */}
                        {hasLegacyStages && (
                            <tr className="bg-amber-50/40 text-amber-900 border-t border-amber-200/60 font-sans text-xs">
                                <td className="p-3 font-bold text-amber-900 sticky left-0 bg-amber-50/90 z-10 shadow-r border-r border-amber-200">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px]">Legacy Stored Total</span>
                                    </div>
                                    <span className="text-[9px] text-amber-700 font-normal block">(Pre-tracking era)</span>
                                </td>
                                {stages.map((st) => (
                                    <td key={st.stageName} className="p-3 text-center">
                                        {st.isLegacy ? (
                                            <div className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded text-[10px] font-semibold text-center font-mono">
                                                <div>{Number(st.legacyQuantity || st.totalProduced || 0).toLocaleString('en-IN')} {woUnit}</div>
                                                <div className="text-[8px] text-amber-700 font-sans tracking-tight uppercase">Legacy total (no operator breakdown)</div>
                                            </div>
                                        ) : (
                                            <span className="text-text-muted text-[10px]">-</span>
                                        )}
                                    </td>
                                ))}
                                <td className="p-3 text-center font-mono font-bold text-amber-800 bg-amber-50/50 border-l border-amber-200 text-[11px]">
                                    -
                                </td>
                            </tr>
                        )}

                        {/* Stage Totals Row */}
                        <tr className="bg-app-bg font-bold border-t-2 border-border text-text-main">
                            <td className="p-3 font-extrabold uppercase text-[10px] tracking-wider text-text-main sticky left-0 bg-app-bg z-10 shadow-r border-r border-border">
                                Total Produced
                            </td>
                            {stages.map((st) => {
                                const total = Number(st.totalProduced || 0);
                                const isAchieved = total >= Number(st.targetQuantity || 0) && Number(st.targetQuantity || 0) > 0;
                                return (
                                    <td key={st.stageName} className="p-3 text-center font-mono">
                                        <div className={`font-extrabold text-xs ${isAchieved ? 'text-emerald-700' : 'text-primary'}`}>
                                            {total.toLocaleString('en-IN')} {woUnit}
                                        </div>
                                        <div className="text-[9px] font-sans text-text-muted font-normal mt-0.5">
                                            {st.remainingQuantity > 0 ? (
                                                <span className="text-amber-600 font-medium">({st.remainingQuantity.toLocaleString('en-IN')} rem)</span>
                                            ) : (
                                                <span className="text-emerald-600 font-medium">100% Done</span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                            <td className="p-3 text-center font-mono font-extrabold text-xs text-emerald-800 bg-emerald-100/70 border-l border-gray-200">
                                {finishedGoodsQty.toLocaleString('en-IN')} {woUnit}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Bottom Finished Goods Highlight Bar */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-card-bg to-primary/10 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/15 text-emerald-700 rounded-lg shrink-0">
                        <CheckCircle2 size={16} />
                    </div>
                    <div>
                        <span className="font-extrabold text-text-main">Finished Goods (Final Stage Output): </span>
                        <strong className="text-emerald-700 font-mono text-sm">{finishedGoodsQty.toLocaleString('en-IN')} {woUnit}</strong>
                        <span className="text-text-muted text-[11px] ml-1.5 font-medium">
                            {finalStageOperatorsCount > 0
                                ? `across ${finalStageOperatorsCount} operator${finalStageOperatorsCount > 1 ? 's' : ''}`
                                : hasLegacyStages
                                ? '(Historical Work Order total)'
                                : 'across assigned operators'}
                        </span>
                    </div>
                </div>

                <div className="text-[11px] text-text-muted font-mono flex items-center gap-2 shrink-0">
                    <span>WO Target: <strong>{targetQty.toLocaleString('en-IN')} Bags</strong></span>
                    <span className="text-border">•</span>
                    <span className={finishedGoodsQty >= targetQty && targetQty > 0 ? 'text-emerald-600 font-bold' : 'text-text-muted'}>
                        {targetQty > 0 ? `${Math.round((finishedGoodsQty / targetQty) * 100)}% Complete` : 'No target'}
                    </span>
                </div>
            </div>

            {/* Production Timeline (Date-wise Progress) Section */}
            <div className="border-t border-border bg-card-bg">
                <div className="p-4 border-b border-border bg-app-bg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-primary" />
                            <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                                Production Timeline (Date-wise Progress)
                            </h3>
                        </div>
                        <p className="text-[11px] text-text-muted">
                            Chronological history showing processes active and bags logged by date across all production stages.
                        </p>
                    </div>
                    {timeline.length > 0 && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                            {timeline.length} Production Day{timeline.length > 1 ? 's' : ''} Logged
                        </span>
                    )}
                </div>

                {timeline.length === 0 ? (
                    <div className="p-6 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center space-y-1">
                            <Clock size={20} className="text-primary/60" />
                            <p className="font-semibold text-xs text-text-main">No date-wise production logs recorded yet.</p>
                            <p className="text-[11px] text-text-muted">
                                Daily production logs entered in the stage monitor will be displayed chronologically here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead>
                                <tr className="bg-gray-50 text-slate-800 border-b border-gray-200">
                                    <th className="p-3.5 uppercase text-[10px] font-bold tracking-wider text-slate-800 min-w-[140px]">
                                        Date
                                    </th>
                                    <th className="p-3.5 uppercase text-[10px] font-bold tracking-wider text-slate-800 min-w-[280px]">
                                        Stage(s) Active That Date
                                    </th>
                                    <th className="p-3.5 uppercase text-[10px] font-bold tracking-wider text-slate-800 min-w-[220px]">
                                        Operators
                                    </th>
                                    <th className="p-3.5 text-right uppercase text-[10px] font-bold tracking-wider text-slate-800 min-w-[150px]">
                                        Total {woUnit} Logged
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-text-main">
                                {timeline.map((entry, idx) => {
                                    let dateDisplay = entry.date;
                                    try {
                                        const [y, m, d] = entry.date.split('-');
                                        if (y && m && d) {
                                            const dObj = new Date(Number(y), Number(m) - 1, Number(d));
                                            dateDisplay = dObj.toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            });
                                        }
                                    } catch {
                                        dateDisplay = entry.date;
                                    }

                                    return (
                                        <tr key={idx} className="hover:bg-app-bg/50 transition-colors">
                                            <td className="p-3.5 align-top font-sans">
                                                <div className="flex items-center gap-1.5 font-bold text-text-main text-xs">
                                                    <Calendar size={13} className="text-primary shrink-0" />
                                                    <span>{dateDisplay}</span>
                                                </div>
                                                <div className="text-[10px] text-text-muted font-mono mt-0.5 ml-4">
                                                    {entry.date}
                                                </div>
                                            </td>
                                            <td className="p-3.5 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {entry.stages.map((st, sIdx) => (
                                                        <div
                                                            key={sIdx}
                                                            className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-app-bg border border-border text-xs"
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                                <span className="font-semibold text-text-main truncate text-[11px]">
                                                                    {STAGE_NAME_MAP[st.stageName] || st.stageLabel}
                                                                </span>
                                                            </div>
                                                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] shrink-0 border border-emerald-200">
                                                                {Number(st.quantity).toLocaleString('en-IN')} {woUnit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3.5 align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    {entry.operators && entry.operators.length > 0 ? (
                                                        entry.operators.map((op, opIdx) => (
                                                            <span
                                                                key={opIdx}
                                                                className="inline-flex items-center gap-1 text-[10px] font-medium bg-card-bg text-text-main border border-border px-2 py-0.5 rounded-md shadow-2xs"
                                                            >
                                                                <Users size={10} className="text-text-muted" />
                                                                <span>{op}</span>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-text-muted text-[11px] italic">Unassigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3.5 align-top text-right font-mono">
                                                <span className="font-extrabold text-sm text-text-main">
                                                    {Number(entry.totalBags).toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-[11px] text-text-muted ml-1 font-sans">{woUnit}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
