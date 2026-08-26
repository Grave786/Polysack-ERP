import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreateQCInspectionModal from '../components/quality/CreateQCInspectionModal';

export default function QualityPage() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const tabs = [
        {
            key: 'qc-inspections',
            label: 'QC Inspections Lab Ledger',
            resourcePath: '/qc-inspections',
            columns: [
                {
                    header: 'QC CERTIFICATE #',
                    render: (row) => (
                        <span className="font-mono font-bold text-primary uppercase">
                            {row.qcCertificateNumber || row.inspectionNumber || '-'}
                        </span>
                    ),
                    sortable: true
                },
                {
                    header: 'WORK ORDER #',
                    render: (row) => (
                        <span className="font-mono font-semibold text-text-main">
                            {row.workOrder?.workOrderNumber || '-'}
                        </span>
                    )
                },
                {
                    header: 'PRODUCT SPEC',
                    render: (row) => (
                        <span className="font-semibold text-xs text-text-main max-w-[220px] truncate block" title={row.finishedGood?.name || ''}>
                            {row.finishedGood?.name || '-'}
                        </span>
                    )
                },
                {
                    header: 'SAMPLE SIZE',
                    render: (row) => <span className="font-mono">{row.sampleSize || 0}</span>
                },
                {
                    header: 'PASSED QTY',
                    render: (row) => (
                        <span className="font-mono font-bold text-emerald-700">
                            {row.passedQty !== undefined ? row.passedQty : (row.passedQuantity || 0)}
                        </span>
                    )
                },
                {
                    header: 'REJECTED QTY',
                    render: (row) => (
                        <span className="font-mono font-bold text-rose-700">
                            {row.rejectedQty !== undefined ? row.rejectedQty : (row.failedQuantity || 0)}
                        </span>
                    )
                },
                {
                    header: 'TENSILE STRENGTH',
                    render: (row) => (
                        <span className="font-mono font-medium">
                            {row.tensileStrength ? `${row.tensileStrength} N` : '-'}
                        </span>
                    )
                },
                {
                    header: 'QC STATUS',
                    render: (row) => {
                        const status = row.qcStatus || row.result || 'PENDING';
                        const isPassed = status === 'PASSED';
                        const isRejected = status === 'REJECTED';

                        return (
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                    isPassed
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isRejected
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                            >
                                • {status}
                            </span>
                        );
                    }
                }
            ]
        }
    ];

    const createQcButton = (
        <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
        >
            <Plus size={15} />
            <span>+ New Quality Inspection</span>
        </button>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Quality Assurance & Inspection Lab"
                description="Manage factory quality lab tests, tensile strength certifications, defect scrap, and QC release approvals."
                tabs={tabs}
                headerActions={createQcButton}
            />

            <CreateQCInspectionModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
