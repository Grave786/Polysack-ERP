import { useState, useEffect } from 'react';
import { CheckCircle2, Play, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const STAGE_CONFIG = [
    { sequence: 1, key: 'TAPE_EXTRUSION', label: 'Tape Extrusion' },
    { sequence: 2, key: 'CIRCULAR_WEAVING', label: 'Circular Weaving' },
    { sequence: 3, key: 'EXTRUSION_LAMINATION', label: 'Extrusion Lamination' },
    { sequence: 4, key: 'FLEXO_PRINTING', label: 'Flexo Printing' },
    { sequence: 5, key: 'CUTTING_SEWING', label: 'Cutting & Sewing' },
    { sequence: 6, key: 'BALING_PACKING', label: 'Baling & Packing' }
];

export default function ProductionStageMonitor({ workOrderId, onSelectWorkOrder }) {
    const [workOrder, setWorkOrder] = useState(null);
    const [allWorkOrders, setAllWorkOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [goodOutputQty, setGoodOutputQty] = useState('');
    const [rejectedQty, setRejectedQty] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Fetch single WorkOrder detail with full 6 stages
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

    // Handle Advance Stage submit
    const handleAdvanceStage = async (e) => {
        e.preventDefault();
        if (!workOrder?._id) return;

        const numGood = Number(goodOutputQty);
        const numRejected = Number(rejectedQty);

        if (isNaN(numGood) || numGood < 0 || isNaN(numRejected) || numRejected < 0) {
            toast.error('Please enter valid quantities >= 0');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await axiosInstance.patch(`/work-orders/${workOrder._id}/advance-stage`, {
                goodOutputQty: numGood,
                rejectedQty: numRejected
            });

            if (res.data?.success) {
                const activeStage = workOrder.stages?.find((s) => s.status === 'ACTIVE');
                if (activeStage?.sequence === 6) {
                    toast.success('Final stage completed! Batch output routed to Pending QC inspection.');
                } else {
                    toast.success(`Stage advanced successfully! Next stage activated.`);
                }

                setGoodOutputQty('');
                setRejectedQty('');

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
                <p className="text-xs font-semibold text-text-muted">Loading Live 6-Stage Process Monitor...</p>
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

    const activeStage = workOrder.stages?.find((s) => s.status === 'ACTIVE');
    const isFinishedOrCancelled = workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED' || !activeStage;

    const clientName = workOrder.customer?.companyName || workOrder.customer?.name || 'Unassigned';
    const machineName = workOrder.assignedMachine?.code || workOrder.assignedMachine?.name || 'Unassigned';
    const operatorName = workOrder.assignedMachine?.currentOperator || 'Unassigned';

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
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                                    Select Job:
                                </span>
                                <select
                                    value={workOrder._id}
                                    onChange={(e) => onSelectWorkOrder && onSelectWorkOrder(e.target.value)}
                                    className="text-xs font-semibold border border-border rounded-md py-1 px-2.5 focus:ring-primary focus:border-primary bg-card-bg text-text-main cursor-pointer"
                                >
                                    {allWorkOrders.map((w) => (
                                        <option key={w._id} value={w._id}>
                                            {w.workOrderNumber} - {w.customer?.companyName || 'Customer'} ({w.status})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="bg-app-bg border border-border rounded-lg px-3 py-2 text-right shrink-0 w-full md:w-auto">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                Target vs Completed
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

            {/* 6-Stage Pipeline Sequence */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2.5">
                    6-Stage Pipeline Sequence
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {STAGE_CONFIG.map((cfg) => {
                        const stageData = workOrder.stages?.find((s) => s.sequence === cfg.sequence || s.stageName === cfg.key);
                        const status = stageData?.status || 'PENDING';

                        const isCompleted = status === 'COMPLETED';
                        const isActive = status === 'ACTIVE';

                        return (
                            <div
                                key={cfg.key}
                                className={`rounded-lg p-3 flex flex-col justify-between transition-all duration-200 min-h-[85px] ${
                                    isCompleted
                                        ? 'bg-green-50 border border-green-200 text-green-700'
                                        : isActive
                                        ? 'bg-orange-50 border border-orange-400 text-orange-800 shadow-sm'
                                        : 'bg-transparent border border-gray-200 text-gray-400'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isCompleted ? 'text-green-700' : isActive ? 'text-orange-800' : 'text-gray-400'
                                    }`}>
                                        STEP 0{cfg.sequence}
                                    </span>

                                    {isCompleted ? (
                                        <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                                    ) : isActive ? (
                                        <Play size={15} className="text-orange-600 fill-orange-600 shrink-0 animate-pulse" />
                                    ) : null}
                                </div>

                                <div className="mt-1">
                                    <h4 className={`text-sm font-medium leading-snug ${
                                        isCompleted ? 'text-green-800' : isActive ? 'text-orange-900' : 'text-gray-500'
                                    }`}>
                                        {cfg.label}
                                    </h4>

                                    {isCompleted && (
                                        <p className="text-[10px] text-green-600 font-medium mt-1">
                                            Good: {stageData?.goodOutputQty || 0} | Defect: {stageData?.rejectedQty || 0}
                                        </p>
                                    )}

                                    {isActive && (
                                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded mt-1">
                                            • Active Stage
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
                <div className="bg-card-bg border border-border rounded-xl p-6 text-center shadow-2xs space-y-2">
                    <AlertCircle className="text-text-muted mx-auto" size={28} />
                    <h4 className="text-sm font-bold text-text-main">This Work Order Has No Active Stage</h4>
                    <p className="text-xs text-text-muted max-w-md mx-auto">
                        {workOrder.status === 'COMPLETED'
                            ? 'All 6 stages for this Work Order have been completed and routed to Pending QC inspection.'
                            : 'This Work Order has been cancelled or has no stage currently in progress.'}
                    </p>
                </div>
            ) : (
                <div className="bg-sidebar-bg text-sidebar-text-active border border-sidebar-hover rounded-xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-sidebar-hover pb-2.5">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                                Record Live Stage Output & Defect Scrap
                            </h3>
                            <p className="text-xs text-sidebar-text mt-0.5">
                                Currently Processing: <strong className="text-amber-400">STEP 0{activeStage.sequence} — {STAGE_CONFIG.find(c => c.key === activeStage.stageName)?.label || activeStage.stageName}</strong>
                            </p>
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
                                    required
                                    placeholder="e.g. 5000"
                                    value={goodOutputQty}
                                    onChange={(e) => setGoodOutputQty(e.target.value)}
                                    className="w-full border border-sidebar-hover rounded-lg p-2 bg-card-bg text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-white mb-1">
                                    Rejected / Defect Bags *
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    placeholder="e.g. 25"
                                    value={rejectedQty}
                                    onChange={(e) => setRejectedQty(e.target.value)}
                                    className="w-full border border-sidebar-hover rounded-lg p-2 bg-card-bg text-text-main text-xs font-bold focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
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
