import { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, Play, ArrowRight, AlertCircle, RefreshCw, Ban, Search, ChevronDown, Check, X, AlertTriangle, Edit3, PackageCheck, Clock, Info, SkipForward, RotateCcw } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { isTenantAdmin } from '../../utils/permissionUtils';
import OperatorWiseProductionTracker from './OperatorWiseProductionTracker';
import WorkOrderOverallProductionSummary from './WorkOrderOverallProductionSummary';

const STAGE_CONFIG = [
    { sequence: 1, key: 'TAPE_EXTRUSION', label: 'Tape Extrusion' },
    { sequence: 2, key: 'CIRCULAR_WEAVING', label: 'Circular Weaving' },
    { sequence: 3, key: 'EXTRUSION_LAMINATION', label: 'Extrusion Lamination' },
    { sequence: 4, key: 'FLEXO_PRINTING', label: 'Flexo Printing' },
    { sequence: 5, key: 'CUTTING_SEWING', label: 'Cutting & Sewing' },
    { sequence: 6, key: 'STITCHING', label: 'Stitching' },
    { sequence: 7, key: 'HANDLE_ATTACHMENT', label: 'Handle Attachment' },
    { sequence: 8, key: 'BALING_PACKING', label: 'Baling & Packing' }
];

export default function ProductionStageMonitor({ workOrderId, onSelectWorkOrder }) {
    const user = useAuthStore((state) => state.user);
    const isAdmin = isTenantAdmin(user);

    const [workOrder, setWorkOrder] = useState(null);
    const [allWorkOrders, setAllWorkOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stageForm, setStageForm] = useState({ rejectedQty: '', wastageKg: '', returnToStore: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPartialAdvanceModal, setShowPartialAdvanceModal] = useState(false);
    const [isResumingBalance, setIsResumingBalance] = useState(false);
    const [selectedStageForTracking, setSelectedStageForTracking] = useState(null);
    const [stageToSkip, setStageToSkip] = useState(null);
    const [skipReasonInput, setSkipReasonInput] = useState('');
    const [isSkipping, setIsSkipping] = useState(false);
    const [auditStageModal, setAuditStageModal] = useState(null);
    const [restoreModal, setRestoreModal] = useState({ isOpen: false, stageId: null, stageName: '' });

    // Searchable combobox & status filter states for Select Job
    const [jobStatusFilter, setJobStatusFilter] = useState('ALL');
    const [jobSearchQuery, setJobSearchQuery] = useState('');
    const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
    const jobDropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target)) {
                setIsJobDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered work orders by status and search query
    const filteredWorkOrders = useMemo(() => {
        return allWorkOrders.filter((w) => {
            if (jobStatusFilter !== 'ALL' && w.status !== jobStatusFilter) {
                return false;
            }
            if (jobSearchQuery.trim()) {
                const q = jobSearchQuery.toLowerCase();
                const woNum = (w.workOrderNumber || '').toLowerCase();
                const custName = (w.customer?.companyName || w.customer?.name || '').toLowerCase();
                const prodName = (w.finishedGood?.name || '').toLowerCase();
                if (!woNum.includes(q) && !custName.includes(q) && !prodName.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [allWorkOrders, jobStatusFilter, jobSearchQuery]);

    // Fetch list of Work Orders
    const fetchWorkOrdersList = async () => {
        try {
            const res = await axiosInstance.get('/work-orders?limit=50');
            if (res.data?.success) {
                const list = res.data.data || [];
                setAllWorkOrders(list);

                if (!workOrderId && list.length > 0) {
                    const inProgress = list.find((w) => w.status === 'IN_PROGRESS') || list[0];
                    if (onSelectWorkOrder && inProgress?._id) {
                        onSelectWorkOrder(inProgress._id);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching work orders list:', err);
        }
    };

    // Fetch single WorkOrder detail
    const fetchWorkOrderDetail = async (id) => {
        if (!id) {
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            const res = await axiosInstance.get(`/work-orders/${id}`);
            if (res.data?.success) {
                setWorkOrder(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching work order detail:', err);
            toast.error(err.response?.data?.message || 'Failed to load Work Order details');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkOrdersList();
    }, []);

    useEffect(() => {
        if (workOrderId) {
            fetchWorkOrderDetail(workOrderId);
        } else if (allWorkOrders.length > 0) {
            const inProgress = allWorkOrders.find((w) => w.status === 'IN_PROGRESS') || allWorkOrders[0];
            if (inProgress?._id) {
                fetchWorkOrderDetail(inProgress._id);
            }
        }
    }, [workOrderId, allWorkOrders.length]);

    const activeStageIndex = workOrder?.stages?.findIndex((s) => s.status === 'ACTIVE') ?? -1;
    const activeStage = activeStageIndex !== -1 ? workOrder.stages[activeStageIndex] : null;
    const isBalingPackingStage = activeStage?.stageName === 'BALING_PACKING' || activeStage?.sequence === 8;

    // Reset form on stage change
    useEffect(() => {
        setStageForm({ rejectedQty: '', wastageKg: '', returnToStore: '' });
        setShowPartialAdvanceModal(false);
    }, [activeStage?.stageName, workOrder?._id, workOrder?.updatedAt]);

    // Continue / Resume Balance Production (Launches Continuation Work Order)
    const handleResumeBalanceProduction = async () => {
        if (!workOrder?._id) return;
        try {
            setIsResumingBalance(true);
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/resume-balance`);
            if (res.data?.success) {
                const newWo = res.data.data || res.data.continuationWorkOrder;
                const newWoNum = newWo?.workOrderNumber || 'Continuation WO';
                toast.success(res.data.message || `Continuation Work Order ${newWoNum} launched!`);
                await fetchWorkOrdersList();
                if (newWo?._id) {
                    if (onSelectWorkOrder) {
                        onSelectWorkOrder(newWo._id);
                    }
                    await fetchWorkOrderDetail(newWo._id);
                } else {
                    await fetchWorkOrderDetail(workOrder._id);
                }
            }
        } catch (err) {
            console.error('Error resuming balance production:', err);
            toast.error(err.response?.data?.message || 'Failed to resume balance production');
        } finally {
            setIsResumingBalance(false);
        }
    };

    // Calculate dynamic stage target from preceding non-skipped stage
    const nonSkippedStages = useMemo(() => {
        return (workOrder?.stages || []).filter(s => s.status !== 'SKIPPED');
    }, [workOrder?.stages]);

    const currentStageIndexInActive = useMemo(() => {
        if (!activeStage) return -1;
        return nonSkippedStages.findIndex(s => s.stageName === activeStage.stageName);
    }, [nonSkippedStages, activeStage]);

    const isFirstActiveStage = currentStageIndexInActive <= 0;
    const workOrderOriginalTarget = Number(workOrder?.targetQuantity || 0);

    const previousStage = useMemo(() => {
        if (!isFirstActiveStage && currentStageIndexInActive > 0) {
            return nonSkippedStages[currentStageIndexInActive - 1];
        }
        return null;
    }, [isFirstActiveStage, currentStageIndexInActive, nonSkippedStages]);

    const stageTargetQty = useMemo(() => {
        if (isFirstActiveStage) return workOrderOriginalTarget;
        return Number(previousStage?.completedQuantity || previousStage?.goodOutputQty || 0);
    }, [isFirstActiveStage, workOrderOriginalTarget, previousStage]);

    const stageCompletedQty = Number(activeStage?.completedQuantity || activeStage?.goodOutputQty || 0);
    const stageRemainingQty = Math.max(0, stageTargetQty - stageCompletedQty);
    const hasNoTarget = stageTargetQty === 0;
    const hasNoProductionLogged = stageCompletedQty === 0;

    // Handle Form Submit / Click Advance
    const handleAdvanceClick = (e) => {
        if (e) e.preventDefault();
        if (!workOrder?._id || !activeStage) return;

        const woStatusUpper = String(workOrder.status || '').toUpperCase();
        if (woStatusUpper === 'COMPLETED' || woStatusUpper === 'CANCELLED' || woStatusUpper === 'REJECTED') {
            const statusLabel = woStatusUpper === 'COMPLETED' ? 'Completed' : (woStatusUpper === 'CANCELLED' ? 'Cancelled' : 'Rejected');
            toast.error(`Cannot advance stage on a ${statusLabel} Work Order.`);
            return;
        }

        if (hasNoProductionLogged) {
            toast.error('Log production in the Operator-wise Tracker below before advancing this stage.');
            return;
        }

        // If partially produced (< target), prompt for confirmation
        if (stageCompletedQty < stageTargetQty && stageTargetQty > 0) {
            setShowPartialAdvanceModal(true);
            return;
        }

        // If target reached or no target set, execute immediately
        executeAdvanceStage();
    };

    // Execute actual API call to advance stage
    const executeAdvanceStage = async () => {
        try {
            setIsSubmitting(true);
            const numDefect = stageForm.rejectedQty !== '' ? Number(stageForm.rejectedQty) : 0;
            const payload = {
                rejectedQty: numDefect,
                wastageKg: stageForm.wastageKg ? Number(stageForm.wastageKg) : 0,
                returnToStore: stageForm.returnToStore ? Number(stageForm.returnToStore) : 0
            };
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/advance-stage`, payload);

            if (res.data?.success) {
                if (activeStage?.sequence === 8 || res.data?.data?.workOrder?.status === 'COMPLETED') {
                    toast.success('Final stage completed! Batch output routed to Pending QC inspection.');
                } else {
                    toast.success(`Stage '${activeStage.stageName.replace(/_/g, ' ')}' completed! Next stage activated.`);
                }

                setStageForm({ rejectedQty: '', wastageKg: '', returnToStore: '' });
                setShowPartialAdvanceModal(false);

                // Refetch work order details
                await fetchWorkOrderDetail(workOrder._id);
            }
        } catch (err) {
            console.error('Error advancing stage:', err);
            toast.error(err.response?.data?.message || 'Failed to advance stage');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmSkip = async () => {
        if (!stageToSkip || !skipReasonInput.trim()) {
            toast.error('Please enter a short reason for skipping this stage.');
            return;
        }
        try {
            setIsSkipping(true);
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/stages/${stageToSkip.key}/skip`, {
                reason: skipReasonInput.trim()
            });
            if (res.data?.success) {
                toast.success(res.data.message || `Stage '${stageToSkip.label}' skipped.`);
                setStageToSkip(null);
                setSkipReasonInput('');
                await fetchWorkOrderDetail(workOrder._id);
            }
        } catch (err) {
            console.error('Error skipping stage:', err);
            toast.error(err.response?.data?.message || 'Failed to skip stage');
        } finally {
            setIsSkipping(false);
        }
    };

    const handleUnskipStage = (stageKey, stageLabel) => {
        setRestoreModal({ isOpen: true, stageId: stageKey, stageName: stageLabel });
    };

    const handleConfirmRestore = async () => {
        const { stageId, stageName } = restoreModal;
        setRestoreModal({ isOpen: false, stageId: null, stageName: '' });
        try {
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/stages/${stageId}/unskip`);
            if (res.data?.success) {
                toast.success(res.data.message || `Stage '${stageName}' restored.`);
                await fetchWorkOrderDetail(workOrder._id);
            }
        } catch (err) {
            console.error('Error un-skipping stage:', err);
            toast.error(err.response?.data?.message || 'Failed to restore stage');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-10 bg-card-bg border border-border rounded-xl font-sans">
                <RefreshCw className="animate-spin text-primary mb-3" size={24} />
                <p className="text-xs font-semibold text-text-muted">Loading Live Production Pipeline Monitor...</p>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div className="bg-card-bg border border-border rounded-xl p-8 text-center font-sans">
                <AlertCircle className="text-text-muted mx-auto mb-2" size={28} />
                <h3 className="text-sm font-bold text-text-main">No Work Order Selected</h3>
                <p className="text-xs text-text-muted mt-1">Select a Work Order from the list to monitor live stage progress.</p>
            </div>
        );
    }

    const isFinishedOrCancelled = workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED' || !activeStage;
    const woUnit = workOrder.unit || workOrder.jobOrderDetails?.totalOrderQuantityUnit || 'Bags';

    const clientName = workOrder.customer?.companyName || workOrder.customer?.name || 'Unassigned';
    const rawMachine = workOrder.assignedMachine;
    const machineName = typeof rawMachine === 'object' && rawMachine !== null
        ? `${rawMachine.code ? `${rawMachine.code} - ` : ''}${rawMachine.name || 'Unassigned'}`
        : (rawMachine || 'Unassigned');
    const rawOps = typeof rawMachine === 'object' && rawMachine !== null
        ? ((Array.isArray(rawMachine.currentOperators) && rawMachine.currentOperators.length > 0)
            ? rawMachine.currentOperators
            : (rawMachine.currentOperator ? [rawMachine.currentOperator] : []))
        : [];
    const operatorName = rawOps.length > 0
        ? rawOps.map((op) => (typeof op === 'object' && op !== null
            ? `${op.employeeCode ? `${op.employeeCode} - ` : ''}${op.name || ''}`
            : String(op))).join(', ')
        : 'Unassigned';

    return (
        <div className="space-y-4 font-sans">
            {/* Parent Work Order Notice Banner */}
            {workOrder.parentWorkOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                    <span className="bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded shrink-0">
                        CONTINUATION ORDER
                    </span>
                    <span className="text-blue-800 text-sm font-medium flex-1">
                        Produces the <strong className="font-mono">{Number(workOrder.targetQuantity).toLocaleString('en-IN')} {woUnit}</strong> balance for original Work Order <strong className="font-mono">{workOrder.parentWorkOrder.workOrderNumber}</strong>.
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            const pId = workOrder.parentWorkOrder?._id || workOrder.parentWorkOrder;
                            if (onSelectWorkOrder && pId) onSelectWorkOrder(pId);
                        }}
                        className="text-blue-700 hover:text-blue-900 text-sm font-bold underline cursor-pointer shrink-0"
                    >
                        View Original WO ({workOrder.parentWorkOrder.workOrderNumber}) →
                    </button>
                </div>
            )}

            {/* Header: Work Order Overview & Searchable Job Selector */}
            <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">Live Monitor</span>
                            <span className="text-xs text-text-muted">•</span>
                            <h2 className="text-base font-bold text-text-main font-mono">{workOrder.workOrderNumber}</h2>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                workOrder.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-700'
                                    : workOrder.status === 'IN_PROGRESS'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}>
                                {workOrder.status === 'IN_PROGRESS' ? 'In Progress' : workOrder.status || 'Draft'}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                            <span>Client: <strong className="text-text-main font-medium">{clientName}</strong></span>
                            <span>Machine: <strong className="text-text-main font-medium">{machineName}</strong></span>
                            <span>Operators: <strong className="text-text-main font-medium">{operatorName}</strong></span>
                        </div>
                    </div>

                    {/* Searchable Combobox & Completed / Target Metric */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                        {/* Searchable Combobox Dropdown */}
                        {allWorkOrders.length > 0 && (
                            <div className="relative w-full md:w-64" ref={jobDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-app-bg border border-border rounded-lg text-xs font-medium text-text-main hover:border-primary/50 transition-colors shadow-2xs cursor-pointer text-left"
                                >
                                    <div className="truncate min-w-0">
                                        <span className="block font-mono font-bold truncate">
                                            {workOrder?.workOrderNumber || 'Select Job'}
                                        </span>
                                        <span className="block text-[10px] text-text-muted truncate">
                                            {workOrder?.customer?.companyName || workOrder?.customer?.name || 'Switch Job Order...'}
                                        </span>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        className={`text-text-muted shrink-0 transition-transform duration-200 ${
                                            isJobDropdownOpen ? 'rotate-180 text-primary' : ''
                                        }`}
                                    />
                                </button>

                                {isJobDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-80 bg-card-bg border border-border rounded-xl shadow-xl z-50 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150">
                                        <div className="p-2 border-b border-border bg-app-bg/50 space-y-1.5">
                                            <div className="relative">
                                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Search WO #, Customer, Product..."
                                                    value={jobSearchQuery}
                                                    onChange={(e) => setJobSearchQuery(e.target.value)}
                                                    className="w-full pl-7 pr-7 py-1 text-xs bg-card-bg border border-border rounded-md text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
                                                />
                                                {jobSearchQuery && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setJobSearchQuery('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {['ALL', 'IN_PROGRESS', 'DRAFT', 'COMPLETED'].map((st) => (
                                                    <button
                                                        key={st}
                                                        type="button"
                                                        onClick={() => setJobStatusFilter(st)}
                                                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                                            jobStatusFilter === st
                                                                ? 'bg-primary text-sidebar-bg'
                                                                : 'bg-card-bg border border-border text-text-muted hover:text-text-main'
                                                        }`}
                                                    >
                                                        {st === 'ALL' ? 'All' : st === 'IN_PROGRESS' ? 'Active' : st.charAt(0) + st.slice(1).toLowerCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <ul className="max-h-56 overflow-y-auto divide-y divide-border/60 text-xs">
                                            {filteredWorkOrders.length === 0 ? (
                                                <li className="p-3 text-center text-text-muted text-[11px]">
                                                    No work orders match filter
                                                </li>
                                            ) : (
                                                filteredWorkOrders.map((w) => {
                                                    const isSelected = w._id === workOrder?._id;
                                                    const cName = w.customer?.companyName || w.customer?.name || 'No Customer';
                                                    const badgeClass =
                                                        w.status === 'COMPLETED'
                                                            ? 'bg-green-100 text-green-700 border-green-200'
                                                            : w.status === 'IN_PROGRESS'
                                                            ? 'bg-orange-100 text-orange-700 border-orange-200'
                                                            : 'bg-gray-100 text-gray-600 border-gray-200';

                                                    return (
                                                        <li
                                                            key={w._id}
                                                            onClick={() => {
                                                                if (onSelectWorkOrder) onSelectWorkOrder(w._id);
                                                                setIsJobDropdownOpen(false);
                                                            }}
                                                            className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                                                isSelected
                                                                    ? 'bg-primary/10 text-primary font-bold'
                                                                    : 'hover:bg-app-bg text-text-main'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-bold">{w.workOrderNumber}</span>
                                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${badgeClass}`}>
                                                                        {w.status === 'IN_PROGRESS' ? 'In Progress' : w.status || 'Pending'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-text-muted truncate font-normal mt-0.5">
                                                                    {cName} {w.finishedGood?.name ? `• ${w.finishedGood.name}` : ''}
                                                                </div>
                                                            </div>
                                                            {isSelected && <Check size={14} className="text-primary shrink-0" />}
                                                        </li>
                                                    );
                                                })
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-app-bg border border-border rounded-lg px-3 py-2 text-right shrink-0 w-full md:w-auto">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                COMPLETED / WO TARGET
                            </span>
                            <div className="mt-0.5 font-mono">
                                <span className="text-base font-bold text-primary">{workOrder.completedQuantity || 0}</span>
                                <span className="text-xs font-bold text-text-muted mx-1">/</span>
                                <span className="text-base font-bold text-text-main">{workOrder.targetQuantity || 0}</span>
                                <span className="text-[10px] text-text-muted ml-1 font-sans font-normal">{woUnit}</span>
                            </div>
                            {Number(workOrder.balanceQuantity || 0) > 0 && (
                                <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded mt-0.5">
                                    Balance: {Number(workOrder.balanceQuantity).toLocaleString('en-IN')} {woUnit} Pending
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Production Pipeline Sequence */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5">
                    Production Pipeline Sequence
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {STAGE_CONFIG.map((cfg) => {
                        const stageData = workOrder.stages?.find((s) => s.stageName === cfg.key);
                        const status = stageData?.status || 'PENDING';

                        const isInherited = Boolean(stageData?.isInherited);
                        const isCompleted = status === 'COMPLETED';
                        const isActive = status === 'ACTIVE';
                        const isSkipped = status === 'SKIPPED' && !isInherited;

                        const isWoFinishedOrCancelled = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(workOrder.status || '').toUpperCase());

                        // Check if this pending stage can be skipped:
                        // 1. User is Tenant Admin
                        // 2. WO status not completed, cancelled, or rejected
                        // 3. Stage is PENDING (not active, not completed, not inherited, not already skipped)
                        // 4. No production logged
                        const hasLogs = Number(stageData?.completedQuantity || 0) > 0 || Number(stageData?.goodOutputQty || 0) > 0;
                        const canSkipStage = isAdmin && !isWoFinishedOrCancelled && !isActive && !isCompleted && !isInherited && !isSkipped && !hasLogs;

                        // Check if a skipped stage can be un-skipped:
                        // 1. User is Tenant Admin
                        // 2. WO is not finished/cancelled
                        // 3. Stage is skipped at WO level (stageData?.isWoSkipped || stageData?.skipReason)
                        // 4. Pipeline has not passed this stage yet: no subsequent stage (sequence > cfg.sequence) is ACTIVE or COMPLETED
                        const hasBeenPassedInPipeline = (workOrder.stages || []).some(
                            (s) => s.sequence > cfg.sequence && (s.status === 'ACTIVE' || s.status === 'COMPLETED')
                        );
                        const canUnskipStage = isAdmin && !isWoFinishedOrCancelled && isSkipped && (stageData?.isWoSkipped || stageData?.skipReason) && !hasBeenPassedInPipeline;

                        const currentTrackedStage = selectedStageForTracking || activeStage?.stageName;
                        const isCurrentlyTracked = currentTrackedStage === cfg.key;
                        const isOverCap = Array.isArray(workOrder?.exceededStages) && workOrder.exceededStages.some((ex) => ex.stageName === cfg.key);
                        const canAdminClick = isAdmin && (isCompleted || isActive);
                        const hasAuditInfo = isSkipped && Boolean(stageData?.skipReason);

                        return (
                            <div
                                key={cfg.key}
                                onClick={() => {
                                    if (hasAuditInfo) {
                                        setAuditStageModal({
                                            label: cfg.label,
                                            sequence: cfg.sequence,
                                            stageData
                                        });
                                        return;
                                    }
                                    if (canAdminClick) {
                                        setSelectedStageForTracking(cfg.key);
                                    }
                                }}
                                className={`rounded-lg p-2.5 flex flex-col justify-between transition-all duration-200 min-h-[95px] relative ${
                                    canAdminClick || hasAuditInfo ? 'cursor-pointer hover:border-primary/60 hover:shadow-md' : ''
                                } ${
                                    isCurrentlyTracked && isCompleted
                                        ? 'bg-amber-50/90 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/40 text-amber-900'
                                        : isCurrentlyTracked && isActive
                                        ? 'bg-orange-50 border-2 border-orange-500 text-orange-800 shadow-md ring-2 ring-orange-400/40'
                                        : isOverCap
                                        ? 'bg-rose-50 border-2 border-rose-400 text-rose-800 shadow-xs'
                                        : isInherited
                                        ? 'bg-emerald-50/70 border border-emerald-300 text-emerald-800'
                                        : isCompleted
                                        ? 'bg-green-50 border border-green-200 text-green-700'
                                        : isActive
                                        ? 'bg-orange-50 border border-orange-400 text-orange-800 shadow-sm'
                                        : isSkipped
                                        ? 'bg-gray-100/70 border border-gray-200 text-gray-400 opacity-60'
                                        : 'bg-transparent border border-gray-200 text-gray-400'
                                }`}
                                title={
                                    hasAuditInfo
                                        ? `Skipped: "${stageData.skipReason}"${stageData.skippedBy?.name ? ` by ${stageData.skippedBy.name}` : ''}${stageData.skippedAt ? ` on ${new Date(stageData.skippedAt).toLocaleDateString('en-IN')}` : ''} (Click for audit details)`
                                        : canAdminClick
                                        ? `Click to inspect and edit logs for ${cfg.label}`
                                        : undefined
                                }
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isInherited ? 'text-emerald-700' : isCompleted ? 'text-green-700' : isActive ? 'text-orange-800' : isSkipped ? 'text-gray-400' : 'text-gray-400'
                                    }`}>
                                        STEP 0{cfg.sequence}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {isOverCap && (
                                            <span className="text-[8px] bg-rose-500 text-white font-black px-1 py-0.2 rounded uppercase" title="Output exceeds preceding stage cap">
                                                Over-Cap
                                            </span>
                                        )}
                                        {isCurrentlyTracked && isCompleted && (
                                            <span className="text-[8px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded uppercase">
                                                Viewing
                                            </span>
                                        )}
                                        {isInherited ? (
                                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                        ) : isCompleted ? (
                                            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                                        ) : isActive ? (
                                            <Play size={14} className="text-orange-600 fill-orange-600 shrink-0 animate-pulse" />
                                        ) : isSkipped ? (
                                            <Ban size={14} className="text-gray-400 shrink-0" />
                                        ) : null}
                                    </div>
                                </div>

                                <div className="mt-1">
                                    <h4 className={`text-xs font-semibold leading-tight ${
                                        isInherited ? 'text-emerald-900 font-bold' : isCompleted ? 'text-green-800' : isActive ? 'text-orange-900' : isSkipped ? 'text-gray-400 line-through' : 'text-gray-500'
                                    }`}>
                                        {cfg.label}
                                    </h4>

                                    {isInherited && (
                                        <div className="text-[9px] text-emerald-700 font-medium mt-1 leading-tight">
                                            <span className="inline-block bg-emerald-100/90 text-emerald-800 font-bold px-1 py-0.5 rounded text-[8.5px]">
                                                Inherited from {stageData?.inheritedFrom || workOrder.parentWorkOrder?.workOrderNumber || 'Original WO'}: already at full target
                                            </span>
                                        </div>
                                    )}

                                    {isCompleted && !isInherited && (
                                        <div className="text-[9px] text-green-600 font-medium mt-1">
                                            <p>Good: {stageData?.goodOutputQty || 0} | Defect: {stageData?.rejectedQty || 0}</p>
                                            {canAdminClick && !isCurrentlyTracked && (
                                                <span className="text-[8.5px] text-primary/80 font-bold hover:underline block mt-0.5">
                                                    Edit Logs &rarr;
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {isActive && (
                                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100/80 px-1 py-0.5 rounded mt-1">
                                            • Active
                                        </span>
                                    )}

                                    {isSkipped && (
                                        <div className="mt-1">
                                            <span className="inline-block text-[9px] font-bold text-gray-400 bg-gray-200/80 px-1 py-0.5 rounded">
                                                Skipped — Not Required
                                            </span>
                                            {stageData?.skipReason && (
                                                <p className="text-[8.5px] text-gray-500 italic mt-0.5 leading-tight line-clamp-2" title={`Skip Reason: ${stageData.skipReason}`}>
                                                    &ldquo;{stageData.skipReason}&rdquo;
                                                </p>
                                            )}
                                            {canUnskipStage && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnskipStage(cfg.key, cfg.label);
                                                    }}
                                                    className="mt-1 text-[8.5px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer"
                                                    title="Restore this stage to pipeline (Pending)"
                                                >
                                                    <RotateCcw size={9} />
                                                    <span>Un-skip</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {canSkipStage && (
                                        <div className="mt-1.5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setStageToSkip({ key: cfg.key, label: cfg.label });
                                                    setSkipReasonInput('');
                                                }}
                                                className="text-[8.5px] font-bold text-gray-600 hover:text-rose-700 bg-gray-100 hover:bg-rose-50 border border-gray-300 hover:border-rose-300 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer"
                                                title={`Skip ${cfg.label} for this Work Order`}
                                            >
                                                <SkipForward size={9} />
                                                <span>Skip</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Over-Cap Warning Banners for entire pipeline */}
                {Array.isArray(workOrder?.exceededStages) && workOrder.exceededStages.length > 0 && (
                    <div className="space-y-2 mt-2.5">
                        {workOrder.exceededStages.map((ex) => (
                            <div
                                key={ex.stageName}
                                className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs font-sans"
                            >
                                <div className="flex items-start gap-2.5">
                                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-extrabold block uppercase tracking-wide text-[11px] text-amber-900">
                                            Stage Cap Exceeded: {ex.stageLabel}
                                        </span>
                                        <p className="mt-0.5 text-amber-800 font-medium">
                                            Stage {ex.stageLabel} now exceeds available input from the corrected {ex.previousStageLabel} by {Number(ex.excessQty).toLocaleString('en-IN')} Bags — please review.
                                        </p>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStageForTracking(ex.stageName)}
                                        className="px-3 py-1 bg-amber-200/90 hover:bg-amber-300 text-amber-900 font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
                                    >
                                        Inspect {ex.stageLabel}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Panel: Stage Advance & Scrap Logging */}
            {isFinishedOrCancelled ? (
                (workOrder.status === 'COMPLETED' || (workOrder?.stages && workOrder.stages.filter(s => s.status !== 'SKIPPED').every(s => s.status === 'COMPLETED'))) ? (
                    workOrder.continuationWorkOrder ? (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center shadow-2xs space-y-3 font-sans">
                            <CheckCircle2 className="text-blue-600 mx-auto" size={38} />
                            <div>
                                <h4 className="text-sm font-extrabold text-blue-900 uppercase tracking-wider">
                                    Balance Handed Over to Continuation Work Order
                                </h4>
                                <p className="text-xs text-blue-800 max-w-md mx-auto mt-1">
                                    Original Work Order completed with <strong className="font-mono">{Number(workOrder.completedQuantity || 0).toLocaleString('en-IN')}</strong> of <strong className="font-mono">{Number(workOrder.targetQuantity || 0).toLocaleString('en-IN')} {woUnit}</strong>.
                                    The remaining <strong className="font-mono text-blue-900">{Number(workOrder.balanceQuantity).toLocaleString('en-IN')} {woUnit}</strong> are being produced in continuation Work Order <strong className="font-mono">{workOrder.continuationWorkOrder?.workOrderNumber || 'Linked WO'}</strong>.
                                </p>
                            </div>
                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const contId = workOrder.continuationWorkOrder?._id || workOrder.continuationWorkOrder;
                                        if (onSelectWorkOrder && contId) onSelectWorkOrder(contId);
                                    }}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowRight size={14} />
                                    <span>Open Continuation WO ({workOrder.continuationWorkOrder?.workOrderNumber || 'Linked WO'})</span>
                                </button>
                            </div>
                        </div>
                    ) : Number(workOrder.balanceQuantity || 0) > 0 ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center shadow-2xs space-y-3 font-sans">
                            <AlertTriangle className="text-amber-600 mx-auto" size={38} />
                            <div>
                                <h4 className="text-sm font-extrabold text-amber-900 uppercase tracking-wider">
                                    Production Finished with Balance Shortfall
                                </h4>
                                <p className="text-xs text-amber-800 max-w-md mx-auto mt-1">
                                    Completed <strong className="font-mono">{Number(workOrder.completedQuantity || 0).toLocaleString('en-IN')}</strong> of <strong className="font-mono">{Number(workOrder.targetQuantity || 0).toLocaleString('en-IN')} {woUnit}</strong> target.
                                    <span className="block mt-1 text-rose-700 font-bold font-mono text-xs">
                                        Balance: {Number(workOrder.balanceQuantity).toLocaleString('en-IN')} {woUnit} Pending
                                    </span>
                                </p>
                            </div>
                            {workOrder.balanceStatus === 'REJECTED' && workOrder.continuationApprovalRemarks && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 text-left max-w-md mx-auto">
                                    <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-900 mb-0.5">
                                        Previous Continuation Request Rejected:
                                    </span>
                                    <p className="text-[11px]">{workOrder.continuationApprovalRemarks}</p>
                                </div>
                            )}

                            <div className="pt-2 flex justify-center">
                                {workOrder.balanceStatus === 'PENDING_APPROVAL' ? (
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold shadow-2xs">
                                            <Clock size={15} className="text-amber-600 animate-spin" />
                                            <span>Continuation requested — awaiting Tenant Admin approval</span>
                                        </div>
                                        <span className="text-[11px] text-amber-700">
                                            The Continuation Work Order will be generated once approved in Approvals.
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isResumingBalance}
                                        onClick={handleResumeBalanceProduction}
                                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <Play size={14} className="fill-white" />
                                        <span>{isResumingBalance ? 'Submitting Continuation Request...' : 'Continue / Resume Balance Production'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center shadow-2xs space-y-2 font-sans">
                            <CheckCircle2 className="text-emerald-500 mx-auto" size={40} />
                            <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-wider">Production Successfully Completed</h4>
                            <p className="text-xs text-emerald-700 max-w-md mx-auto">
                                All pipeline stages are finished. The full target output has been moved to Finished Goods inventory.
                            </p>
                        </div>
                    )
                ) : workOrder.status === 'CANCELLED' ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center shadow-2xs space-y-2 font-sans">
                        <AlertCircle className="text-rose-600 mx-auto" size={32} />
                        <h4 className="text-sm font-bold text-rose-900">Work Order Cancelled</h4>
                        <p className="text-xs text-rose-700 max-w-md mx-auto">
                            This Work Order was cancelled and is no longer active on the shop floor.
                        </p>
                    </div>
                ) : (
                    <div className="bg-card-bg border border-border rounded-xl p-6 text-center shadow-2xs space-y-2 font-sans">
                        <AlertCircle className="text-text-muted mx-auto" size={32} />
                        <h4 className="text-sm font-bold text-text-main">Waiting to Start</h4>
                        <p className="text-xs text-text-muted max-w-md mx-auto">
                            Production for this Work Order has not started yet.
                        </p>
                    </div>
                )
            ) : (
                <div className="bg-sidebar-bg text-sidebar-text-active border border-sidebar-hover rounded-xl p-5 shadow-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sidebar-hover pb-2.5 gap-2">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                Stage Transition & Defect Scrap
                            </h3>
                            <p className="text-xs text-sidebar-text mt-0.5">
                                Currently Processing: <strong className="text-amber-400">STEP 0{activeStage.sequence} — {STAGE_CONFIG.find(c => c.key === activeStage.stageName)?.label || activeStage.stageName}</strong>
                            </p>
                        </div>

                        {/* Read-Only Status Badge with Dynamic Preceding Stage Info */}
                        <div className="flex flex-col items-end gap-0.5">
                            {hasNoTarget ? (
                                <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-lg text-xs font-semibold">
                                    Stage Cap: <strong className="text-white">0 Bags ({isFirstActiveStage ? 'WO Target Not Set' : 'Waiting for Preceding Stage'})</strong>
                                </div>
                            ) : (
                                <div className="bg-card-bg/40 border border-sidebar-hover text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-2">
                                    <span className="text-sidebar-text text-[11px]">Logged Output:</span>
                                    <strong className="font-mono text-primary">{stageCompletedQty.toLocaleString('en-IN')}</strong>
                                    <span className="text-sidebar-text text-[11px]">/ {stageTargetQty.toLocaleString('en-IN')} Bags</span>
                                </div>
                            )}
                            <span className="text-[10px] text-sidebar-text">
                                {isFirstActiveStage
                                    ? `Overall WO Target: ${workOrderOriginalTarget.toLocaleString('en-IN')} Bags`
                                    : `Limited by ${previousStage?.stageName?.replace(/_/g, ' ') || 'previous stage'} (${stageTargetQty.toLocaleString('en-IN')} Bags)`}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleAdvanceClick} className="space-y-3 font-sans">
                        {/* Status Notice Banner */}
                        {hasNoProductionLogged ? (
                            <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-3 text-center">
                                <p className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
                                    <AlertTriangle size={14} />
                                    <span>0 Bags logged for this stage.</span>
                                </p>
                                <p className="text-[11px] text-amber-200/80 mt-0.5">
                                    Log operator production using the <strong>+ Log Production</strong> button in the Operator Tracker below before advancing this stage.
                                </p>
                            </div>
                        ) : stageCompletedQty >= stageTargetQty && stageTargetQty > 0 ? (
                            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                                <p className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                                    <CheckCircle2 size={14} />
                                    <span>Stage target fully achieved ({stageCompletedQty.toLocaleString('en-IN')} / {stageTargetQty.toLocaleString('en-IN')} Bags). Ready to advance.</span>
                                </p>
                            </div>
                        ) : (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-center">
                                <p className="text-xs font-medium text-blue-300">
                                    <strong>{stageCompletedQty.toLocaleString('en-IN')} Bags</strong> produced so far ({stageRemainingQty.toLocaleString('en-IN')} remaining of {stageTargetQty.toLocaleString('en-IN')} available).
                                </p>
                            </div>
                        )}

                        {/* Defect, Wastage & Return Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-[10px] font-bold text-sidebar-text mb-1 uppercase tracking-wider">
                                    Rejected / Defect Qty (Bags)
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stageForm.rejectedQty === 0 ? '' : stageForm.rejectedQty}
                                    onChange={(e) => setStageForm(p => ({ ...p, rejectedQty: e.target.value }))}
                                    placeholder="e.g. 2"
                                    className="w-full border border-sidebar-hover rounded-md p-2 bg-card-bg text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                                />
                                <span className="text-[10px] text-sidebar-text mt-1 block">
                                    Damaged or non-compliant bags
                                </span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-sidebar-text mb-1 uppercase tracking-wider">
                                    Wastage / Scrap (Kg)
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stageForm.wastageKg || ''}
                                    onChange={(e) => setStageForm(p => ({ ...p, wastageKg: e.target.value }))}
                                    placeholder="e.g. 2.5"
                                    className="w-full border border-sidebar-hover rounded-md p-2 bg-card-bg text-text-main text-xs focus:outline-none focus:border-primary"
                                />
                                <span className="text-[10px] text-sidebar-text mt-1 block">
                                    Lumps or unrecoverable scrap
                                </span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-sidebar-text mb-1 uppercase tracking-wider">
                                    Return to Store (Kg / Rolls)
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stageForm.returnToStore || ''}
                                    onChange={(e) => setStageForm(p => ({ ...p, returnToStore: e.target.value }))}
                                    placeholder="e.g. 50"
                                    className="w-full border border-sidebar-hover rounded-md p-2 bg-card-bg text-text-main text-xs focus:outline-none focus:border-primary"
                                />
                                <span className="text-[10px] text-sidebar-text mt-1 block">
                                    Unused material returned to inventory
                                </span>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || hasNoProductionLogged}
                                title={hasNoProductionLogged ? 'Log production in the Operator-wise Tracker below before advancing this stage.' : undefined}
                                className="bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold px-5 py-2.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span>
                                    {isSubmitting
                                        ? 'Advancing Stage...'
                                        : hasNoProductionLogged
                                        ? 'Log Production Below to Advance'
                                        : 'Advance to Next Stage'}
                                </span>
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Partial Production Confirmation Modal */}
            {showPartialAdvanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-card-bg border border-border rounded-xl shadow-2xl p-5 max-w-md w-full font-sans space-y-3 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2.5 text-amber-500">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <AlertTriangle size={20} />
                            </div>
                            <h4 className="text-sm font-bold text-text-main">Advance with Partial Quantity?</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Only <strong className="text-text-main font-mono">{stageCompletedQty.toLocaleString('en-IN')}</strong> of <strong className="text-text-main font-mono">{stageTargetQty.toLocaleString('en-IN')} Bags</strong> have been logged for this stage (<strong className="text-amber-600 font-mono">{stageRemainingQty.toLocaleString('en-IN')} remaining</strong>).
                        </p>
                        <p className="text-xs text-text-muted">
                            Are you sure you want to complete this stage and activate the next stage anyway?
                        </p>
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowPartialAdvanceModal(false)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main bg-app-bg border border-border rounded-lg transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={executeAdvanceStage}
                                className="px-4 py-1.5 text-xs font-bold text-sidebar-bg bg-primary hover:bg-primary-hover rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? 'Advancing...' : 'Confirm & Advance'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Operator-wise, Day-wise Production Tracking Section */}
            {workOrder && (
                <div className="pt-2 space-y-4">
                    {/* Admin Past Stage Inspection Notice & Return Button */}
                    {selectedStageForTracking && selectedStageForTracking !== activeStage?.stageName && (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-sans shadow-2xs">
                            <div className="flex items-center gap-2">
                                <Info size={16} className="text-amber-600 shrink-0" />
                                <span className="text-amber-900 font-bold">
                                    Inspecting Completed Stage: <strong className="font-extrabold">{STAGE_CONFIG.find((c) => c.key === selectedStageForTracking)?.label || selectedStageForTracking}</strong>
                                </span>
                                <span className="text-[10px] bg-amber-200/90 text-amber-900 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Correction Mode
                                </span>
                            </div>
                            {activeStage && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedStageForTracking(null)}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                                >
                                    <span>Return to Active Stage ({STAGE_CONFIG.find((c) => c.key === activeStage?.stageName)?.label || activeStage?.stageName})</span>
                                    <ArrowRight size={13} />
                                </button>
                            )}
                        </div>
                    )}

                    <OperatorWiseProductionTracker
                        workOrder={workOrder}
                        workOrderId={workOrder._id}
                        selectedStageName={selectedStageForTracking || activeStage?.stageName}
                        onProductionLogged={() => fetchWorkOrderDetail(workOrder._id)}
                    />

                    {/* Consolidated Overall Production Summary Matrix */}
                    <WorkOrderOverallProductionSummary
                        workOrderId={workOrder._id}
                        lastUpdated={workOrder.updatedAt}
                    />
                </div>
            )}

            {/* Modal: Confirm Skip Stage for this Work Order */}
            {stageToSkip && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                                    <SkipForward size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-text-primary">
                                        Skip Stage: {stageToSkip.label}
                                    </h4>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Work Order: <strong className="font-mono text-text-primary">{workOrder.workOrderNumber}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setStageToSkip(null); setSkipReasonInput(''); }}
                                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-text-secondary leading-relaxed">
                            Mark <strong>{stageToSkip.label}</strong> as <em>Skipped — Not Required</em> for this Work Order only. The dynamic stage cap and pipeline progression will automatically walk past this stage.
                        </p>

                        <div>
                            <label className="block text-xs font-bold text-text-primary mb-1.5">
                                Reason / Remark for Skipping <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={skipReasonInput}
                                onChange={(e) => setSkipReasonInput(e.target.value)}
                                placeholder="e.g. Not needed for this order's spec (plain bags without stitching)"
                                className="w-full text-xs p-2.5 bg-input-bg border border-input-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-text-primary placeholder:text-text-muted"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {[
                                    "Not needed for this order's spec",
                                    "Customer supplied pre-processed fabric",
                                    "Standard unprinted plain order",
                                    "Direct cutting to packaging requirement"
                                ].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setSkipReasonInput(preset)}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-text-secondary font-medium transition-colors border border-border cursor-pointer"
                                    >
                                        + {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => { setStageToSkip(null); setSkipReasonInput(''); }}
                                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!skipReasonInput.trim() || isSkipping}
                                onClick={handleConfirmSkip}
                                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            >
                                {isSkipping ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        <span>Skipping...</span>
                                    </>
                                ) : (
                                    <>
                                        <SkipForward size={13} />
                                        <span>Confirm Skip</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: View Skipped Stage Audit Details */}
            {auditStageModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-3 font-sans animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <Ban size={18} className="text-gray-500" />
                                <div>
                                    <h4 className="text-sm font-bold text-text-primary">
                                        {auditStageModal.label} (Step 0{auditStageModal.sequence})
                                    </h4>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                        Skipped Stage Audit Info
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAuditStageModal(null)}
                                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-2">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-text-muted block">Skip Reason / Remark</span>
                                <p className="text-text-primary font-medium mt-0.5 italic">
                                    &ldquo;{auditStageModal.stageData?.skipReason || 'Skipped as not required for this order.'}&rdquo;
                                </p>
                            </div>
                            {auditStageModal.stageData?.skippedBy && (
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-text-muted block">Skipped By</span>
                                    <p className="text-text-primary font-medium mt-0.5">
                                        {auditStageModal.stageData.skippedBy.name || auditStageModal.stageData.skippedBy.email || 'Admin'}
                                    </p>
                                </div>
                            )}
                            {auditStageModal.stageData?.skippedAt && (
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-text-muted block">Skipped At</span>
                                    <p className="text-text-primary font-medium mt-0.5 font-mono">
                                        {new Date(auditStageModal.stageData.skippedAt).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => setAuditStageModal(null)}
                                className="px-4 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal: Confirm Restore (Un-skip) Stage */}
            {restoreModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 p-2 bg-amber-100 rounded-xl">
                                <RotateCcw size={18} className="text-amber-700" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-text-primary">Restore Stage to Pipeline?</h4>
                                <p className="text-xs text-text-muted mt-0.5">
                                    This will restore <span className="font-semibold text-text-primary">{restoreModal.stageName}</span> back into the active production sequence for this Work Order.
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>The pipeline cap logic will re-include this stage. Make sure production quantities are correct before proceeding.</span>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setRestoreModal({ isOpen: false, stageId: null, stageName: '' })}
                                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRestore}
                                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            >
                                <RotateCcw size={13} />
                                <span>Yes, Restore Stage</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

