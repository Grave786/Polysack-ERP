import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import {
    CheckSquare,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    RefreshCw,
    Eye,
    Check,
    X,
    AlertCircle,
    User,
    Calendar,
    FileText,
    Layers,
    Building2,
    Phone,
    Mail,
    Ban
} from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { useAuthStore } from '../store/authStore';
import { isTenantAdmin } from '../utils/permissionUtils';
import toast from 'react-hot-toast';

// ── IST Date Formatting Helpers (Strictly NO toISOString) ─────────────────────
const formatISTDate = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatISTDateTime = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const getWaitingTime = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
};

export default function ApprovalsPage() {
    const user = useAuthStore((state) => state.user);
    const isAdmin = isTenantAdmin(user);

    if (!isAdmin) {
        return <Navigate to="/403" state={{ message: "Only Tenant Admin can access the Approvals module." }} replace />;
    }

    const canDecide = true;

    const [searchParams, setSearchParams] = useSearchParams();
    const highlightId = searchParams.get('id') || '';

    const [activeTab, setActiveTab] = useState('Pending'); // 'Pending' | 'Approved' | 'Rejected'
    const [approvals, setApprovals] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

    // Modals state
    const [rejectModalRecord, setRejectModalRecord] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [isSubmittingReject, setIsSubmittingReject] = useState(false);
    const [cancelModalData, setCancelModalData] = useState({ isOpen: false, requestId: null, requestCode: '' });

    const [viewRecord, setViewRecord] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // ── Fetch Approvals from Server ──────────────────────────────────────────
    const fetchApprovals = useCallback(async (pageToLoad = 1) => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            params.set('page', String(pageToLoad));
            params.set('limit', '20');

            if (activeTab !== 'All') {
                params.set('status', activeTab);
            }

            if (typeFilter !== 'All') params.set('type', typeFilter);
            if (searchQuery.trim()) params.set('search', searchQuery.trim());

            const res = await axiosInstance.get(`/approvals?${params.toString()}`);
            if (res.data?.success) {
                setApprovals(res.data.data || []);
                setPendingCount(res.data.pendingCount || 0);
                if (res.data.pagination) {
                    setPagination(res.data.pagination);
                }
            }
        } catch (err) {
            console.error('Failed to load approvals:', err);
            toast.error(err.response?.data?.message || 'Failed to load approvals');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, typeFilter, searchQuery]);

    // Initial load and URL param handle
    useEffect(() => {
        fetchApprovals(1);
    }, [fetchApprovals]);

    // ── Open View Details Modal with full populated reference ────────────────
    const handleOpenView = async (record) => {
        setViewRecord(record);
        try {
            const res = await axiosInstance.get(`/approvals/${record._id}`);
            if (res.data?.success && res.data.data) {
                setViewRecord(res.data.data);
            }
        } catch (err) {
            // Keep existing shallow record if detail fetch fails
        }
    };

    // If an id param was in the URL, open its details once data loads
    useEffect(() => {
        if (highlightId && approvals.length > 0) {
            const matched = approvals.find((a) => a._id === highlightId);
            if (matched) {
                handleOpenView(matched);
            } else {
                // Fetch directly by ID if not in current tab list
                axiosInstance.get(`/approvals/${highlightId}`)
                    .then((res) => {
                        if (res.data?.data) {
                            setViewRecord(res.data.data);
                        }
                    })
                    .catch(() => {});
            }
        }
    }, [highlightId, approvals]);

    // ── Decision Handlers ───────────────────────────────────────────────────
    const triggerGlobalCountSync = () => {
        window.dispatchEvent(new CustomEvent('approval-count-changed'));
        window.dispatchEvent(new CustomEvent('notification-read'));
    };

    const handleApprove = async (record, remarks = 'Approved') => {
        try {
            setIsActionLoading(true);
            const res = await axiosInstance.post(`/approvals/${record._id}/approve`, { remarks });
            if (res.data?.success) {
                toast.success(`Approval ${record.approvalNo} approved successfully!`);
                triggerGlobalCountSync();
                setViewRecord(null);
                fetchApprovals(pagination.page);
            }
        } catch (err) {
            console.error('Approve failed:', err);
            toast.error(err.response?.data?.message || 'Failed to approve request');
            fetchApprovals(pagination.page);
        } finally {
            setIsActionLoading(false);
        }
    };

    const openRejectModal = (record) => {
        setRejectModalRecord(record);
        setRejectRemarks('');
    };

    const handleConfirmReject = async (e) => {
        if (e) e.preventDefault();
        if (!rejectRemarks.trim()) {
            toast.error('Remarks are mandatory when rejecting.');
            return;
        }

        try {
            setIsSubmittingReject(true);
            const res = await axiosInstance.post(`/approvals/${rejectModalRecord._id}/reject`, {
                remarks: rejectRemarks.trim()
            });
            if (res.data?.success) {
                toast.success(`Approval ${rejectModalRecord.approvalNo} rejected.`);
                triggerGlobalCountSync();
                setRejectModalRecord(null);
                setViewRecord(null);
                fetchApprovals(pagination.page);
            }
        } catch (err) {
            console.error('Reject failed:', err);
            toast.error(err.response?.data?.message || 'Failed to reject request');
            fetchApprovals(pagination.page);
        } finally {
            setIsSubmittingReject(false);
        }
    };

    const handleCancel = (record) => {
        setCancelModalData({
            isOpen: true,
            requestId: record._id,
            requestCode: record.approvalNo
        });
    };

    const handleConfirmCancel = async () => {
        if (!cancelModalData.requestId) return;

        try {
            setIsActionLoading(true);
            const res = await axiosInstance.post(`/approvals/${cancelModalData.requestId}/cancel`, {
                remarks: 'Cancelled by requester'
            });
            if (res.data?.success) {
                toast.success(`Request ${cancelModalData.requestCode || ''} cancelled.`);
                triggerGlobalCountSync();
                setCancelModalData({ isOpen: false, requestId: null, requestCode: '' });
                setViewRecord(null);
                fetchApprovals(pagination.page);
            }
        } catch (err) {
            console.error('Cancel failed:', err);
            toast.error(err.response?.data?.message || 'Failed to cancel request');
        } finally {
            setIsActionLoading(false);
        }
    };

    // ── Status Badge ────────────────────────────────────────────────────────
    const renderStatusBadge = (status) => {
        if (status === 'Pending') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
                    <Clock size={11} className="animate-spin text-amber-600" /> Pending
                </span>
            );
        }
        if (status === 'Approved') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 size={11} className="text-emerald-600" /> Approved
                </span>
            );
        }
        if (status === 'Rejected') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                    <XCircle size={11} className="text-rose-600" /> Rejected
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                <Ban size={11} /> Cancelled
            </span>
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 font-sans min-h-screen">
            {/* ── Top Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/20 text-primary-light rounded-xl">
                            <CheckSquare size={20} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-text-main tracking-tight flex items-center gap-2">
                                Central Approvals & Governance
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
                                        {pendingCount} Pending
                                    </span>
                                )}
                            </h1>
                            <p className="text-xs text-text-muted">
                                Multi-level tenant approval workflow with periodic reminder scheduler
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => fetchApprovals(pagination.page)}
                        disabled={isLoading}
                        className="px-3 py-2 bg-card-bg border border-border text-text-muted hover:text-text-main rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Refresh List"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* ── Tabs & Search Filter ─────────────────────────────────────────── */}
            <div className="bg-card-bg border border-border rounded-xl p-3 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 border-b sm:border-b-0 border-border pb-2 sm:pb-0 overflow-x-auto">
                        {[
                            { key: 'Pending', label: 'Pending', count: pendingCount },
                            { key: 'Approved', label: 'Approved' },
                            { key: 'Rejected', label: 'Rejected' }
                        ].map((t) => {
                            const isSelected = activeTab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => {
                                        setActiveTab(t.key);
                                    }}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${isSelected
                                        ? 'bg-primary text-sidebar-bg shadow-xs'
                                        : 'text-text-muted hover:text-text-main hover:bg-app-bg'
                                    }`}
                                >
                                    <span>{t.label}</span>
                                    {t.key === 'Pending' && pendingCount > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isSelected ? 'bg-sidebar-bg text-primary' : 'bg-rose-600 text-white'}`}>
                                            {pendingCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Filter / Search Controls */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                        <div className="relative min-w-[200px] w-full sm:w-auto">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Search ref, no, title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-app-bg border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-app-bg border border-border rounded-lg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="All">All Types</option>
                            <option value="NSL">NSL (Sales Lead)</option>
                            <option value="PO">PO (Purchase Order)</option>
                            <option value="CONTINUATION_WO">Continuation WO</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Approvals Table ──────────────────────────────────────────────── */}
            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-app-bg border-b border-border text-[11px] font-extrabold uppercase tracking-wider text-text-muted select-none">
                                <th className="py-3 px-4">Approval No</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-4">Reference</th>
                                <th className="py-3 px-4">Summary</th>
                                <th className="py-3 px-4">Requested By</th>
                                <th className="py-3 px-4">Requested On</th>
                                <th className="py-3 px-4">Waiting</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-text-muted">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw size={16} className="animate-spin text-primary" />
                                            <span>Loading approval requests...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : approvals.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-text-muted">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <CheckCircle2 size={32} className="text-emerald-500 opacity-60" />
                                            <span className="font-bold text-text-main">No approval requests found</span>
                                            <span className="text-[11px] text-text-muted">
                                                {activeTab === 'Pending' ? 'All approvals are up-to-date!' : 'No records match the current filter.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                approvals.map((row) => {
                                    const isHighlighted = row._id === highlightId;
                                    const isRequester = String(row.requestedBy?._id || row.requestedBy) === String(user?._id);

                                    return (
                                        <tr
                                            key={row._id}
                                            className={`hover:bg-app-bg/50 transition-colors ${isHighlighted ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                                        >
                                            <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                                                {row.approvalNo}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-mono font-semibold text-text-main whitespace-nowrap">
                                                {row.referenceNo || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-text-main max-w-xs truncate" title={row.summary || row.title}>
                                                {row.summary || row.title}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="leading-tight">
                                                    <div className="font-bold text-text-main">{row.requestedBy?.name || 'Staff'}</div>
                                                    <div className="text-[10px] text-text-muted">{row.requestedBy?.role?.name || 'Executive'}</div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-text-main">
                                                {formatISTDate(row.createdAt)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-text-muted text-[11px] font-semibold">
                                                {row.status === 'Pending' ? getWaitingTime(row.createdAt) : '-'}
                                                {row.reminderCount > 0 && row.status === 'Pending' && (
                                                    <span className="ml-1 text-[10px] text-amber-700 font-extrabold">
                                                        (R#{row.reminderCount})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {renderStatusBadge(row.status)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-right">
                                                <div className="inline-flex items-center gap-1.5 justify-end">
                                                    {/* View button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenView(row)}
                                                        className="p-1.5 text-text-muted hover:text-sky-600 rounded-md hover:bg-sky-50 transition-colors cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        <Eye size={14} />
                                                    </button>

                                                    {/* Approve button (for Pending & canDecide) */}
                                                    {row.status === 'Pending' && canDecide && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(row)}
                                                            disabled={isActionLoading}
                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-extrabold flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                                            title="Approve"
                                                        >
                                                            <Check size={12} />
                                                            <span>Approve</span>
                                                        </button>
                                                    )}

                                                    {/* Reject button (for Pending & canDecide) */}
                                                    {row.status === 'Pending' && canDecide && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openRejectModal(row)}
                                                            disabled={isActionLoading}
                                                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-extrabold flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                                            title="Reject with remarks"
                                                        >
                                                            <X size={12} />
                                                            <span>Reject</span>
                                                        </button>
                                                    )}

                                                    {/* Cancel button (for Requester while Pending) */}
                                                    {row.status === 'Pending' && isRequester && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancel(row)}
                                                            disabled={isActionLoading}
                                                            className="p-1.5 text-text-muted hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                                            title="Cancel Request"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                    )}
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
                {pagination.pages > 1 && (
                    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
                        <span>
                            Showing page {pagination.page} of {pagination.pages} ({pagination.total} records)
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={pagination.page <= 1}
                                onClick={() => fetchApprovals(pagination.page - 1)}
                                className="px-2.5 py-1 border border-border rounded bg-app-bg hover:text-text-main disabled:opacity-40 cursor-pointer"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => fetchApprovals(pagination.page + 1)}
                                className="px-2.5 py-1 border border-border rounded bg-app-bg hover:text-text-main disabled:opacity-40 cursor-pointer"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Modal 1: Reject with Mandatory Remarks ─────────────────────── */}
            {rejectModalRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
                    <div className="fixed inset-0" onClick={() => setRejectModalRecord(null)} />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 bg-rose-950/30 text-rose-400 border-b border-rose-900/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle size={18} className="text-rose-500" />
                                <h3 className="text-sm font-extrabold text-text-main">
                                    Reject Approval Request
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRejectModalRecord(null)}
                                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReject} className="p-5 space-y-4 text-xs">
                            <div>
                                <div className="text-text-muted mb-1">
                                    Rejecting: <span className="font-mono font-bold text-text-main">{rejectModalRecord.approvalNo}</span> ({rejectModalRecord.referenceNo})
                                </div>
                                <div className="text-[11px] text-text-muted mb-3">
                                    {rejectModalRecord.summary}
                                </div>

                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Rejection Reason / Mandatory Remarks *
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Enter mandatory reason for rejection (e.g. Unviable pricing, customer credit check failed, incorrect delivery commitment...)"
                                    value={rejectRemarks}
                                    onChange={(e) => setRejectRemarks(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 resize-y"
                                />
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setRejectModalRecord(null)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingReject || !rejectRemarks.trim()}
                                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <X size={14} />
                                    <span>{isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Modal: Confirm Cancel Request ───────────────────────────── */}
            {cancelModalData.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
                    <div className="fixed inset-0" onClick={() => setCancelModalData({ isOpen: false, requestId: null, requestCode: '' })} />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 bg-slate-900/30 text-text-main border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={18} className="text-amber-500" />
                                <h3 className="text-sm font-extrabold text-text-main">
                                    Cancel Approval Request
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCancelModalData({ isOpen: false, requestId: null, requestCode: '' })}
                                className="p-1 text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <p className="text-text-muted">
                                Are you sure you want to cancel request <strong className="font-mono text-text-main font-bold">{cancelModalData.requestCode}</strong>? This action cannot be undone.
                            </p>

                            <div className="pt-3 border-t border-border flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setCancelModalData({ isOpen: false, requestId: null, requestCode: '' })}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer"
                                >
                                    No, Keep It
                                </button>
                                <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={handleConfirmCancel}
                                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Ban size={14} />
                                    <span>{isActionLoading ? 'Cancelling...' : 'Yes, Cancel Request'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Modal 2: View Full Approval & NSL Details ──────────────────── */}
            {viewRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
                    <div className="fixed inset-0" onClick={() => setViewRecord(null)} />
                    <div className="relative z-10 w-full max-w-2xl bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
                        <div className="px-5 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-primary/20 text-primary-light rounded-xl">
                                    <CheckSquare size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-extrabold text-sidebar-text-active flex items-center gap-2">
                                        <span>{viewRecord.approvalNo}</span>
                                        <span className="text-xs font-normal text-sidebar-text">({viewRecord.referenceNo})</span>
                                    </h3>
                                    <p className="text-[11px] text-sidebar-text">
                                        Approval Type: {viewRecord.type} • Requested by {viewRecord.requestedBy?.name || 'Staff'} on {formatISTDateTime(viewRecord.createdAt)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewRecord(null)}
                                className="p-1.5 text-sidebar-text hover:text-white rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans flex-1">
                            {/* Status & Timing Banner */}
                            <div className="p-3 bg-app-bg border border-border rounded-xl flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-text-muted font-bold">Current Status:</span>
                                    {renderStatusBadge(viewRecord.status)}
                                </div>
                                {viewRecord.decidedAt && (
                                    <div className="text-[11px] text-text-muted">
                                        Decided by <span className="font-bold text-text-main">{viewRecord.decidedBy?.name || 'Admin'}</span> on {formatISTDateTime(viewRecord.decidedAt)}
                                    </div>
                                )}
                            </div>

                            {/* Remarks / Rejection Reason Banner if decided */}
                            {viewRecord.remarks && (
                                <div className={`p-3 rounded-xl border text-xs ${viewRecord.status === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                                    <span className="font-extrabold uppercase tracking-wider block text-[10px] mb-0.5">
                                        {viewRecord.status === 'Rejected' ? 'Rejection Reason' : 'Decision Remarks'}:
                                    </span>
                                    <p className="font-semibold">{viewRecord.remarks}</p>
                                </div>
                            )}

                            {/* PO Reference Details */}
                            {viewRecord.type === 'PO' && viewRecord.referenceId && (
                                <div className="space-y-3">
                                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-text-muted border-b border-border pb-1">
                                        Purchase Order Details
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg p-3.5 rounded-xl border border-border">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Supplier</span>
                                            <span className="font-extrabold text-text-main text-sm">
                                                {viewRecord.referenceId.supplier?.companyName || viewRecord.referenceId.supplier?.name || 'Assigned Supplier'}
                                            </span>
                                            {(viewRecord.referenceId.supplier?.contactPerson || viewRecord.referenceId.supplier?.phone) && (
                                                <div className="text-[11px] text-text-muted">
                                                    {viewRecord.referenceId.supplier?.contactPerson} {viewRecord.referenceId.supplier?.phone ? `(${viewRecord.referenceId.supplier?.phone})` : ''}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Total Order Value</span>
                                            <span className="font-mono font-extrabold text-primary text-sm">
                                                ₹{Number(viewRecord.referenceId.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">PO Date</span>
                                            <span className="font-mono text-text-main font-semibold">
                                                {formatISTDate(viewRecord.referenceId.poDate || viewRecord.referenceId.createdAt)}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Expected Delivery</span>
                                            <span className="font-mono text-text-main font-semibold">
                                                {formatISTDate(viewRecord.referenceId.expectedDelivery)}
                                            </span>
                                        </div>

                                        {viewRecord.referenceId.deliveryLocation && (
                                            <div className="sm:col-span-2">
                                                <span className="text-[10px] uppercase font-bold text-text-muted block">Delivery Location</span>
                                                <span className="text-text-main font-semibold">
                                                    {viewRecord.referenceId.deliveryLocation?.name || viewRecord.referenceId.deliveryLocation?.code || '-'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Items Table */}
                                    {Array.isArray(viewRecord.referenceId.items) && viewRecord.referenceId.items.length > 0 && (
                                        <div className="bg-app-bg rounded-xl border border-border overflow-hidden">
                                            <div className="px-3 py-2 bg-card-bg border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                                Purchased Materials ({viewRecord.referenceId.items.length})
                                            </div>
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-border text-[10px] uppercase text-text-muted font-bold">
                                                        <th className="py-1.5 px-3">Item / Material</th>
                                                        <th className="py-1.5 px-3">Qty</th>
                                                        <th className="py-1.5 px-3">Rate (₹)</th>
                                                        <th className="py-1.5 px-3 text-right">Amount (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {viewRecord.referenceId.items.map((it, idx) => (
                                                        <tr key={idx} className="hover:bg-card-bg/40">
                                                            <td className="py-1.5 px-3 font-semibold text-text-main">
                                                                {it.rawMaterial?.name || it.rawMaterial?.code || 'Raw Material'}
                                                            </td>
                                                            <td className="py-1.5 px-3 font-mono">
                                                                {it.orderedQuantity} {it.unit || 'Kg'}
                                                            </td>
                                                            <td className="py-1.5 px-3 font-mono">
                                                                ₹{Number(it.ratePerUnit || 0).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="py-1.5 px-3 font-mono text-right font-bold">
                                                                ₹{Number((it.orderedQuantity || 0) * (it.ratePerUnit || 0)).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {viewRecord.referenceId.notes && (
                                        <div className="bg-app-bg p-3 rounded-xl border border-border">
                                            <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Notes & Terms</span>
                                            <p className="text-xs text-text-main whitespace-pre-wrap font-sans">
                                                {viewRecord.referenceId.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* NSL Reference Details */}
                            {viewRecord.type === 'NSL' && viewRecord.referenceId && (
                                <div className="space-y-3">
                                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-text-muted border-b border-border pb-1">
                                        Order Enquiry / Sales Lead Details
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg p-3.5 rounded-xl border border-border">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Customer / Prospect</span>
                                            <span className="font-extrabold text-text-main text-sm">
                                                {viewRecord.referenceId.newCustomerDetails?.company || viewRecord.referenceId.customer?.companyName || viewRecord.referenceId.customer?.name || viewRecord.referenceId.newCustomerDetails?.name || 'Prospect'}
                                            </span>
                                            {(viewRecord.referenceId.customer?.code || viewRecord.referenceId.newCustomerDetails?.phone) && (
                                                <div className="text-[11px] text-text-muted">
                                                    {viewRecord.referenceId.customer?.code || viewRecord.referenceId.newCustomerDetails?.phone}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Product Category</span>
                                            <span className="font-extrabold text-text-main">
                                                {viewRecord.referenceId.productCategory || 'N/A'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Total Quantity</span>
                                            <span className="font-mono font-bold text-text-main">
                                                {viewRecord.referenceId.totalOrderQuantity != null ? viewRecord.referenceId.totalOrderQuantity.toLocaleString('en-IN') : '-'} {viewRecord.referenceId.quantityUnit || 'Kg'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Fabric & Lamination</span>
                                            <span className="font-semibold text-text-main">
                                                {[viewRecord.referenceId.materialQualityFabric, viewRecord.referenceId.fabricLaminationType].filter(Boolean).join(' | ') || '-'}
                                            </span>
                                        </div>

                                        {viewRecord.referenceId.fabricGrammage && (
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-text-muted block">Grammage & Specs</span>
                                                <span className="text-text-main font-semibold">
                                                    {viewRecord.referenceId.fabricGrammage} GSM {viewRecord.referenceId.fabricWidthInch && viewRecord.referenceId.fabricLengthInch ? `(${viewRecord.referenceId.fabricWidthInch}" x ${viewRecord.referenceId.fabricLengthInch}")` : ''}
                                                </span>
                                            </div>
                                        )}

                                        {viewRecord.referenceId.expectedDeliveryDate && (
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-text-muted block">Expected Delivery</span>
                                                <span className="font-mono text-text-main font-semibold">
                                                    {formatISTDate(viewRecord.referenceId.expectedDeliveryDate)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {(viewRecord.referenceId.description || viewRecord.referenceId.remarks) && (
                                        <div className="bg-app-bg p-3 rounded-xl border border-border">
                                            <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Requirement Notes & Specs</span>
                                            <p className="text-xs text-text-main whitespace-pre-wrap font-sans">
                                                {viewRecord.referenceId.description || viewRecord.referenceId.remarks}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Continuation WO Reference Details */}
                            {viewRecord.type === 'CONTINUATION_WO' && viewRecord.referenceId && (
                                <div className="space-y-3">
                                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-text-muted border-b border-border pb-1">
                                        Continuation Work Order Request Details
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg p-3.5 rounded-xl border border-border">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Original Work Order</span>
                                            <span className="font-mono font-extrabold text-primary text-sm">
                                                {viewRecord.referenceId.workOrderNumber || viewRecord.referenceNo}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Customer</span>
                                            <span className="font-extrabold text-text-main">
                                                {viewRecord.referenceId.customer?.companyName || viewRecord.referenceId.customer?.name || 'Assigned Customer'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Finished Good</span>
                                            <span className="font-bold text-text-main">
                                                {viewRecord.referenceId.finishedGood?.name || viewRecord.referenceId.finishedGood?.code || 'Finished Good'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Pending Balance to Produce</span>
                                            <span className="font-mono font-extrabold text-rose-600 text-sm">
                                                {Number(viewRecord.referenceId.balanceQuantity || 0).toLocaleString('en-IN')} {viewRecord.referenceId.unit || 'Bags'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Completed vs Original Target</span>
                                            <span className="font-mono text-text-main font-semibold">
                                                {Number(viewRecord.referenceId.completedQuantity || 0).toLocaleString('en-IN')} / {Number(viewRecord.referenceId.targetQuantity || 0).toLocaleString('en-IN')} {viewRecord.referenceId.unit || 'Bags'}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-text-muted block">Assigned Machine</span>
                                            <span className="text-text-main font-semibold">
                                                {viewRecord.referenceId.assignedMachine?.name || viewRecord.referenceId.assignedMachine?.code || 'None'}
                                            </span>
                                        </div>
                                    </div>

                                    {(viewRecord.referenceId.description || viewRecord.referenceId.remarks) && (
                                        <div className="bg-app-bg p-3 rounded-xl border border-border">
                                            <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Work Order Description & Remarks</span>
                                            <p className="text-xs text-text-main whitespace-pre-wrap font-sans">
                                                {viewRecord.referenceId.description || viewRecord.referenceId.remarks}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Action Bar */}
                        <div className="p-4 border-t border-border bg-app-bg flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => setViewRecord(null)}
                                className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                            >
                                Close
                            </button>

                            {viewRecord.status === 'Pending' && canDecide && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openRejectModal(viewRecord)}
                                        disabled={isActionLoading}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                                    >
                                        <X size={14} />
                                        <span>Reject Request</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApprove(viewRecord)}
                                        disabled={isActionLoading}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                                    >
                                        <Check size={14} />
                                        <span>Approve Request</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
