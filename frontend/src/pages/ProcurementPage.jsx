import { useState } from 'react';
import { Plus, Download, Truck, FileText, Check, ClipboardList, Eye, Pencil, X } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreatePurchaseOrderPanel from '../components/procurement/CreatePurchaseOrderPanel';
import CreateGRNPanel from '../components/procurement/CreateGRNPanel';
import CreateMaterialReceiptPanel from '../components/procurement/CreateMaterialReceiptPanel';
import PrintPOModal from '../components/procurement/PrintPOModal';
import DetailViewModal from '../components/shared/DetailViewModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { isTenantAdmin } from '../utils/permissionUtils';

export default function ProcurementPage() {
    const user = useAuthStore((state) => state.user);
    const isAdmin = isTenantAdmin(user);
    const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
    const [editPo, setEditPo] = useState(null);
    const [selectedPoForGrn, setSelectedPoForGrn] = useState(null);
    const [isGrnPanelOpen, setIsGrnPanelOpen] = useState(false);
    const [isMatReceiptOpen, setIsMatReceiptOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState('purchase-orders');

    // Detail View Modal State
    const [viewRecord, setViewRecord] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Print PO Modal State
    const [isPrintPoOpen, setIsPrintPoOpen] = useState(false);
    const [selectedPoForPrint, setSelectedPoForPrint] = useState(null);

    // Export CSV Handler
    const handleExportCsv = async () => {
        try {
            toast.loading('Generating Purchase Orders CSV export...', { id: 'po-csv-export' });
            const res = await axiosInstance.get('/purchase-orders?limit=500');

            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const poList = res.data.data;
                const headers = ['PO_NUMBER', 'SUPPLIER_NAME', 'PO_DATE', 'EXPECTED_DELIVERY', 'TOTAL_VALUE_INR', 'STATUS'];
                const csvRows = [headers.join(',')];

                poList.forEach((po) => {
                    const suppName = typeof po.supplier === 'object' ? (po.supplier?.companyName || po.supplier?.name) : (po.supplier || '');
                    const dateStr = po.poDate ? new Date(po.poDate).toLocaleDateString() : '';
                    const expStr = po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '';

                    const row = [
                        `"${(po.poNumber || '').replace(/"/g, '""')}"`,
                        `"${suppName.replace(/"/g, '""')}"`,
                        `"${dateStr}"`,
                        `"${expStr}"`,
                        `"${po.totalValue || 0}"`,
                        `"${po.status || 'DRAFT'}"`
                    ];
                    csvRows.push(row.join(','));
                });

                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Purchase_Orders_Export_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(`Exported ${poList.length} Purchase Order records to CSV!`, { id: 'po-csv-export' });
            } else {
                toast.error('No Purchase Order data found to export', { id: 'po-csv-export' });
            }
        } catch (err) {
            console.error('Error exporting PO CSV:', err);
            toast.error(err.response?.data?.message || 'Failed to export CSV file', { id: 'po-csv-export' });
        }
    };

    // ─── Purchase Orders columns ─────────────────────────────────────────────
    const poColumns = [
        {
            header: 'PO NUMBER',
            exportValue: (row) => row.poNumber || '',
            render: (row) => <span className="font-mono font-bold text-primary uppercase">{row.poNumber || '-'}</span>,
            sortable: true
        },
        {
            header: 'SUPPLIER NAME',
            exportValue: (row) => (typeof row.supplier === 'object' ? (row.supplier?.companyName || row.supplier?.name) : row.supplier) || '',
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {typeof row.supplier === 'object' ? (row.supplier?.companyName || row.supplier?.name) : (row.supplier || '-')}
                </span>
            ),
            sortable: true
        },
        {
            header: 'PO DATE',
            exportValue: (row) => row.poDate || row.createdAt || '',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.poDate ? new Date(row.poDate).toLocaleDateString() : (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-')}
                </span>
            )
        },
        {
            header: 'EXPECTED DELIVERY',
            exportValue: (row) => row.expectedDelivery || '',
            render: (row) => (
                <span className="font-mono text-xs text-text-main font-semibold">
                    {row.expectedDelivery ? new Date(row.expectedDelivery).toLocaleDateString() : '-'}
                </span>
            )
        },
        {
            header: 'PO TOTAL VALUE (₹)',
            exportValue: (row) => (row.totalValue !== undefined ? row.totalValue : 0),
            render: (row) => (
                <span className="font-mono font-bold text-text-main">
                    ₹{(row.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'STATUS',
            exportValue: (row) => row.status || 'DRAFT',
            render: (row) => {
                const status = row.status || 'DRAFT';
                let badgeStyle = 'bg-gray-100 text-gray-800 border-gray-300';
                let label = status;

                switch (status) {
                    case 'DRAFT':
                        badgeStyle = 'bg-slate-100 text-slate-800 border-slate-300';
                        label = 'DRAFT';
                        break;
                    case 'PENDING_APPROVAL':
                        badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                        label = 'Pending Approval';
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
                const isPendingApproval = row.status === 'PENDING_APPROVAL';

                return (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setViewRecord(row);
                                setIsDetailModalOpen(true);
                            }}
                            className="text-gray-500 hover:text-blue-600 mr-1.5 cursor-pointer"
                            title="View Details"
                        >
                            <Eye size={14} />
                        </button>

                        {row.status === 'DRAFT' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditPo(row);
                                    setIsCreatePoOpen(true);
                                }}
                                className="text-gray-500 hover:text-amber-600 mr-1.5 cursor-pointer"
                                title="Edit Draft Purchase Order"
                            >
                                <Pencil size={14} />
                            </button>
                        )}

                        {isPendingApproval && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Pending Approval
                            </span>
                        )}

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
                                setSelectedPoForPrint(row);
                                setIsPrintPoOpen(true);
                            }}
                            className="p-1.5 text-text-muted hover:text-primary rounded hover:bg-app-bg transition-colors cursor-pointer"
                            title="Download & Print PO Document PDF"
                        >
                            <Download size={15} />
                        </button>


                    </div>
                );
            }
        }
    ];

    // ─── Material Receipts columns ────────────────────────────────────────────
    const mrColumns = [
        {
            header: 'RECEIPT #',
            exportValue: (row) => row.receiptNumber || '',
            render: (row) => <span className="font-mono font-bold text-primary uppercase">{row.receiptNumber || '-'}</span>,
            sortable: true
        },
        {
            header: 'DATE',
            exportValue: (row) => row.date || '',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.date ? new Date(row.date).toLocaleDateString('en-IN') : '-'}
                </span>
            )
        },
        {
            header: 'CUSTOMER',
            exportValue: (row) => (typeof row.customer === 'object' ? (row.customer?.companyName || row.customer?.name) : row.customer) || '',
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {typeof row.customer === 'object'
                        ? (row.customer?.companyName || row.customer?.name || '-')
                        : (row.customer || '-')}
                </span>
            ),
            sortable: true
        },
        {
            header: 'MATERIAL',
            exportValue: (row) => [row.materialDescription, row.laminationType].filter(Boolean).join(' / ') || '',
            render: (row) => (
                <span className="text-xs text-text-muted">
                    {[row.materialDescription, row.laminationType].filter(Boolean).join(' / ') || '-'}
                </span>
            )
        },
        {
            header: 'QTY (KG)',
            exportValue: (row) => (row.totalQuantityKg != null ? row.totalQuantityKg : 0),
            render: (row) => (
                <span className="font-mono text-xs font-semibold text-text-main">
                    {row.totalQuantityKg != null ? row.totalQuantityKg.toLocaleString('en-IN') : '-'}
                </span>
            )
        },
        {
            header: 'QTY (PCS)',
            exportValue: (row) => (row.totalQuantityPcs != null ? row.totalQuantityPcs : 0),
            render: (row) => (
                <span className="font-mono text-xs font-semibold text-text-main">
                    {row.totalQuantityPcs != null ? row.totalQuantityPcs.toLocaleString('en-IN') : '-'}
                </span>
            )
        },
        {
            header: 'TOTAL AMOUNT (₹)',
            exportValue: (row) => (row.totalInvoiceAmount != null ? row.totalInvoiceAmount : 0),
            render: (row) => (
                <span className="font-mono font-bold text-text-main">
                    ₹{(row.totalInvoiceAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'PRINT/PLAIN',
            exportValue: (row) => row.printOrPlain || 'PLAIN',
            render: (row) => {
                const v = row.printOrPlain || 'PLAIN';
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${v === 'PRINT'
                        ? 'bg-violet-100 text-violet-800 border-violet-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                        {v}
                    </span>
                );
            }
        }
    ];

    // ─── Tabs config ──────────────────────────────────────────────────────────
    const tabs = [
        {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            resourcePath: '/purchase-orders',
            columns: poColumns
        },
        {
            key: 'material-receipts',
            label: 'Job-Work Material Receipts',
            resourcePath: '/material-receipts',
            columns: mrColumns,
            isDeletable: false,
            isEditable: false
        }
    ];

    // ─── Dynamic header actions (depend on active tab) ─────────────────────────
    const headerActions = activeTab === 'material-receipts' ? (
        <button
            type="button"
            onClick={() => setIsMatReceiptOpen(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
        >
            <ClipboardList size={15} />
            <span>Log New Material Receipt</span>
        </button>
    ) : (
        <button
            type="button"
            onClick={() => {
                setEditPo(null);
                setIsCreatePoOpen(true);
            }}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
        >
            <Plus size={15} />
            <span>+ Issue New Purchase Order</span>
        </button>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Purchase & Job-Work Procurement"
                description="Manage Purchase Orders, GRN inward stock, and Job-Work Material Receipts"
                tabs={tabs}
                headerActions={headerActions}
                activeTabKey={activeTab}
                onTabChange={setActiveTab}
            />

            {/* Issue / Edit Purchase Order Panel */}
            <CreatePurchaseOrderPanel
                isOpen={isCreatePoOpen}
                editPo={editPo}
                onClose={() => {
                    setIsCreatePoOpen(false);
                    setEditPo(null);
                }}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Create GRN Panel */}
            <CreateGRNPanel
                isOpen={isGrnPanelOpen}
                onClose={() => {
                    setIsGrnPanelOpen(false);
                    setSelectedPoForGrn(null);
                }}
                po={selectedPoForGrn}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Job-Work Material Receipt Panel */}
            <CreateMaterialReceiptPanel
                isOpen={isMatReceiptOpen}
                onClose={() => setIsMatReceiptOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Print & Download PO Document Modal */}
            <PrintPOModal
                isOpen={isPrintPoOpen}
                onClose={() => setIsPrintPoOpen(false)}
                po={selectedPoForPrint}
            />

            {/* Read-Only Detail View Modal */}
            <DetailViewModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setViewRecord(null);
                }}
                record={viewRecord}
                tabKey={activeTab}
                tabLabel={activeTab === 'purchase-orders' ? 'Purchase Order' : 'Material Receipt'}
            />
        </>
    );
}
