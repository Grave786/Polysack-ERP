import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    RefreshCw,
    Plus,
    Eye,
    Download,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Layers,
    Package,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { formatDate } from '../../utils/dateUtils';
import { useAuthStore } from '../../store/authStore';
import { hasModulePermission, isTenantAdmin, checkIsSuperAdmin } from '../../utils/permissionUtils';

const PROD_STATUS_BADGE = {
    'Not Planned': 'bg-slate-100 text-slate-700 border-slate-300',
    'Partially Planned': 'bg-amber-100 text-amber-800 border-amber-300',
    'Fully Planned': 'bg-blue-100 text-blue-800 border-blue-300',
    'In Production': 'bg-purple-100 text-purple-800 border-purple-300',
    'Production Completed': 'bg-emerald-100 text-emerald-800 border-emerald-300'
};

export default function PendingProductionTab({
    refreshKey = 0,
    onCreateWorkOrderFromLine,
    onViewWorkOrder,
    onCountChange
}) {
    const user = useAuthStore((state) => state.user);
    const canCreateWo = (() => {
        if (!user) return false;
        if (isTenantAdmin(user) || checkIsSuperAdmin(user)) return true;
        if (!hasModulePermission(user, 'PRODUCTION')) return false;
        const perms = user.role?.permissions || user.permissions || [];
        if (!Array.isArray(perms) || perms.length === 0) return true;
        const prodPerm = perms.find((p) => (typeof p === 'object' ? p.module : String(p)) === 'PRODUCTION');
        if (!prodPerm || typeof prodPerm !== 'object') return true;
        if (!Array.isArray(prodPerm.actions) || prodPerm.actions.length === 0) return true;
        return prodPerm.actions.some((a) => String(a).toUpperCase() === 'CREATE');
    })();
    const [lines, setLines] = useState([]);
    const [summary, setSummary] = useState({
        linesPending: 0,
        totalQuantityPending: 0,
        overdueOrders: 0,
        ordersWithoutWo: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [planningPage, setPlanningPage] = useState(1);
    const PAGE_SIZE = 10;
    const [detailLine, setDetailLine] = useState(null);

    const fetchPendingLines = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            params.set('page', '1');
            params.set('limit', '500');
            if (search.trim()) params.set('search', search.trim());
            if (statusFilter && statusFilter !== 'All') params.set('productionStatus', statusFilter);

            const res = await axiosInstance.get(`/work-orders/pending-production?${params.toString()}`);
            if (res.data?.success) {
                setLines(res.data.data || []);
                if (res.data.summary) {
                    setSummary(res.data.summary);
                    if (onCountChange) onCountChange(res.data.summary.linesPending || 0);
                }
            }
        } catch (err) {
            console.error('Failed to fetch pending production lines:', err);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, refreshKey, onCountChange]);

    useEffect(() => {
        setPlanningPage(1);
    }, [search, statusFilter]);

    useEffect(() => {
        fetchPendingLines();
    }, [fetchPendingLines]);

    const filteredPlanningRows = lines;
    const totalPlanningRecords = filteredPlanningRows.length;
    const totalPlanningPages = Math.max(1, Math.ceil(totalPlanningRecords / PAGE_SIZE));
    const safePlanningPage = Math.min(planningPage, totalPlanningPages);
    const startIdx = (safePlanningPage - 1) * PAGE_SIZE;
    const paginatedPlanningRows = filteredPlanningRows.slice(startIdx, startIdx + PAGE_SIZE);

    const handleExportCsv = () => {
        if (!lines.length) return;
        const headers = [
            'SO Number',
            'Customer',
            'Finished Bag Code',
            'Finished Bag Name',
            'Ordered Qty',
            'Ordered Unit',
            'Planned Qty',
            'Remaining to Plan',
            'FG Stock',
            'Delivery Due',
            'Production Status'
        ];
        const rows = lines.map((l) => [
            `"${l.soNumber || ''}"`,
            `"${(l.customer?.companyName || l.customer?.name || '').replace(/"/g, '""')}"`,
            `"${l.finishedGood?.code || ''}"`,
            `"${(l.finishedGood?.name || '').replace(/"/g, '""')}"`,
            l.orderedQuantity || 0,
            `"${l.orderedUnit || 'Pcs'}"`,
            l.plannedQuantity || 0,
            l.remainingQuantity || 0,
            l.fgCurrentStock || 0,
            `"${formatDate(l.deliveryDue)}"`,
            `"${l.productionStatus || 'Not Planned'}"`
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', `Pending_For_Production_${Date.now()}.csv`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    return (
        <div className="space-y-4 font-sans">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-card-bg border border-border rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Lines Pending</span>
                        <span className="text-lg font-black font-mono text-text-main mt-0.5 block">
                            {summary.linesPending.toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-600">
                        <Layers size={18} />
                    </div>
                </div>

                <div className="bg-card-bg border border-border rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Total Qty Pending</span>
                        <span className="text-lg font-black font-mono text-primary mt-0.5 block">
                            {summary.totalQuantityPending.toLocaleString('en-IN')} Bags
                        </span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                        <Package size={18} />
                    </div>
                </div>

                <div className="bg-card-bg border border-border rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Overdue Orders</span>
                        <span className={`text-lg font-black font-mono mt-0.5 block ${summary.overdueOrders > 0 ? 'text-rose-600' : 'text-text-main'}`}>
                            {summary.overdueOrders.toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-600">
                        <AlertTriangle size={18} />
                    </div>
                </div>

                <div className="bg-card-bg border border-border rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Orders Without WO Yet</span>
                        <span className="text-lg font-black font-mono text-text-main mt-0.5 block">
                            {summary.ordersWithoutWo.toLocaleString('en-IN')}
                        </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600">
                        <Clock size={18} />
                    </div>
                </div>
            </div>

            {/* Filter & Export Toolbar */}
            <div className="bg-card-bg border border-border rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search SO#, Customer, or Bag Spec..."
                            className="w-full pl-8 pr-3 py-1.5 bg-app-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="border border-border rounded-lg px-2.5 py-1.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                    >
                        <option value="All">All Production Statuses</option>
                        <option value="Not Planned">Not Planned</option>
                        <option value="Partially Planned">Partially Planned</option>
                        <option value="In Production">In Production</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={lines.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg hover:bg-border/30 border border-border rounded-lg text-xs font-bold text-text-main transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={fetchPendingLines}
                        className="p-1.5 bg-app-bg hover:bg-border/30 border border-border rounded-lg text-text-muted hover:text-text-main transition-colors cursor-pointer"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-table-header-bg border-b border-border text-[10px] font-bold uppercase tracking-wider text-table-header-text">
                                <th className="p-3">SO Number</th>
                                <th className="p-3">Customer</th>
                                <th className="p-3">Finished Bag</th>
                                <th className="p-3 text-right">Ordered</th>
                                <th className="p-3 text-right">Planned</th>
                                <th className="p-3 text-right">Remaining to Plan</th>
                                <th className="p-3">FG Stock</th>
                                <th className="p-3">Delivery Due</th>
                                <th className="p-3">Production Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="p-10 text-center text-text-muted">
                                        <RefreshCw size={18} className="animate-spin inline mr-2 text-primary" />
                                        Loading pending Sales Order lines...
                                    </td>
                                </tr>
                            ) : paginatedPlanningRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-10 text-center text-text-muted">
                                        All confirmed Sales Orders are fully planned for production!
                                    </td>
                                </tr>
                            ) : (
                                paginatedPlanningRows.map((line) => {
                                    const badgeCls = PROD_STATUS_BADGE[line.productionStatus] || PROD_STATUS_BADGE['Not Planned'];
                                    const stockCovers = line.fgCurrentStock >= line.remainingQuantity;
                                    return (
                                        <tr key={line._id} className="hover:bg-app-bg/50 transition-colors">
                                            <td className="p-3 whitespace-nowrap">
                                                <span className="font-mono font-bold text-primary">{line.soNumber}</span>
                                                <span className="block text-[10px] text-text-muted">
                                                    Line {line.lineIndex} of {line.totalLines}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-text-main">{line.customer?.companyName || line.customer?.name || '-'}</div>
                                                {line.customer?.code && (
                                                    <span className="text-[10px] font-mono text-text-muted">{line.customer.code}</span>
                                                )}
                                            </td>
                                            <td className="p-3 max-w-[260px]">
                                                <div className="font-mono text-[10.5px] font-bold text-primary">{line.finishedGood?.code}</div>
                                                <div className="font-semibold text-text-main whitespace-normal break-words line-clamp-2">
                                                    {line.finishedGood?.name}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-mono whitespace-nowrap">
                                                <span className="font-semibold text-text-main">
                                                    {line.orderedQuantity.toLocaleString('en-IN')} {line.orderedUnit}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono whitespace-nowrap text-text-muted">
                                                {line.plannedQuantity.toLocaleString('en-IN')}
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono font-extrabold">
                                                    {line.remainingQuantity.toLocaleString('en-IN')} {['Pcs', 'Bags'].includes(line.orderedUnit) ? line.orderedUnit : 'Bags'}
                                                </span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className={`font-mono font-bold ${stockCovers ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                    {stockCovers ? `Stock available: ${line.fgCurrentStock.toLocaleString('en-IN')}` : `${line.fgCurrentStock.toLocaleString('en-IN')} in stock`}
                                                </div>
                                                {!stockCovers && (
                                                    <span className="text-[10px] font-semibold text-rose-600 block">
                                                        Shortfall: {line.shortfall.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className="font-mono font-semibold text-text-main block">
                                                    {formatDate(line.deliveryDue)}
                                                </span>
                                                {line.isOverdue && (
                                                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                        Overdue
                                                    </span>
                                                )}
                                                {line.isDueSoon && (
                                                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                        Due Soon
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}>
                                                    {line.productionStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailLine(line)}
                                                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                                                        title="View SO & Linked Work Orders"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!canCreateWo}
                                                        onClick={() => canCreateWo && onCreateWorkOrderFromLine?.(line)}
                                                        title={canCreateWo ? 'Create Work Order for this SO line' : 'Requires PRODUCTION create permission'}
                                                        className="px-2.5 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                                                    >
                                                        <Plus size={12} />
                                                        <span>Create Work Order</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPlanningRecords > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-semibold text-slate-800">{startIdx + 1}</span> to{" "}
                            <span className="font-semibold text-slate-800">{Math.min(startIdx + PAGE_SIZE, totalPlanningRecords)}</span> of{" "}
                            <span className="font-semibold text-slate-800">{totalPlanningRecords}</span> records
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPlanningPage((p) => Math.max(1, p - 1))}
                                disabled={safePlanningPage === 1}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Prev</span>
                            </button>
                            <span className="text-xs font-semibold text-slate-800">
                                Page {safePlanningPage} of {totalPlanningPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPlanningPage((p) => Math.min(totalPlanningPages, p + 1))}
                                disabled={safePlanningPage === totalPlanningPages}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <span>Next</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Line Details & Linked Work Orders Modal */}
            {detailLine && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setDetailLine(null)}>
                    <div className="bg-card-bg border border-border rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4 font-sans text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between pb-3 border-b border-border">
                            <div>
                                <span className="font-mono font-extrabold text-sm text-primary">{detailLine.soNumber}</span>
                                <h3 className="font-bold text-text-main mt-0.5">
                                    {detailLine.customer?.companyName || detailLine.customer?.name}
                                </h3>
                            </div>
                            <button type="button" onClick={() => setDetailLine(null)} className="p-1 rounded hover:bg-app-bg text-text-muted cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-app-bg border border-border rounded-lg p-3 space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Finished Bag:</span>
                                <span className="font-bold text-text-main">{detailLine.finishedGood?.code} - {detailLine.finishedGood?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Order Date / Due Date:</span>
                                <span className="font-mono font-semibold text-text-main">
                                    {formatDate(detailLine.orderDate)} → {formatDate(detailLine.deliveryDue)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Ordered / Planned / Remaining:</span>
                                <span className="font-mono font-bold text-primary">
                                    {detailLine.orderedQuantity} {detailLine.orderedUnit} / {detailLine.plannedQuantity} / {detailLine.remainingQuantity}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-bold uppercase tracking-wider text-[10px] text-text-muted">
                                Linked Work Orders ({detailLine.linkedWorkOrders?.length || 0})
                            </h4>
                            {!detailLine.linkedWorkOrders || detailLine.linkedWorkOrders.length === 0 ? (
                                <p className="text-text-muted italic py-2">No Work Orders created for this line yet.</p>
                            ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {detailLine.linkedWorkOrders.map((wo) => (
                                        <div key={wo._id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-app-bg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDetailLine(null);
                                                    onViewWorkOrder?.(wo._id);
                                                }}
                                                className="font-mono font-bold text-primary hover:underline cursor-pointer"
                                            >
                                                {wo.workOrderNumber}
                                            </button>
                                            <span className="font-mono text-text-main">{Number(wo.targetQuantity || 0).toLocaleString('en-IN')} Bags</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                {wo.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setDetailLine(null)}
                                className="px-3.5 py-2 border border-border rounded-lg font-semibold text-text-muted hover:text-text-main cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                disabled={!canCreateWo}
                                title={canCreateWo ? 'Create Work Order for this SO line' : 'Requires PRODUCTION create permission'}
                                onClick={() => {
                                    if (!canCreateWo) return;
                                    const target = detailLine;
                                    setDetailLine(null);
                                    onCreateWorkOrderFromLine?.(target);
                                }}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} />
                                <span>Create Work Order</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
