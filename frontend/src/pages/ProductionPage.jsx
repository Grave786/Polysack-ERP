import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import ProductionStageMonitor from '../components/production/ProductionStageMonitor';
import PendingProductionTab from '../components/production/PendingProductionTab';
import CreateWorkOrderModal from '../components/production/CreateWorkOrderModal';
import DetailViewModal from '../components/shared/DetailViewModal';
import { Layers, Activity, FileText, Plus, Eye, Pencil, AlertTriangle, ClipboardList, Link2 } from 'lucide-react';
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

    const [searchParams, setSearchParams] = useSearchParams();
    const woIdFromUrl = searchParams.get('id');

    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
    const [activeTabKey, setActiveTabKey] = useState(woIdFromUrl ? 'work-orders' : 'pending-production');
    const [pendingCount, setPendingCount] = useState(0);
    const [initialSoLine, setInitialSoLine] = useState(null);

    // One-time consumption of redirect tab param
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTabKey(tab);
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('tab');
                return next;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (woIdFromUrl) {
            axiosInstance.get(`/work-orders/${woIdFromUrl}`).then((res) => {
                if (res.data?.success && res.data?.data) {
                    setViewOrderRecord(res.data.data);
                }
            }).catch(() => {});
        }
    }, [woIdFromUrl]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editOrderRecord, setEditOrderRecord] = useState(null);
    const [viewOrderRecord, setViewOrderRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [woToCancel, setWoToCancel] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [approvalFilter, setApprovalFilter] = useState('ALL');

    useEffect(() => {
        axiosInstance.get('/work-orders/pending-production?limit=1')
            .then((res) => {
                if (res.data?.success) {
                    const count = res.data.summary?.linesPending ?? res.data.pagination?.total ?? res.data.count ?? 0;
                    setPendingCount(Number(count) || 0);
                }
            })
            .catch(() => {});
    }, [refreshKey]);

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
            key: 'pending-production',
            label: 'Pending for Production',
            badgeCount: pendingCount,
            isAddable: false,
            icon: ClipboardList,
            customRender: () => (
                <PendingProductionTab
                    refreshKey={refreshKey}
                    onCreateWorkOrderFromLine={(line) => {
                        setInitialSoLine(line);
                        setEditOrderRecord(null);
                        setIsCreateModalOpen(true);
                    }}
                    onViewWorkOrder={(woId) => {
                        if (!woId) return;
                        axiosInstance.get(`/work-orders/${woId}`).then((res) => {
                            if (res.data?.success && res.data?.data) {
                                setViewOrderRecord(res.data.data);
                            }
                        }).catch(() => {});
                    }}
                    onCountChange={(cnt) => setPendingCount(Number(cnt) || 0)}
                />
            )
        },
        {
            key: 'work-orders',
            label: 'Active Work Orders',
            icon: Layers,
            resourcePath: '/work-orders',
            exportMapper: (data) => data.map(row => {
                const u = row.unit || row.jobOrderDetails?.totalOrderQuantityUnit || 'Bags';
                return {
                    'WORK ORDER #': row.workOrderNumber || row.code || '',
                    'SO NUMBER': row.salesOrderNumber || 'Unlinked',
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
                    header: 'SO NUMBER',
                    accessor: 'salesOrderNumber',
                    exportValue: (row) => row.salesOrderNumber || 'Unlinked',
                    render: (row) => {
                        if (row.salesOrderNumber) {
                            return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                    <Link2 size={11} />
                                    {row.salesOrderNumber}
                                </span>
                            );
                        }
                        return (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-text-muted font-medium">Unlinked</span>
                                {isAdmin && row.status !== 'CANCELLED' && row.status !== 'COMPLETED' && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditOrderRecord(row);
                                        }}
                                        className="px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10 border border-primary/30 rounded cursor-pointer transition-colors"
                                        title="Link to Sales Order"
                                    >
                                        Link SO
                                    </button>
                                )}
                            </div>
                        );
                    }
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
                    exportValue: (row) => `${Number(row.targetPcs ?? row.targetQuantity ?? 0)} Bags (${Number(row.targetKg || 0).toFixed(2)} Kg)`,
                    render: (row) => {
                        const bags = Number(row.targetPcs ?? row.targetQuantity ?? 0);
                        const kg = Number(row.targetKg || 0);
                        return (
                            <div className="font-mono leading-tight">
                                <span className="font-bold text-text-main">
                                    {bags.toLocaleString('en-IN')} <span className="text-[10px] text-text-muted font-normal">Bags</span>
                                </span>
                                {kg > 0 && (
                                    <span className="block text-[10px] text-text-muted">
                                        ({kg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg{row.isEstimatedTargetWeight ? ' est.' : ''})
                                    </span>
                                )}
                            </div>
                        );
                    }
                },
                {
                    header: 'COMPLETED QTY',
                    exportValue: (row) => `${Number(row.completedPcs ?? row.completedQuantity ?? 0)} Bags / ${Number(row.completedKg || 0).toFixed(2)} Kg`,
                    render: (row) => {
                        const compBags = Number(row.completedPcs ?? row.completedQuantity ?? 0);
                        const compKg = Number(row.completedKg || 0);
                        const balBags = Number(row.balancePcs ?? row.balanceQuantity ?? 0);
                        const balKg = Number(row.balanceKg || 0);
                        return (
                            <div className="space-y-1">
                                <span className="font-extrabold text-text-main font-mono block">
                                    {compBags.toLocaleString('en-IN')} <span className="text-[10px] text-text-muted font-normal">Bags</span>
                                    <span className="text-[10px] text-text-muted font-normal"> / {compKg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg</span>
                                </span>
                                {balBags > 0 && (
                                    <div>
                                        {row.continuationWorkOrder ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-800/60 whitespace-nowrap">
                                                Continued in: {row.continuationWorkOrder?.workOrderNumber || 'WO'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800/60 whitespace-nowrap">
                                                Balance: {balBags.toLocaleString('en-IN')} Bags{balKg > 0 ? ` (${balKg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg)` : ''} Pending
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
                    exportValue: (row) => `${row.status || 'PENDING'} (${row.approvalStatus || 'APPROVED'})`,
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

                        const appStatus = row.approvalStatus || 'APPROVED';
                        const appBadgeStyle =
                            appStatus === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : appStatus === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-300'
                                    : 'bg-amber-50 text-amber-800 border border-amber-300';
                        const appLabel =
                            appStatus === 'APPROVED'
                                ? 'Approved'
                                : appStatus === 'REJECTED'
                                    ? 'Rejected'
                                    : 'Pending Approval';

                        return (
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${badgeStyle}`}>
                                        {label}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${appBadgeStyle}`}>
                                        {appLabel}
                                    </span>
                                </div>
                                {appStatus === 'REJECTED' && row.rejectionReason && (
                                    <p className="text-[10px] text-rose-700 font-medium max-w-[200px] truncate" title={row.rejectionReason}>
                                        Reason: {row.rejectionReason}
                                    </p>
                                )}
                            </div>
                        );
                    }
                },
                {
                    header: 'ACTIONS',
                    render: (row) => {
                        const appStatus = row.approvalStatus || 'APPROVED';
                        const isApproved = appStatus === 'APPROVED';
                        const isCreator = row.createdBy && String(row.createdBy?._id || row.createdBy) === String(user?._id);
                        const canEditRow = isAdmin || (!isApproved && isCreator);

                        return (
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
                                {canEditRow && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditOrderRecord(row);
                                        }}
                                        className="text-gray-500 hover:text-blue-600 mr-2 cursor-pointer"
                                        title={appStatus === 'REJECTED' ? 'Edit & Resubmit Work Order' : 'Edit Work Order'}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={!isApproved}
                                    onClick={() => { if (isApproved) handleTrackJob(row._id); }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all shadow-2xs ${
                                        isApproved
                                            ? 'bg-sidebar-bg hover:bg-black text-white cursor-pointer'
                                            : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-70'
                                    }`}
                                    title={!isApproved ? (appStatus === 'REJECTED' ? 'Work Order was rejected' : 'Work Order is awaiting approval') : 'Track Stage Progress'}
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
                                ) : (isApproved && row.status === 'COMPLETED' && row.balanceQuantity > 0 && (
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
                        );
                    }
                }
            ]
        },
        {
            key: 'stage-monitor',
            label: 'Live Production Pipeline Monitor',
            isAddable: false,
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
                key={`${refreshKey}`}
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
                extraFilterControls={activeTabKey === 'work-orders' ? (
                    <div className="flex items-center gap-1.5 bg-card-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-main shadow-2xs select-none">
                        <span className="text-[11px] font-bold text-text-muted">Approval:</span>
                        <select
                            value={approvalFilter}
                            onChange={(e) => setApprovalFilter(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-text-main focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Approvals</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                ) : null}
                extraFilterParams={activeTabKey === 'work-orders' && approvalFilter !== 'ALL' ? { approvalStatus: approvalFilter } : undefined}
            />

            <CreateWorkOrderModal
                isOpen={isCreateModalOpen || Boolean(editOrderRecord)}
                workOrderToEdit={editOrderRecord}
                initialSoLine={initialSoLine}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditOrderRecord(null);
                    setInitialSoLine(null);
                }}
                onSuccess={() => {
                    setRefreshKey((prev) => prev + 1);
                    setEditOrderRecord(null);
                    setInitialSoLine(null);
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
