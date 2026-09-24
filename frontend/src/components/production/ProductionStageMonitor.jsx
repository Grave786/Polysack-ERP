import { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, Play, ArrowRight, AlertCircle, RefreshCw, Ban, Search, ChevronDown, Check, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

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
    const [workOrder, setWorkOrder] = useState(null);
    const [allWorkOrders, setAllWorkOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [goodOutputQty, setGoodOutputQty] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

                // If no specific workOrderId provided, pick first IN_PROGRESS or first item
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

    // Determine max available quantity passed from previous non-skipped completed stage (or targetQuantity if first active stage)
    let maxAvailableQty = Number(workOrder?.targetQuantity || 0);
    if (workOrder?.stages && activeStageIndex > 0) {
        for (let i = activeStageIndex - 1; i >= 0; i--) {
            const prevStage = workOrder.stages[i];
            if (prevStage && prevStage.status !== 'SKIPPED') {
                maxAvailableQty = Number(prevStage.goodOutputQty || 0);
                break;
            }
        }
    }

    const numGoodOutput = goodOutputQty !== '' ? Number(goodOutputQty) : '';
    const autoRejectedQty = typeof numGoodOutput === 'number' && !isNaN(numGoodOutput)
        ? Math.max(0, maxAvailableQty - numGoodOutput)
        : maxAvailableQty;

    const isExceedingCap = typeof numGoodOutput === 'number' && numGoodOutput > maxAvailableQty;

    // Handle Advance Stage submit
    const handleAdvanceStage = async (e) => {
        e.preventDefault();
        if (!workOrder?._id || !activeStage) return;

        const numGood = Number(goodOutputQty);
        const numDefect = autoRejectedQty;
        const totalEntered = numGood + numDefect;

        if (isNaN(numGood) || numGood < 0) {
            toast.error('Please enter a valid Good Output quantity >= 0');
            return;
        }

        if (totalEntered > maxAvailableQty) {
            toast.error(`Total quantity (${totalEntered}) cannot exceed the available input from the previous stage (${maxAvailableQty}).`);
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/advance-stage`, {
                goodOutputQty: numGood,
                rejectedQty: autoRejectedQty
            });

            if (res.data?.success) {
                if (activeStage?.sequence === 8 || res.data?.data?.workOrder?.status === 'COMPLETED') {
                    toast.success('Final stage completed! Batch output routed to Pending QC inspection.');
                } else {
                    toast.success(`Stage advanced successfully! Next stage activated.`);
                }

                setGoodOutputQty('');

                // Refetch details to reflect newly active/completed stage
                await fetchWorkOrderDetail(workOrder._id);
            }
        } catch (err) {
            console.error('Error advancing stage:', err);
            toast.error(err.response?.data?.message || 'Failed to advance stage');
        } finally {
            setIsSubmitting(false);
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
        <div className="space-y-5 font-sans">
            {/* Header Card Block */}
            <div className="bg-card-bg border border-border rounded-xl p-5 shadow-2xs space-y-3 font-sans">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-3">
                    {/* Left: WO Number + Badges + Product Spec Title + Meta String */}
                    <div>
                        {/* Line 1: Single line with WO Number and Badges */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-lg font-bold text-text-main font-mono">
                                {workOrder.workOrderNumber}
                            </h2>

                            {/* Minimal Status Badge */}
                            <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    workOrder.status === 'IN_PROGRESS'
                                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                        : workOrder.status === 'COMPLETED'
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : workOrder.status === 'CANCELLED'
                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}
                            >
                                • {workOrder.status === 'IN_PROGRESS' ? 'In Progress' : workOrder.status || 'Pending'}
                            </span>

                            {/* Minimal Priority Badge */}
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-transparent border border-gray-300 text-gray-700">
                                Priority: {workOrder.priority || 'NORMAL'}
                            </span>
                        </div>

                        {/* Line 2: Prominent Product Title */}
                        <h3 className="text-base font-semibold text-text-main mt-1">
                            {workOrder.finishedGood?.name || 'Mesh Sack Bag Spec'}
                        </h3>

                        {/* Line 3: Meta String */}
                        <p className="text-xs text-text-muted mt-1 flex items-center gap-2 flex-wrap">
                            <span>Client: <strong className="text-text-main font-medium">{clientName}</strong></span>
                            <span>|</span>
                            <span>Assigned Machine: <strong className="text-text-main font-medium">{machineName}</strong></span>
                            <span>|</span>
                            <span>Operator: <strong className="text-text-main font-medium">{operatorName}</strong></span>
                        </p>
                    </div>

                    {/* Right side: Stacked Select Job (TOP) & Target vs Completed Stat Block (BOTTOM) */}
                    <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                        {allWorkOrders.length > 0 && (
                            <div className="relative" ref={jobDropdownRef}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                                        Select Job:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                                        className="flex items-center justify-between gap-2 text-xs font-semibold border border-border rounded-lg py-1.5 px-3 bg-card-bg hover:bg-app-bg text-text-main shadow-2xs transition-all cursor-pointer min-w-[240px] max-w-[320px]"
                                        title="Click to search and change active Work Order"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-mono font-bold text-primary shrink-0">
                                                {workOrder.workOrderNumber}
                                            </span>
                                            <span className="text-text-muted truncate">
                                                • {workOrder.customer?.companyName || workOrder.customer?.name || 'Customer'}
                                            </span>
                                        </div>
                                        <ChevronDown size={14} className={`text-text-muted shrink-0 transition-transform duration-150 ${isJobDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>

                                {/* Custom Combobox Dropdown Panel */}
                                {isJobDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 z-50 w-80 sm:w-96 bg-card-bg border border-border rounded-xl shadow-xl p-3 font-sans space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                                        {/* Status Filter Pill Buttons */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                                            {[
                                                { key: 'ALL', label: 'All' },
                                                { key: 'IN_PROGRESS', label: 'In Progress' },
                                                { key: 'COMPLETED', label: 'Completed' },
                                                { key: 'CANCELLED', label: 'Cancelled' }
                                            ].map((f) => (
                                                <button
                                                    key={f.key}
                                                    type="button"
                                                    onClick={() => setJobStatusFilter(f.key)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors shrink-0 cursor-pointer ${
                                                        jobStatusFilter === f.key
                                                            ? 'bg-primary text-white shadow-2xs'
                                                            : 'bg-app-bg text-text-muted hover:text-text-main border border-border'
                                                    }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Search Input Box */}
                                        <div className="relative">
                                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Search WO# or Client..."
                                                value={jobSearchQuery}
                                                onChange={(e) => setJobSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-app-bg border border-border rounded-lg text-text-main focus:outline-none focus:border-primary font-sans"
                                                autoFocus
                                            />
                                            {jobSearchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setJobSearchQuery('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 cursor-pointer"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Filtered Options List */}
                                        <ul className="max-h-56 overflow-y-auto divide-y divide-border/50 text-xs">
                                            {filteredWorkOrders.length === 0 ? (
                                                <li className="py-4 text-center text-xs text-text-muted font-medium">
                                                    No Work Orders match filters
                                                </li>
                                            ) : (
                                                filteredWorkOrders.map((w) => {
                                                    const isSelected = w._id === workOrder._id;
                                                    const cName = w.customer?.companyName || w.customer?.name || 'Customer';
                                                    const badgeClass =
                                                        w.status === 'IN_PROGRESS'
                                                            ? 'bg-orange-100 text-orange-700 border-orange-200'
                                                            : w.status === 'COMPLETED'
                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                            : w.status === 'CANCELLED'
                                                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                                                            : 'bg-gray-100 text-gray-700 border-gray-200';

                                                    return (
                                                        <li
                                                            key={w._id}
                                                            onClick={() => {
                                                                if (onSelectWorkOrder) onSelectWorkOrder(w._id);
                                                                setIsJobDropdownOpen(false);
                                                            }}
                                                            className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 ${
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
                                COMPLETED / TARGET
                            </span>
                            <div className="mt-0.5 font-mono">
                                <span className="text-base font-bold text-primary">{workOrder.completedQuantity || 0}</span>
                                <span className="text-xs font-bold text-text-muted mx-1">/</span>
                                <span className="text-base font-bold text-text-main">{workOrder.targetQuantity || 0}</span>
                                <span className="text-[10px] text-text-muted ml-1 font-sans font-normal">Bags</span>
                            </div>
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

                        const isCompleted = status === 'COMPLETED';
                        const isActive = status === 'ACTIVE';
                        const isSkipped = status === 'SKIPPED';

                        return (
                            <div
                                key={cfg.key}
                                className={`rounded-lg p-2.5 flex flex-col justify-between transition-all duration-200 min-h-[90px] ${
                                    isCompleted
                                        ? 'bg-green-50 border border-green-200 text-green-700'
                                        : isActive
                                        ? 'bg-orange-50 border border-orange-400 text-orange-800 shadow-sm'
                                        : isSkipped
                                        ? 'bg-gray-100/70 border border-gray-200 text-gray-400 opacity-60'
                                        : 'bg-transparent border border-gray-200 text-gray-400'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isCompleted ? 'text-green-700' : isActive ? 'text-orange-800' : isSkipped ? 'text-gray-400' : 'text-gray-400'
                                    }`}>
                                        STEP 0{cfg.sequence}
                                    </span>

                                    {isCompleted ? (
                                        <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                                    ) : isActive ? (
                                        <Play size={14} className="text-orange-600 fill-orange-600 shrink-0 animate-pulse" />
                                    ) : isSkipped ? (
                                        <Ban size={14} className="text-gray-400 shrink-0" />
                                    ) : null}
                                </div>

                                <div className="mt-1">
                                    <h4 className={`text-xs font-semibold leading-tight ${
                                        isCompleted ? 'text-green-800' : isActive ? 'text-orange-900' : isSkipped ? 'text-gray-400 line-through' : 'text-gray-500'
                                    }`}>
                                        {cfg.label}
                                    </h4>

                                    {isCompleted && (
                                        <p className="text-[9px] text-green-600 font-medium mt-1">
                                            Good: {stageData?.goodOutputQty || 0} | Defect: {stageData?.rejectedQty || 0}
                                        </p>
                                    )}

                                    {isActive && (
                                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100/80 px-1 py-0.5 rounded mt-1">
                                            • Active
                                        </span>
                                    )}

                                    {isSkipped && (
                                        <span className="inline-block text-[9px] font-bold text-gray-400 bg-gray-200/80 px-1 py-0.5 rounded mt-1">
                                            Skipped — Not Required
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Panel: Record Live Stage Output & Defect Scrap */}
            {isFinishedOrCancelled ? (
                (workOrder.status === 'COMPLETED' || (workOrder?.stages && workOrder.stages.filter(s => s.status !== 'SKIPPED').every(s => s.status === 'COMPLETED'))) ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center shadow-2xs space-y-2 font-sans">
                        <CheckCircle2 className="text-emerald-500 mx-auto" size={40} />
                        <h4 className="text-sm font-extrabold text-emerald-900 uppercase tracking-wider">Production Successfully Completed</h4>
                        <p className="text-xs text-emerald-700 max-w-md mx-auto">
                            All pipeline stages are finished. The final output has been moved to Finished Goods inventory.
                        </p>
                    </div>
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
                                Record Live Stage Output & Defect Scrap
                            </h3>
                            <p className="text-xs text-sidebar-text mt-0.5">
                                Currently Processing: <strong className="text-amber-400">STEP 0{activeStage.sequence} — {STAGE_CONFIG.find(c => c.key === activeStage.stageName)?.label || activeStage.stageName}</strong>
                            </p>
                        </div>

                        {/* Maximum Available Quantity Badge */}
                        <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-lg text-xs font-semibold">
                            Max Available Input: <strong className="font-mono text-white">{maxAvailableQty} Bags</strong>
                        </div>
                    </div>

                    <form onSubmit={handleAdvanceStage} className="space-y-3 font-sans">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
                                    Good Output Bags Produced *
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={maxAvailableQty}
                                    required
                                    placeholder={`Max ${maxAvailableQty} bags`}
                                    value={goodOutputQty}
                                    onChange={(e) => setGoodOutputQty(e.target.value)}
                                    className={`w-full border rounded-lg p-2 bg-card-bg text-text-main text-xs font-bold focus:outline-none ${
                                        isExceedingCap ? 'border-rose-500 focus:border-rose-500' : 'border-sidebar-hover focus:border-primary'
                                    }`}
                                />
                                {isExceedingCap && (
                                    <p className="text-[11px] font-bold text-rose-400 mt-1">
                                        ⚠️ Good output cannot exceed previous stage passed quantity of {maxAvailableQty} bags.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
                                    Rejected / Defect Bags (Auto-Calculated)
                                </label>
                                <input
                                    type="number"
                                    readOnly
                                    disabled
                                    value={autoRejectedQty}
                                    className="w-full border border-sidebar-hover rounded-lg p-2 bg-app-bg text-amber-400 text-xs font-mono font-bold focus:outline-none cursor-not-allowed opacity-90"
                                />
                                <span className="text-[10px] text-sidebar-text mt-1 block">
                                    Auto-filled as ({maxAvailableQty} available − {numGoodOutput || 0} passed)
                                </span>
                            </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || isExceedingCap}
                                className="bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                            >
                                <span>{isSubmitting ? 'Advancing Stage...' : 'Advance Stage & Update Stock'}</span>
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
