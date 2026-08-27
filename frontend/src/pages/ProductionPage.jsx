import { useState } from 'react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import ProductionStageMonitor from '../components/production/ProductionStageMonitor';
import CreateWorkOrderModal from '../components/production/CreateWorkOrderModal';
import { Layers, Activity, FileText, Plus } from 'lucide-react';

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
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
    const [activeTabKey, setActiveTabKey] = useState('work-orders');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleTrackJob = (workOrderId) => {
        setSelectedWorkOrderId(workOrderId);
        setActiveTabKey('stage-monitor');
    };

    const tabs = [
        {
            key: 'work-orders',
            label: 'Active Work Orders',
            icon: Layers,
            resourcePath: '/work-orders',
            columns: [
                {
                    header: 'WORK ORDER #',
                    accessor: 'workOrderNumber',
                    sortable: true
                },
                {
                    header: 'CUSTOMER / CLIENT',
                    render: (row) => row.customer?.companyName || row.customer?.name || '-'
                },
                {
                    header: 'PRODUCT SPECIFICATION',
                    render: (row) => row.finishedGood?.name || '-'
                },
                {
                    header: 'TARGET BAGS',
                    accessor: 'targetQuantity',
                    render: (row) => <span className="font-mono font-medium">{row.targetQuantity || 0}</span>
                },
                {
                    header: 'COMPLETED BAGS',
                    render: (row) => <span className="font-extrabold text-text-main font-mono">{row.completedQuantity || 0}</span>
                },
                {
                    header: 'STAGE PROGRESS',
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
                    render: (row) => row.assignedMachine?.code || row.assignedMachine?.name || '-'
                },
                {
                    header: 'STATUS',
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
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleTrackJob(row._id)}
                                className="bg-sidebar-bg hover:bg-black text-white px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                            >
                                <Activity size={13} />
                                <span>Track Job</span>
                            </button>
                            {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
                                <button
                                    type="button"
                                    onClick={() => handleCancelWorkOrder(row._id)}
                                    className="border border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-900 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer"
                                    title="Cancel Work Order"
                                >
                                    Cancel Order
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
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
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
