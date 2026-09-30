import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Edit3,
    Trash2,
    Calendar,
    User,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    X,
    FileText,
    TrendingUp,
    Ban,
    Info
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

/**
 * Format IST Date for display (e.g., "30 Sep 2026") without toISOString() timezone shift
 */
const formatIstDate = (dateVal) => {
    if (!dateVal) return '-';
    try {
        const d = (typeof dateVal === 'string' && dateVal.length === 10)
            ? new Date(`${dateVal}T00:00:00.000+05:30`)
            : new Date(dateVal);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(d);
    } catch {
        return String(dateVal);
    }
};

/**
 * Get current date string in IST YYYY-MM-DD
 */
const getIstTodayString = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};

/**
 * Format Date object / string to IST YYYY-MM-DD string
 */
const getIstDateString = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = (typeof dateVal === 'string' && dateVal.length === 10)
            ? new Date(`${dateVal}T00:00:00.000+05:30`)
            : new Date(dateVal);
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch {
        return String(dateVal);
    }
};

export default function OperatorWiseProductionTracker({
    workOrder = null,
    workOrderId = null,
    selectedStageName = null,
    onProductionLogged = null,
    readOnly = false
}) {
    const targetWoId = workOrder?._id || workOrderId;

    // Resolve current stage
    const activeStage = useMemo(() => {
        if (!workOrder?.stages) return null;
        if (selectedStageName) {
            return workOrder.stages.find((s) => s.stageName === selectedStageName) || workOrder.stages[0];
        }
        return workOrder.stages.find((s) => s.status === 'ACTIVE') || workOrder.stages[0];
    }, [workOrder, selectedStageName]);

    const currentStageName = activeStage?.stageName || selectedStageName || 'TAPE_EXTRUSION';

    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [shiftsList, setShiftsList] = useState([]);

    // Modal states
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingLogId, setDeletingLogId] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        operator: '',
        date: getIstTodayString(),
        quantity: '',
        shift: '',
        remarks: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Work order status checks
    const woStatus = String(workOrder?.status || summaryData?.workOrderStatus || '').toUpperCase();
    const isCancelledOrRejected = woStatus === 'CANCELLED' || woStatus === 'REJECTED';
    const isCompletedWO = woStatus === 'COMPLETED';

    // Fetch Summary & Matrix
    const fetchSummary = async () => {
        if (!targetWoId) return;
        try {
            setIsLoading(true);
            const res = await axiosInstance.get(`/work-orders/${targetWoId}/stages/${currentStageName}/logs/summary`);
            if (res.data?.success) {
                setSummaryData(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching production logs summary:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch available Shifts
    const fetchShifts = async () => {
        try {
            const res = await axiosInstance.get('/shifts');
            if (res.data?.success && Array.isArray(res.data.data)) {
                setShiftsList(res.data.data);
            }
        } catch (err) {
            // Non-critical, shift is optional
        }
    };

    useEffect(() => {
        fetchSummary();
        fetchShifts();
    }, [targetWoId, currentStageName]);

    // Dynamic metrics
    const stageTargetQty = Number(summaryData?.targetQuantity ?? summaryData?.stageTargetQuantity ?? 0);
    const workOrderOriginalTarget = Number(summaryData?.workOrderOriginalTarget ?? workOrder?.targetQuantity ?? 0);
    const isFirstActiveStage = summaryData?.isFirstActiveStage ?? true;
    const previousStage = summaryData?.previousStage ?? null;
    const isExceedingPreviousStage = summaryData?.isExceedingPreviousStage ?? false;

    const totalProduced = Number(summaryData?.totalProduced ?? 0);
    const remainingQty = Math.max(0, stageTargetQty - totalProduced);
    const hasNoTarget = stageTargetQty === 0 || summaryData?.hasNoTarget;
    const pct = stageTargetQty > 0 ? Math.min(100, Math.round((totalProduced / stageTargetQty) * 100)) : 0;

    // Detect legacy completed stage (0 logs AND [stage completed OR WO completed])
    const currentStageObj = summaryData?.stage || activeStage;
    const stageStatus = String(currentStageObj?.status || '').toUpperCase();
    const isStageCompleted = stageStatus === 'COMPLETED' || stageStatus === 'DONE';
    const hasZeroLogs = !summaryData?.logs || summaryData.logs.length === 0;
    const isLegacyCompletedStage = hasZeroLogs && (isStageCompleted || isCompletedWO);

    const legacyCompletedQuantity = Number(
        currentStageObj?.completedQuantity ??
        currentStageObj?.goodOutputQty ??
        activeStage?.completedQuantity ??
        activeStage?.goodOutputQty ??
        (currentStageObj?.sequence === 8 || activeStage?.sequence === 8 ? (workOrder?.completedQuantity || 0) : 0) ??
        summaryData?.totalProduced ??
        0
    );

    // Maximum allowed for current modal form (edit exclusion logic)
    const maxAllowedForForm = useMemo(() => {
        if (hasNoTarget) return 0;
        if (editingLog) {
            const currentEntryQty = Number(editingLog.quantity || 0);
            return remainingQty + currentEntryQty;
        }
        return remainingQty;
    }, [remainingQty, editingLog, hasNoTarget]);

    const enteredQtyNum = Number(formData.quantity || 0);
    const isOverRemaining = !hasNoTarget && enteredQtyNum > maxAllowedForForm;

    // Open Modal for Create (always fetch fresh totals)
    const handleOpenCreateModal = async () => {
        if (isLegacyCompletedStage) {
            toast.error('This stage was completed before operator-wise tracking was enabled.');
            return;
        }
        if (isCancelledOrRejected) {
            toast.error(`Cannot log production for a ${woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'} Work Order.`);
            return;
        }

        if (isCompletedWO) {
            toast.error('Cannot add new production for a Completed Work Order.');
            return;
        }

        if (hasNoTarget) {
            toast.error(isFirstActiveStage
                ? 'No target set on this Work Order yet.'
                : `Cannot log production: No good output produced yet from ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}.`);
            return;
        }

        await fetchSummary();
        const defaultOp = summaryData?.assignedOperators?.[0]?._id || '';
        setFormData({
            operator: defaultOp,
            date: getIstTodayString(),
            quantity: '',
            shift: '',
            remarks: ''
        });
        setEditingLog(null);
        setIsLogModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = async (log) => {
        if (isCancelledOrRejected) {
            toast.error(`Cannot edit production logs for a ${woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'} Work Order.`);
            return;
        }

        await fetchSummary();
        setEditingLog(log);
        setFormData({
            operator: log.operator?._id || log.operator || '',
            date: log.date ? (typeof log.date === 'string' && log.date.includes('T') ? log.date.split('T')[0] : getIstDateString(log.date)) : getIstTodayString(),
            quantity: log.quantity || '',
            shift: log.shift?._id || log.shift || '',
            remarks: log.remarks || log.notes || ''
        });
        setIsLogModalOpen(true);
    };

    // Handle Submit (Create or Update)
    const handleSubmitLog = async (e) => {
        e.preventDefault();
        if (isCancelledOrRejected) {
            toast.error(`Cannot log production for a ${woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'} Work Order.`);
            return;
        }

        if (hasNoTarget) {
            toast.error(isFirstActiveStage
                ? 'No target set on this Work Order yet.'
                : `Cannot log production: No good output produced yet from ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}.`);
            return;
        }

        const numQty = Number(formData.quantity);
        if (isNaN(numQty) || numQty <= 0) {
            toast.error('Please enter a valid quantity greater than 0.');
            return;
        }

        if (numQty > maxAllowedForForm) {
            const limitDesc = isFirstActiveStage
                ? 'Work Order target'
                : `available input from ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}`;
            toast.error(maxAllowedForForm === 0
                ? `Only 0 Bags remaining for this stage; ${limitDesc} already achieved.`
                : `Only ${maxAllowedForForm.toLocaleString('en-IN')} Bags remaining from ${limitDesc}. Reduce the quantity.`);
            return;
        }

        const todayStr = getIstTodayString();
        if (formData.date > todayStr) {
            toast.error('Production date cannot be in the future.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                operator: formData.operator || null,
                date: formData.date,
                quantity: numQty,
                shift: formData.shift || null,
                remarks: formData.remarks
            };

            let res;
            if (editingLog?._id) {
                res = await axiosInstance.put(
                    `/work-orders/${targetWoId}/stages/${currentStageName}/logs/${editingLog._id}`,
                    payload
                );
            } else {
                res = await axiosInstance.post(
                    `/work-orders/${targetWoId}/stages/${currentStageName}/logs`,
                    payload
                );
            }

            if (res.data?.success) {
                toast.success(editingLog ? 'Production entry updated successfully' : 'Production logged successfully');
                setIsLogModalOpen(false);
                setEditingLog(null);
                await fetchSummary();

                if (onProductionLogged) {
                    onProductionLogged();
                }
            }
        } catch (err) {
            console.error('Error saving production log:', err);
            toast.error(err.response?.data?.message || 'Failed to save production log');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Delete
    const handleDeleteLog = async (logId) => {
        if (!logId) return;
        if (isCancelledOrRejected) {
            toast.error(`Cannot delete production logs for a ${woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'} Work Order.`);
            return;
        }

        try {
            setIsDeleting(true);
            const res = await axiosInstance.delete(
                `/work-orders/${targetWoId}/stages/${currentStageName}/logs/${logId}`
            );
            if (res.data?.success) {
                toast.success('Production log deleted successfully');
                setDeletingLogId(null);
                await fetchSummary();

                if (onProductionLogged) {
                    onProductionLogged();
                }
            }
        } catch (err) {
            console.error('Error deleting production log:', err);
            toast.error(err.response?.data?.message || 'Failed to delete production log');
        } finally {
            setIsDeleting(false);
        }
    };

    const matrix = summaryData?.matrix || [];
    const byOperator = summaryData?.byOperator || [];
    const logs = summaryData?.logs || [];
    const assignedOperators = summaryData?.assignedOperators || [];

    // Distinct dates from matrix sorted ascending
    const distinctDates = useMemo(() => {
        return matrix.map((m) => m.date).sort();
    }, [matrix]);

    // Build map for cell lookups: `date_operatorId` -> quantity
    const cellMap = useMemo(() => {
        const map = {};
        matrix.forEach((m) => {
            const dateStr = m.date;
            (m.entries || []).forEach((entry) => {
                const key = `${dateStr}_${entry.operatorId}`;
                map[key] = entry.quantity;
            });
        });
        return map;
    }, [matrix]);

    return (
        <div className="space-y-4 font-sans">
            {/* Header / Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-bg border border-border p-3.5 rounded-xl">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                            Operator-wise & Day-wise Production Tracking
                        </h4>
                        <p className="text-[11px] text-text-muted">
                            Stage: <strong className="text-primary font-semibold">{currentStageName.replace(/_/g, ' ')}</strong>
                        </p>
                    </div>
                </div>

                {!readOnly && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={fetchSummary}
                            disabled={isLoading}
                            className="p-2 bg-card-bg border border-border hover:bg-app-bg text-text-muted hover:text-text-main rounded-lg text-xs transition-colors cursor-pointer"
                            title="Refresh logs"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        </button>

                        {isLegacyCompletedStage ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs" title="Stage completed before operator logging was activated">
                                <CheckCircle2 size={14} className="text-amber-600" />
                                <span>Completed (Legacy)</span>
                            </div>
                        ) : isCancelledOrRejected ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 border border-gray-300 rounded-lg text-xs font-bold cursor-not-allowed" title={`Work Order is ${woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'}`}>
                                <Ban size={14} />
                                <span>Logging Blocked ({woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'})</span>
                            </div>
                        ) : isCompletedWO ? (
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold cursor-not-allowed opacity-90" title="Work Order completed (Job Closed)">
                                <CheckCircle2 size={14} />
                                <span>Job Completed</span>
                            </div>
                        ) : hasNoTarget ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold cursor-not-allowed" title={isFirstActiveStage ? 'No target set on Work Order' : `Waiting for output from ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}`}>
                                <AlertTriangle size={14} />
                                <span>{isFirstActiveStage ? 'No Target Set (0 Bags)' : 'Waiting for Preceding Stage (0 Bags)'}</span>
                            </div>
                        ) : remainingQty === 0 ? (
                            <button
                                type="button"
                                disabled
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold cursor-not-allowed opacity-90"
                                title="Stage target fully achieved"
                            >
                                <CheckCircle2 size={14} />
                                <span>Target Achieved (100%)</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-2xs cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>+ Log Production</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Cancelled / Inactive Work Order Notice */}
            {isCancelledOrRejected && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                    <Ban size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold block uppercase tracking-wide text-[11px] text-rose-900">
                            Work Order is {woStatus === 'CANCELLED' ? 'Cancelled' : 'Rejected'}
                        </span>
                        <p className="mt-0.5 text-rose-700 font-medium">
                            Production logging, edits, and deletions are disabled for cancelled work orders.
                        </p>
                    </div>
                </div>
            )}

            {/* Mismatch Warning Banner if logged quantity exceeds dynamic available input */}
            {isExceedingPreviousStage && !isLegacyCompletedStage && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold block uppercase tracking-wide text-[11px] text-amber-900">
                            Logged Output Exceeds Previous Stage Available Input
                        </span>
                        <p className="mt-0.5 text-amber-800 font-medium">
                            Total logged output ({totalProduced.toLocaleString('en-IN')} Bags) is higher than the good output from the preceding stage ({stageTargetQty.toLocaleString('en-IN')} Bags available from {previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}). Please review and adjust individual production logs if needed.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Stage Metric View: Either Legacy Completed Notice OR 3 Metric Cards */}
            {isLegacyCompletedStage ? (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-950 flex items-start gap-3 shadow-2xs font-sans">
                    <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                            Legacy Completed Stage
                        </p>
                        <p className="text-xs text-amber-900 leading-relaxed">
                            This stage was completed before operator-wise tracking was enabled. Legacy completed quantity: <strong className="font-mono font-extrabold text-amber-950 text-sm">{legacyCompletedQuantity.toLocaleString('en-IN')} Bags</strong> (no per-operator breakdown available).
                        </p>
                    </div>
                </div>
            ) : (
                /* 3 Metric Cards for Active / Ongoing Stages */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Card 1: Stage Target (Available Input) */}
                    <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                                Stage Target / Available Input
                            </span>
                            <span className="text-[10px] bg-app-bg px-2 py-0.5 rounded border border-border font-mono text-text-muted">
                                WO: {workOrderOriginalTarget.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono text-text-main">
                                {stageTargetQty.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-text-muted">Bags</span>
                        </div>
                        <span className="text-[10px] text-text-muted mt-1 block leading-tight">
                            {isFirstActiveStage
                                ? 'Work Order Target (First Active Stage)'
                                : previousStage
                                ? `Limited by ${previousStage.stageName.replace(/_/g, ' ')}'s good output`
                                : 'Stage target allowance'}
                        </span>
                    </div>

                    {/* Card 2: Total Produced with % */}
                    <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                Total Produced
                            </span>
                            <span className="text-[11px] font-mono font-bold text-primary">
                                {pct}%
                            </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-xl font-bold font-mono text-primary">
                                {totalProduced.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-text-muted">Bags</span>
                        </div>
                        {/* Mini Progress Bar */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${remainingQty === 0 && stageTargetQty > 0 ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                            />
                        </div>
                    </div>

                    {/* Card 3: Remaining Quantity */}
                    <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Remaining Allowance
                        </span>
                        <div className="mt-1 flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold font-mono ${remainingQty === 0 && stageTargetQty > 0 ? 'text-emerald-600' : 'text-text-main'}`}>
                                {remainingQty.toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-text-muted">Bags</span>
                        </div>
                        <span className="text-[10px] text-text-muted mt-1 block">
                            {hasNoTarget
                                ? (isFirstActiveStage ? 'No target set on Work Order' : `Waiting for input from ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'}`)
                                : remainingQty === 0
                                ? 'Stage target fully achieved (0 remaining)'
                                : 'Remaining allowance for this stage'}
                        </span>
                    </div>
                </div>
            )}

            {/* Matrix Table: Operator × Distinct Dates */}
            <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                        <Calendar size={14} className="text-primary" />
                        <span>Daily Operator Matrix (Production Breakdown)</span>
                    </h5>
                    <span className="text-[10px] text-text-muted">
                        Horizontal scroll for multi-day logs
                    </span>
                </div>

                {distinctDates.length === 0 ? (
                    <div className="text-center py-8 text-text-muted space-y-1">
                        {isLegacyCompletedStage ? (
                            <>
                                <p className="text-xs font-semibold text-text-main">
                                    Historical stage record: {legacyCompletedQuantity.toLocaleString('en-IN')} Bags completed.
                                </p>
                                <p className="text-[11px] text-text-muted">
                                    No per-operator daily breakdown was captured for this stage.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-semibold">No daily production entries recorded yet for this stage.</p>
                                {!readOnly && !isCancelledOrRejected && !isCompletedWO && !hasNoTarget && remainingQty > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleOpenCreateModal}
                                        className="mt-2.5 text-xs text-primary font-bold hover:underline cursor-pointer"
                                    >
                                        + Record First Production Entry
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-border rounded-lg max-w-full">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                            <thead className="bg-table-header-bg text-table-header-text uppercase text-[10px] font-extrabold border-b border-border">
                                <tr>
                                    <th className="px-3.5 py-2.5 sticky left-0 bg-table-header-bg z-10 border-r border-border">
                                        Operator Name / Code
                                    </th>
                                    {distinctDates.map((dateStr) => (
                                        <th key={dateStr} className="px-3.5 py-2.5 text-center font-mono">
                                            {formatIstDate(dateStr)}
                                        </th>
                                    ))}
                                    <th className="px-3.5 py-2.5 text-right font-bold text-primary bg-table-header-bg border-l border-border">
                                        Total (Bags)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card-bg font-sans">
                                {byOperator.map((op) => {
                                    return (
                                        <tr key={op.operatorId} className="hover:bg-app-bg/50 transition-colors">
                                            <td className="px-3.5 py-2.5 font-semibold text-text-main sticky left-0 bg-card-bg z-10 border-r border-border">
                                                <div className="flex items-center gap-2">
                                                    <User size={13} className="text-text-muted shrink-0" />
                                                    <span>{op.operatorName}</span>
                                                </div>
                                            </td>
                                            {distinctDates.map((dateStr) => {
                                                const key = `${dateStr}_${op.operatorId}`;
                                                const qty = cellMap[key];
                                                return (
                                                    <td key={dateStr} className="px-3.5 py-2.5 text-center font-mono text-xs">
                                                        {qty !== undefined && qty !== null ? (
                                                            <span className="font-bold text-text-main bg-primary/10 px-2 py-0.5 rounded">
                                                                {Number(qty).toLocaleString('en-IN')}
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-muted/40 font-normal">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3.5 py-2.5 text-right font-mono font-extrabold text-primary border-l border-border bg-app-bg/30">
                                                {Number(op.total).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Summary Footer Row */}
                            <tfoot className="bg-app-bg text-text-main font-bold border-t-2 border-border text-xs">
                                <tr>
                                    <td className="px-3.5 py-2.5 uppercase text-[10px] tracking-wider text-text-muted sticky left-0 bg-app-bg z-10 border-r border-border">
                                        Day-wise Total
                                    </td>
                                    {distinctDates.map((dateStr) => {
                                        const daySummary = matrix.find((m) => m.date === dateStr);
                                        const dayTotal = daySummary?.total || 0;
                                        return (
                                            <td key={dateStr} className="px-3.5 py-2.5 text-center font-mono font-bold text-text-main">
                                                {Number(dayTotal).toLocaleString('en-IN')}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3.5 py-2.5 text-right font-mono font-extrabold text-base text-primary border-l border-border bg-primary/10">
                                        {totalProduced.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Individual Log Entries List */}
            {logs.length > 0 && (
                <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                            <FileText size={14} className="text-primary" />
                            <span>Individual Production Logs ({logs.length})</span>
                        </h5>
                        <span className="text-[10px] text-text-muted">
                            Chronological entries with edit/delete actions
                        </span>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-table-header-bg text-table-header-text uppercase text-[10px] font-extrabold border-b border-border">
                                <tr>
                                    <th className="px-3 py-2">Date (IST)</th>
                                    <th className="px-3 py-2">Operator</th>
                                    <th className="px-3 py-2 text-right">Quantity</th>
                                    <th className="px-3 py-2">Shift</th>
                                    <th className="px-3 py-2">Notes / Remarks</th>
                                    <th className="px-3 py-2">Logged By</th>
                                    {!readOnly && !isCancelledOrRejected && <th className="px-3 py-2 text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card-bg">
                                {logs.map((log) => {
                                    const opName = log.operator?.name || (log.operator?.employeeCode ? `${log.operator.employeeCode} - ${log.operator.name}` : 'Unassigned');
                                    const shiftName = typeof log.shift === 'object' && log.shift !== null
                                        ? (log.shift.name || log.shift.shiftCode || '-')
                                        : (log.shift || '-');
                                    const loggedByName = log.loggedBy?.name || log.loggedBy?.email || 'System';

                                    return (
                                        <tr key={log._id} className="hover:bg-app-bg/50 transition-colors">
                                            <td className="px-3 py-2 font-mono font-medium text-text-main">
                                                {formatIstDate(log.date)}
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-text-main">
                                                {opName}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-text-main">
                                                {Number(log.quantity || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-3 py-2 text-text-muted">
                                                {shiftName}
                                            </td>
                                            <td className="px-3 py-2 text-text-muted max-w-[200px] truncate" title={log.remarks || log.notes || ''}>
                                                {log.remarks || log.notes || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-text-muted text-[11px]">
                                                {loggedByName}
                                            </td>
                                            {!readOnly && !isCancelledOrRejected && (
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditModal(log)}
                                                            className="text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                                                            title="Edit Log"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingLogId(log._id)}
                                                            className="text-gray-500 hover:text-rose-600 transition-colors cursor-pointer"
                                                            title="Delete Log"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* "+ Log Production" Modal */}
            {isLogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-card-bg border border-border rounded-xl shadow-2xl p-5 max-w-md w-full font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Plus size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-text-main">
                                        {editingLog ? 'Edit Production Entry' : 'Log Operator Production'}
                                    </h3>
                                    <p className="text-[10px] text-text-muted">
                                        Stage: {currentStageName.replace(/_/g, ' ')} • {isFirstActiveStage ? 'WO Target: ' + workOrderOriginalTarget + ' Bags' : 'Limited by ' + (previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage') + ' (' + stageTargetQty + ' Bags)'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsLogModalOpen(false); setEditingLog(null); }}
                                className="p-1 text-text-muted hover:text-text-main rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitLog} className="space-y-3.5">
                            {/* Operator Dropdown */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                                    Operator *
                                </label>
                                <select
                                    required
                                    value={formData.operator}
                                    onChange={(e) => setFormData((p) => ({ ...p, operator: e.target.value }))}
                                    className="w-full text-xs font-semibold border border-border rounded-lg p-2 bg-app-bg text-text-main focus:outline-none focus:border-primary"
                                >
                                    <option value="" disabled>Select Assigned Operator</option>
                                    {assignedOperators.map((op) => (
                                        <option key={op._id} value={op._id}>
                                            {op.employeeCode ? `${op.employeeCode} - ` : ''}{op.name} {op.department ? `(${op.department})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Production Date (Cannot be future) */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                                    Production Date (IST) *
                                </label>
                                <input
                                    type="date"
                                    required
                                    max={getIstTodayString()}
                                    value={formData.date}
                                    onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                                    className="w-full text-xs font-semibold border border-border rounded-lg p-2 bg-app-bg text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Quantity Produced with Live Remaining Indicator & Dynamic Constraint Explanation */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">
                                        Quantity Produced (Bags) *
                                    </label>
                                    <span className={`text-[11px] font-mono font-bold ${maxAllowedForForm === 0 ? 'text-rose-500' : 'text-primary'}`}>
                                        Remaining: {maxAllowedForForm.toLocaleString('en-IN')} Bags
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    max={maxAllowedForForm}
                                    step="1"
                                    required
                                    placeholder={`Max ${maxAllowedForForm.toLocaleString('en-IN')} bags`}
                                    value={formData.quantity}
                                    onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
                                    className={`w-full text-xs font-mono font-bold border rounded-lg p-2 bg-app-bg text-text-main focus:outline-none ${
                                        isOverRemaining
                                            ? 'border-rose-500 focus:border-rose-500 text-rose-600'
                                            : 'border-border focus:border-primary'
                                    }`}
                                />
                                <span className="text-[10px] text-text-muted mt-1 block">
                                    {isFirstActiveStage
                                        ? `Cap enforced by Work Order target (${workOrderOriginalTarget.toLocaleString('en-IN')} Bags)`
                                        : `Cap enforced by ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'} output (${stageTargetQty.toLocaleString('en-IN')} Bags available)`}
                                </span>
                                {isOverRemaining && (
                                    <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                                        <AlertTriangle size={12} />
                                        <span>Entered quantity exceeds the remaining allowance ({maxAllowedForForm.toLocaleString('en-IN')} Bags).</span>
                                    </p>
                                )}
                            </div>

                            {/* Shift (Optional) */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                                    Shift (Optional)
                                </label>
                                <select
                                    value={formData.shift}
                                    onChange={(e) => setFormData((p) => ({ ...p, shift: e.target.value }))}
                                    className="w-full text-xs font-semibold border border-border rounded-lg p-2 bg-app-bg text-text-main focus:outline-none focus:border-primary"
                                >
                                    <option value="">None / General Shift</option>
                                    {shiftsList.map((s) => (
                                        <option key={s._id} value={s._id}>
                                            {s.name || s.shiftCode} {s.startTime && s.endTime ? `(${s.startTime} - ${s.endTime})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Remarks / Notes */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
                                    Remarks / Notes (Optional)
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Enter operator production notes or batch details..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
                                    className="w-full text-xs border border-border rounded-lg p-2 bg-app-bg text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => { setIsLogModalOpen(false); setEditingLog(null); }}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main bg-app-bg border border-border rounded-lg transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isOverRemaining || maxAllowedForForm <= 0 || !formData.quantity || Number(formData.quantity) <= 0}
                                    className="px-4 py-1.5 text-xs font-bold text-sidebar-bg bg-primary hover:bg-primary-hover rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Saving...' : editingLog ? 'Update Entry' : 'Save Production Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingLogId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-card-bg border border-border rounded-xl shadow-2xl p-5 max-w-sm w-full font-sans space-y-3">
                        <div className="flex items-center gap-2.5 text-rose-600">
                            <div className="p-2 bg-rose-100 rounded-lg">
                                <AlertTriangle size={18} />
                            </div>
                            <h4 className="text-sm font-bold text-text-main">Delete Production Entry</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Are you sure you want to delete this production log? The stage completed quantity will be automatically recalculated.
                        </p>
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingLogId(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main bg-app-bg border border-border rounded-lg transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDeleteLog(deletingLogId)}
                                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
