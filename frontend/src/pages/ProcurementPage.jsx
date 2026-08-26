import { useState } from 'react';
import { Plus, Download, Truck } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreatePurchaseOrderPanel from '../components/procurement/CreatePurchaseOrderPanel';
import CreateGRNPanel from '../components/procurement/CreateGRNPanel';
import toast from 'react-hot-toast';

export default function ProcurementPage() {
    const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
    const [selectedPoForGrn, setSelectedPoForGrn] = useState(null);
    const [isGrnPanelOpen, setIsGrnPanelOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const columns = [
        {
            header: 'PO NUMBER',
            render: (row) => <span className="font-mono font-bold text-primary uppercase">{row.poNumber || '-'}</span>,
            sortable: true
        },
        {
            header: 'SUPPLIER NAME',
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {typeof row.supplier === 'object' ? (row.supplier?.companyName || row.supplier?.name) : (row.supplier || '-')}
                </span>
            ),
            sortable: true
        },
        {
            header: 'PO DATE',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.poDate ? new Date(row.poDate).toLocaleDateString() : (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-')}
                </span>
            )
        },
        {
            header: 'EXPECTED DELIVERY',
            render: (row) => (
                <span className="font-mono text-xs text-text-main font-semibold">
                    {row.expectedDelivery ? new Date(row.expectedDelivery).toLocaleDateString() : '-'}
                </span>
            )
        },
        {
            header: 'PO TOTAL VALUE (₹)',
            render: (row) => (
                <span className="font-mono font-bold text-text-main">
                    ₹{(row.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'STATUS',
            render: (row) => {
                const status = row.status || 'DRAFT';
                let badgeStyle = 'bg-gray-100 text-gray-800 border-gray-300';
                let label = status;

                switch (status) {
                    case 'DRAFT':
                        badgeStyle = 'bg-slate-100 text-slate-800 border-slate-300';
                        label = 'DRAFT';
                        break;
                    case 'SENT_TO_SUPPLIER':
                        badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                        label = 'Sent to Supplier';
                        break;
                    case 'PARTIALLY_RECEIVED':
                        badgeStyle = 'bg-blue-100 text-blue-800 border-blue-300';
                        label = 'Partially Received';
                        break;
                    case 'FULLY_RECEIVED':
                        badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                        label = 'Fully Received';
                        break;
                    case 'CANCELLED':
                        badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300';
                        label = 'Cancelled';
                        break;
                    default:
                        break;
                }

                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}>
                        • {label}
                    </span>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => {
                const canReceive = row.status === 'SENT_TO_SUPPLIER' || row.status === 'PARTIALLY_RECEIVED';

                return (
                    <div className="flex items-center gap-2">
                        {canReceive && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPoForGrn(row);
                                    setIsGrnPanelOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                                title="Receive GRN Inward Stock"
                            >
                                <Truck size={13} />
                                <span>Receive GRN</span>
                            </button>
                        )}

                        {/* Download PO PDF Export Icon Button */}
                        <button
                            type="button"
                            onClick={() => {
                                // TODO: PDF generation for Purchase Order
                                toast('PO PDF export coming soon', { icon: '📄' });
                            }}
                            className="p-1 text-text-muted hover:text-primary rounded hover:bg-app-bg transition-colors cursor-pointer"
                            title="Export PO Document"
                        >
                            <Download size={15} />
                        </button>
                    </div>
                );
            }
        }
    ];

    const tabs = [
        {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            resourcePath: '/purchase-orders',
            columns: columns
        }
    ];

    const headerCreateButton = (
        <button
            type="button"
            onClick={() => setIsCreatePoOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
        >
            <Plus size={15} />
            <span>+ Issue New Purchase Order</span>
        </button>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Purchase Orders & Goods Receipt (GRN)"
                description="Procure Poly Granules, Kraft Rolls & Inks with automated stock inward triggers"
                tabs={tabs}
                headerActions={headerCreateButton}
            />

            {/* Issue Purchase Order Panel */}
            <CreatePurchaseOrderPanel
                isOpen={isCreatePoOpen}
                onClose={() => setIsCreatePoOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Create GRN Panel */}
            <CreateGRNPanel
                isOpen={isGrnPanelOpen}
                onClose={() => setIsGrnPanelOpen(false)}
                po={selectedPoForGrn}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
