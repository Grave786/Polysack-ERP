import { useState } from 'react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import ProductionStageMonitor from '../components/production/ProductionStageMonitor';
import CreateWorkOrderModal from '../components/production/CreateWorkOrderModal';
import DetailViewModal from '../components/shared/DetailViewModal';
import { Layers, Activity, FileText, Plus, Eye, Pencil, AlertTriangle } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { isTenantAdmin, checkIsSuperAdmin } from '../utils/permissionUtils';

const STAGE_LABELS = {
    TAPE_EXTRUSION: 'Tape Extrusion',
    CIRCULAR_WEAVING: 'Circular Weaving',
    EXTRUSION_LAMINATION: 'Extrusion Lamination',
    FLEXO_PRINTING: 'Flexo Printing',
    CUTTING_SEWING: 'Cutting & Sewing',
    STITCHING: 'Stitching',
    HANDLE_ATTACHMENT: 'Handle Attachment',
    BALING_PACKING: 'Baling & Packing'
};

export default function ProductionPage() {
    const user = useAuthStore((state) => state.user);
    const isAdmin = isTenantAdmin(user) || checkIsSuperAdmin(user);

    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
    const [activeTabKey, setActiveTabKey] = useState('work-orders');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editOrderRecord, setEditOrderRecord] = useState(null);
    const [viewOrderRecord, setViewOrderRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [woToCancel, setWoToCancel] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);

    const handleTrackJob = (workOrderId) => {
        setSelectedWorkOrderId(workOrderId);
        setActiveTabKey('stage-monitor');
    };

    const handleResumeBalance = async (workOrderId) => {
        if (!workOrderId) return;
        try {
            const res = await axiosInstance.patch(`/work-orders/${workOrderId}/resume-balance`);
            if (res.data?.success) {
                const newWo = res.data?.data || res.data?.continuationWorkOrder;
                toast.success(res.data?.message || 'Continuation Work Order created for balance production');
                if (newWo?._id) {
                    setSelectedWorkOrderId(newWo._id);
                    setActiveTabKey('stage-monitor');
                } else {
                    setSelectedWorkOrderId(workOrderId);
                    setActiveTabKey('stage-monitor');
                }
                setRefreshKey((prev) => prev + 1);
            } else {
                toast.error(res.data?.message || 'Failed to resume Work Order');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to resume Work Order');
        }
    };

    const handleConfirmCancel = async () => {
        const id = woToCancel?._id || woToCancel;
        if (!id) return;
        try {
            setIsCancelling(true);
            const res = await axiosInstance.patch(`/work-orders/${id}/cancel`);
            if (res.data?.success) {
                toast.success('Work Order cancelled successfully');
                setCancelModalOpen(false);
                setWoToCancel(null);
                setRefreshKey((prev) => prev + 1);
            } else {
                toast.error(res.data?.message || 'Failed to cancel Work Order');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to cancel Work Order');
        } finally {
            setIsCancelling(false);
        }
    };

    const tabs = [
        {
            key: 'work-orders',
            label: 'Active Work Orders',
            icon: Layers,
            resourcePath: '/work-orders',
            exportMapper: (data) => data.map(row => {
                const u = row.unit || row.jobOrderDetails?.totalOrderQuantityUnit || 'Bags';
                return {
                    'WORK ORDER #': row.workOrderNumber || row.code || '',
                    'CUSTOMER / CLIENT': row.customer?.companyName || row.customerName || '',
                    'WORK TITLE': row.finishedGood?.productName || row.workTitle || '',
                    'TARGET QTY': `${Number(row.targetQuantity || 0).toLocaleString('en-IN')} ${u}`,
                    'COMPLETED QTY': `${Number(row.completedQuantity || 0).toLocaleString('en-IN')} ${u}`,
                    'STAGE PROGRESS': row.currentStage || '',
                    'MACHINE': row.machine?.machineName || row.machineAllocation?.machineName || '',
                    'STATUS': row.status || ''
                };
            }),
            columns: [
                {
                    header: 'WORK ORDER #',
                    accessor: 'workOrderNumber',
                    exportValue: (row) => row.workOrderNumber || row.code || '',
                    sortable: true
                },
                {
                    header: 'CUSTOMER / CLIENT',
                    exportValue: (row) => row.customer?.companyName || row.customer?.name || row.customerName || '',
                    render: (row) => row.customer?.companyName || row.customer?.name || '-'
                },
                {
                    header: 'WORK TITLE',
                    title: 'WORK TITLE',
                    exportValue: (row) => row.description || row.remarks || row.jobOrderDetails?.description || row.finishedGood?.name || row.workTitle || '',
                    render: (row) => {
                        const desc = row.description || row.remarks || row.jobOrderDetails?.description || row.finishedGood?.name || '-';
                        return (
                            <div className="text-xs text-gray-800 whitespace-normal break-words line-clamp-3 min-w-[250px]" title={desc}>
                                {desc}
                            </div>
                        );
                    }
                },
                {
                    header: 'TARGET QTY',
                    accessor: 'targetQuantity',
                    exportValue: (row) => row.targetQuantity || 0,
                    render: (row) => {
                        const u = row.unit || row.jobOrderDetails?.totalOrderQuantityUnit || 'Bags';
                        return (
                            <span className="font-mono font-medium">
                                {Number(row.targetQuantity || 0).toLocaleString('en-IN')} <span className="text-[10px] text-text-muted">{u}</span>
                            </span>
                        );
                    }
                },
                {
                    header: 'COMPLETED QTY',
                    exportValue: (row) => row.completedQuantity || 0,
                    render: (row) => {
                        const u = row.unit || row.jobOrderDetails?.totalOrderQuantityUnit || 'Bags';
                        return (
                            <div className="space-y-1">
                                <span className="font-extrabold text-text-main font-mono">
                                    {Number(row.completedQuantity || 0).toLocaleString('en-IN')} <span className="text-[10px] text-text-muted font-normal">{u}</span>
                                </span>
                                {row.balanceQuantity > 0 && (
                                    <div>
                                        {row.continuationWorkOrder ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-800/60 whitespace-nowrap">
                                                Continued in: {row.continuationWorkOrder?.workOrderNumber || 'WO'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800/60 whitespace-nowrap">
                                                Balance: {Number(row.balanceQuantity).toLocaleString('en-IN')} {u} Pending
                                            </span>
                                        )}
                                    </div>
                                )}
                                {row.parentWorkOrder && (
                                    <div>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 whitespace-nowrap">
                                            Continuation of: {row.parentWorkOrder?.workOrderNumber || 'WO'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    }
                },
                {
                    header: 'STAGE PROGRESS',
                    exportValue: (row) => {
                        const completedStagesCount = Array.isArray(row.stages) ? row.stages.filter((s) => s.status === 'COMPLETED').length : 0;
                        const activeStagesCount = Array.isArray(row.stages) ? row.stages.filter((s) => s.status !== 'SKIPPED').length : 8;
                        const allStagesDone = Array.isArray(row.stages) && activeStagesCount > 0 && row.stages.filter(s => s.status !== 'SKIPPED').every(s => s.status === 'COMPLETED');
                        const isFullyDone = row.status === 'COMPLETED' || allStagesDone || (row.progressPercentage === 100);

                        const pct = isFullyDone
                            ? 100
                            : row.progressPercentage !== undefined
                                ? row.progressPercentage
                                : Math.min(100, Math.round((completedStagesCount / Math.max(1, activeStagesCount)) * 100));

                        const activeStage = Array.isArray(row.stages) ? row.stages.find((s) => s.status === 'ACTIVE') : null;
                        const activeLabel = isFullyDone
                            ? 'Completed'
                            : activeStage
                                ? (STAGE_LABELS[activeStage.stageName] || activeStage.stageName)
                                : 'Pending';

                        return `${activeLabel} (${pct}%)`;
                    },
                    render: (row) => {
                        const completedQty = Number(row.completedQuantity || 0);
                        const targetQty = Number(row.targetQuantity || 1);
                        const completedStagesCount = Array.isArray(row.stages) ? row.stages.filter((s) => s.status === 'COMPLETED').length : 0;
                        const activeStagesCount = Array.isArray(row.stages) ? row.stages.filter((s) => s.status !== 'SKIPPED').length : 8;
                        const allStagesDone = Array.isArray(row.stages) && activeStagesCount > 0 && row.stages.filter(s => s.status !== 'SKIPPED').every(s => s.status === 'COMPLETED');
                        const isFullyDone = row.status === 'COMPLETED' || allStagesDone || (row.progressPercentage === 100);

                        const pct = isFullyDone
                            ? 100
                            : row.progressPercentage !== undefined
                                ? row.progressPercentage
                                : Math.min(100, Math.round((completedStagesCount / Math.max(1, activeStagesCount)) * 100));

                        const activeStage = Array.isArray(row.stages) ? row.stages.find((s) => s.status === 'ACTIVE') : null;
                        const activeLabel = isFullyDone
                            ? 'Completed'
                            : activeStage
                                ? (STAGE_LABELS[activeStage.stageName] || activeStage.stageName)
                                : 'Pending';

                        return (
                            <div className="w-36 space-y-1 font-sans">
                                <div className="flex justify-between text-[11px] font-semibold text-text-main">
                                    <span className="truncate max-w-[95px]" title={activeLabel}>
                                        {activeLabel}
                                    </span>
                                    <span className="text-primary font-mono font-bold">{pct}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full rounded-full transition-all duration-300"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    }
                },
                {
                    header: 'MACHINE',
                    exportValue: (row) => row.assignedMachine?.code || row.assignedMachine?.name || row.machine?.machineName || row.machineAllocation?.machineName || '',
                    render: (row) => row.assignedMachine?.code || row.assignedMachine?.name || '-'
                },
                {
                    header: 'STATUS',
                    exportValue: (row) => row.status || 'PENDING',
                    render: (row) => {
                        const status = row.status || 'PENDING';
                        const badgeStyle =
                            status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : status === 'CANCELLED'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-gray-100 text-gray-700 border border-gray-300';
                        const label = status === 'IN_PROGRESS' ? 'In Progress' : status;

                        return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${badgeStyle}`}>
                                {label}
                            </span>
                        );
                    }
                },
                {
                    header: 'ACTIONS',
                    render: (row) => (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewOrderRecord(row);
                                }}
                                className="text-gray-500 hover:text-blue-600 mr-2 cursor-pointer"
                                title="View Details"
                            >
                                <Eye size={14} />
                            </button>
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditOrderRecord(row);
                                    }}
                                    className="text-gray-500 hover:text-blue-600 mr-2 cursor-pointer"
                                    title="Edit Work Order"
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => handleTrackJob(row._id)}
                                className="bg-sidebar-bg hover:bg-black text-white px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                            >
                                <Activity size={13} />
                                <span>Track</span>
                            </button>
                            {row.continuationWorkOrder ? (
                                <button
                                    type="button"
                                    onClick={() => handleTrackJob(row.continuationWorkOrder?._id || row.continuationWorkOrder)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-2 py-1 rounded-md text-xs transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                                    title="View continuation Work Order"
                                >
                                    Continuation ({row.continuationWorkOrder?.workOrderNumber || 'WO'})
                                </button>
                            ) : (row.status === 'COMPLETED' && row.balanceQuantity > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleResumeBalance(row._id)}
                                    className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-2 py-1 rounded-md text-xs transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                                    title="Resume balance production for remaining bags"
                                >
                                    Resume Balance
                                </button>
                            ))}
                            {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
                                <button
                                    type="button"
                                    onClick={() => { setWoToCancel(row); setCancelModalOpen(true); }}
                                    className="border border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-900 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer"
                                    title="Cancel Work Order"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    )
                }
            ]
        },
        {
            key: 'stage-monitor',
            label: 'Live Production Pipeline Monitor',
            icon: Activity,
            customRender: () => (
                <ProductionStageMonitor
                    workOrderId={selectedWorkOrderId}
                    onSelectWorkOrder={(id) => setSelectedWorkOrderId(id)}
                />
            )
        }
    ];

    const createWorkOrderButton = (activeTabKey === 'work-orders' || activeTabKey === 'stage-monitor') ? (
        <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
        >
            <Plus size={15} />
            <span>+ Create Work Order</span>
        </button>
    ) : null;

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Shop Floor Manufacturing Engine"
                description="Manage factory Work Orders, monitor live production pipeline stage progress, and configure Bill of Materials (BOM) recipes."
                tabs={tabs}
                activeTabKey={activeTabKey}
                onTabChange={setActiveTabKey}
                onAddClick={(key) => {
                    if (key === 'work-orders' || key === 'stage-monitor') {
                        setIsCreateModalOpen(true);
                    }
                }}
                headerActions={createWorkOrderButton}
            />

            <CreateWorkOrderModal
                isOpen={isCreateModalOpen || Boolean(editOrderRecord)}
                workOrderToEdit={editOrderRecord}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditOrderRecord(null);
                }}
                onSuccess={() => {
                    setRefreshKey((prev) => prev + 1);
                    setEditOrderRecord(null);
                }}
            />

            <DetailViewModal
                isOpen={Boolean(viewOrderRecord)}
                onClose={() => setViewOrderRecord(null)}
                record={viewOrderRecord}
                tabKey="work-orders"
                tabLabel="Work Order"
            />

            {/* Custom Cancel Confirmation Modal */}
            {cancelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full font-sans">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                                <AlertTriangle size={22} />
                            </div>
                            <h3 className="text-base font-bold text-gray-900">
                                Cancel Work Order
                            </h3>
                        </div>
                        <p className="text-xs text-gray-600 mb-6 leading-relaxed">
                            Are you sure you want to cancel this? This action cannot be undone.
                            {woToCancel?.workOrderNumber && (
                                <span className="block mt-1 font-mono font-bold text-rose-600">
                                    {woToCancel.workOrderNumber}
                                </span>
                            )}
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setCancelModalOpen(false);
                                    setWoToCancel(null);
                                }}
                                disabled={isCancelling}
                                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Go Back
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCancel}
                                disabled={isCancelling}
                                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
