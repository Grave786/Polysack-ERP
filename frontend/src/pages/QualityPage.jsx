import { useState } from 'react';
import { Plus, ShieldCheck, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreateQCInspectionModal from '../components/quality/CreateQCInspectionModal';

export default function QualityPage() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [modalType, setModalType] = useState('INBOUND');
    const [refreshKey, setRefreshKey] = useState(0);

    const tabs = [
        {
            key: 'inbound-qc',
            label: 'Inbound QC (Raw Materials & GRN)',
            icon: ArrowDownLeft,
            resourcePath: '/qc-inspections?inspectionType=INBOUND',
            columns: [
                {
                    header: 'QC CERTIFICATE #',
                    render: (row) => (
                        <span className="font-mono font-bold text-primary uppercase">
                            {row.qcCertificateNumber || '-'}
                        </span>
                    ),
                    sortable: true
                },
                {
                    header: 'GRN / PO #',
                    render: (row) => (
                        <span className="font-mono font-semibold text-text-main">
                            {row.grn?.grnNumber || (row.po ? `PO-${row.po}` : 'Direct Receipt')}
                        </span>
                    )
                },
                {
                    header: 'RAW MATERIAL',
                    render: (row) => (
                        <span className="font-semibold text-xs text-text-main max-w-[220px] truncate block" title={row.rawMaterial?.name || ''}>
                            {row.rawMaterial?.name || '-'}
                        </span>
                    )
                },
                {
                    header: 'RECEIVED QTY',
                    render: (row) => <span className="font-mono font-bold">{row.receivedQty || (row.passedQty + row.rejectedQty) || 0}</span>
                },
                {
                    header: 'PASSED QTY',
                    render: (row) => (
                        <span className="font-mono font-bold text-emerald-700">
                            {row.passedQty !== undefined ? row.passedQty : 0}
                        </span>
                    )
                },
                {
                    header: 'REJECTED QTY',
                    render: (row) => (
                        <span className="font-mono font-bold text-rose-700">
                            {row.rejectedQty !== undefined ? row.rejectedQty : 0}
                        </span>
                    )
                },
                {
                    header: 'GSM TESTED',
                    render: (row) => (
                        <span className="font-mono font-medium">
                            {row.gsmTested ? `${row.gsmTested} GSM` : '-'}
                        </span>
                    )
                },
                {
                    header: 'QC STATUS',
                    render: (row) => {
                        const status = row.qcStatus || 'PASSED';
                        const isPassed = status === 'PASSED';
                        const isRejected = status === 'FAILED' || status === 'REJECTED';

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
        },
        {
            key: 'outbound-qc',
            label: 'Outbound QC (Finished Bags & Production)',
            icon: ArrowUpRight,
            resourcePath: '/qc-inspections?inspectionType=OUTBOUND',
            columns: [
                {
                    header: 'QC CERTIFICATE #',
                    render: (row) => (
                        <span className="font-mono font-bold text-primary uppercase">
                            {row.qcCertificateNumber || '-'}
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
                    header: 'FINISHED GOOD',
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
                            {row.passedQty !== undefined ? row.passedQty : 0}
                        </span>
                    )
                },
                {
                    header: 'REJECTED QTY',
                    render: (row) => (
                        <span className="font-mono font-bold text-rose-700">
                            {row.rejectedQty !== undefined ? row.rejectedQty : 0}
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
                        const status = row.qcStatus || 'PASSED';
                        const isPassed = status === 'PASSED';
                        const isRejected = status === 'FAILED' || status === 'REJECTED';

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
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => {
                    setModalType('INBOUND');
                    setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-card-bg hover:bg-app-bg border border-border text-text-main font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
            >
                <Plus size={14} className="text-primary" />
                <span>+ Log Inbound QC</span>
            </button>

            <button
                type="button"
                onClick={() => {
                    setModalType('OUTBOUND');
                    setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
            >
                <Plus size={15} />
                <span>+ Log Outbound QC</span>
            </button>
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Quality Assurance & Inspection Lab"
                description="Unified Quality Control gate: inspect raw material GRN inward (Inbound) and factory production batches (Outbound)."
                tabs={tabs}
                headerActions={createQcButton}
            />

            <CreateQCInspectionModal
                isOpen={isCreateModalOpen}
                defaultType={modalType}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
