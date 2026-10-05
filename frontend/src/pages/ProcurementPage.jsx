import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Truck, FileText, Check, Eye, Pencil, X } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreatePurchaseOrderPanel from '../components/procurement/CreatePurchaseOrderPanel';
import CreateGRNPanel from '../components/procurement/CreateGRNPanel';
import PrintPOModal from '../components/procurement/PrintPOModal';
import DetailViewModal from '../components/shared/DetailViewModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { isTenantAdmin } from '../utils/permissionUtils';

export default function ProcurementPage() {
    const user = useAuthStore((state) => state.user);
    const isAdmin = isTenantAdmin(user);
    const [searchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');


    const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
    const [editPo, setEditPo] = useState(null);
    const [selectedPoForGrn, setSelectedPoForGrn] = useState(null);
    const [editGrn, setEditGrn] = useState(null);
    const [isGrnPanelOpen, setIsGrnPanelOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState(tabFromUrl || 'purchase-orders');

    useEffect(() => {
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl, activeTab]);

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

    // Format quantity string and filter out raw 24-character hexadecimal MongoDB ObjectIds
    const formatQty = (qty, unit) => {
        if (!unit) return `${qty} Kg`;
        if (typeof unit === 'string' && /^[0-9a-fA-F]{24}$/.test(unit.trim())) {
            return `${qty} Kg`;
        }
        return `${qty} ${unit}`;
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
            header: 'ORDERED vs RECEIVED',
            exportValue: (row) => {
                const items = Array.isArray(row.items) ? row.items : [];
                const byUnit = {};
                for (const i of items) {
                    const u = (typeof i.unit === 'string' && !/^[0-9a-fA-F]{24}$/.test(i.unit.trim())) ? i.unit.trim() : 'Kg';
                    if (!byUnit[u]) byUnit[u] = { ord: 0, rcv: 0 };
                    byUnit[u].ord += Number(i.orderedQuantity || 0);
                    byUnit[u].rcv += Number(i.receivedQuantity || 0);
                }
                const entries = Object.entries(byUnit);
                return entries.length > 0
                    ? entries.map(([u, d]) => `${d.rcv} / ${d.ord} ${u}`).join(', ')
                    : '0 / 0 Kg';
            },
            render: (row) => {
                const items = Array.isArray(row.items) ? row.items : [];
                const byUnit = {};
                let totalOrdAll = 0;
                let totalRcvAll = 0;
                for (const i of items) {
                    const u = (typeof i.unit === 'string' && !/^[0-9a-fA-F]{24}$/.test(i.unit.trim())) ? i.unit.trim() : 'Kg';
                    if (!byUnit[u]) byUnit[u] = { ord: 0, rcv: 0 };
                    const ord = Number(i.orderedQuantity || 0);
                    const rcv = Number(i.receivedQuantity || 0);
                    byUnit[u].ord += ord;
                    byUnit[u].rcv += rcv;
                    totalOrdAll += ord;
                    totalRcvAll += rcv;
                }

                const unitEntries = Object.entries(byUnit);
                const pct = totalOrdAll > 0 ? Math.min(100, Math.round((totalRcvAll / totalOrdAll) * 100)) : 0;

                const orderedVsRcvText = unitEntries.length > 0
                    ? unitEntries.map(([u, d]) => `${d.rcv % 1 === 0 ? d.rcv.toLocaleString('en-IN') : Number(d.rcv.toFixed(3)).toLocaleString('en-IN')} / ${d.ord % 1 === 0 ? d.ord.toLocaleString('en-IN') : Number(d.ord.toFixed(3)).toLocaleString('en-IN')} ${u}`).join(', ')
                    : '0 / 0 Kg';

                const remainingText = unitEntries.length > 0
                    ? unitEntries.map(([u, d]) => {
                        const rem = Math.max(0, d.ord - d.rcv);
                        return `${rem % 1 === 0 ? rem.toLocaleString('en-IN') : Number(rem.toFixed(3)).toLocaleString('en-IN')} ${u}`;
                    }).join(', ')
                    : '0 Kg';

                return (
                    <div className="space-y-1 min-w-[130px]">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-text-main">
                                {orderedVsRcvText}
                            </span>
                            <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-text-muted'}`}>
                                {pct}%
                            </span>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-text-muted flex justify-between font-mono">
                            <span>Remaining: <strong className={pct < 100 ? 'text-amber-600' : 'text-emerald-600'}>{remainingText}</strong></span>
                        </div>
                    </div>
                );
            }
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
                            onClick={async () => {
                                try {
                                    const res = await axiosInstance.get(`/purchase-orders/${row._id}`);
                                    if (res.data?.success && res.data.data) {
                                        setViewRecord(res.data.data);
                                    } else {
                                        setViewRecord(row);
                                    }
                                } catch {
                                    setViewRecord(row);
                                }
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

                        {isAdmin && (row.status === 'PENDING_APPROVAL' || row.status === 'SENT_TO_SUPPLIER') && (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const res = await axiosInstance.get(`/purchase-orders/${row._id}`);
                                        if (res.data?.success && res.data.data) {
                                            setEditPo(res.data.data);
                                        } else {
                                            setEditPo(row);
                                        }
                                    } catch {
                                        setEditPo(row);
                                    }
                                    setIsCreatePoOpen(true);
                                }}
                                className="text-gray-500 hover:text-amber-600 mr-1.5 cursor-pointer"
                                title={row.status === 'PENDING_APPROVAL' ? "Edit Pending Approval PO" : "Edit Sent to Supplier PO"}
                            >
                                <Pencil size={14} />
                            </button>
                        )}

                        {isAdmin && (row.status === 'PARTIALLY_RECEIVED' || row.status === 'FULLY_RECEIVED') && (
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const grnRes = await axiosInstance.get(`/grns?purchaseOrder=${row._id}`);
                                        const grnList = grnRes.data?.data || [];
                                        if (grnList.length > 0) {
                                            setEditGrn(grnList[0]);
                                        } else {
                                            setEditGrn(null);
                                        }
                                    } catch (err) {
                                        setEditGrn(null);
                                    }
                                    setSelectedPoForGrn(row);
                                    setIsGrnPanelOpen(true);
                                }}
                                className="text-gray-500 hover:text-amber-600 mr-1.5 cursor-pointer"
                                title="Edit GRN Item Receipts (Tenant Admin Only)"
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
                                    setEditGrn(null);
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

    // ─── Goods Receipt Notes (GRN) columns ───────────────────────────────────
    const grnColumns = [
        {
            header: 'GRN #',
            exportValue: (row) => row.grnNumber || '',
            render: (row) => <span className="font-mono font-bold text-primary uppercase">{row.grnNumber || '-'}</span>,
            sortable: true
        },
        {
            header: 'RECEIVED DATE',
            exportValue: (row) => row.receivedDate || '',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.receivedDate ? new Date(row.receivedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'PO NUMBER',
            exportValue: (row) => (typeof row.purchaseOrder === 'object' ? row.purchaseOrder?.poNumber : row.purchaseOrder) || '',
            render: (row) => (
                <span className="font-mono font-semibold text-text-main">
                    {(typeof row.purchaseOrder === 'object' ? row.purchaseOrder?.poNumber : row.purchaseOrder) || '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'SUPPLIER',
            exportValue: (row) => (typeof row.supplier === 'object' ? (row.supplier?.companyName || row.supplier?.name) : row.supplier) || '',
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {typeof row.supplier === 'object' ? (row.supplier?.companyName || row.supplier?.name || '-') : (row.supplier || '-')}
                </span>
            ),
            sortable: true
        },
        {
            header: 'LOCATION',
            exportValue: (row) => (typeof row.receivingLocation === 'object' ? row.receivingLocation?.name : row.receivingLocation) || '',
            render: (row) => (
                <span className="text-xs text-text-muted">
                    {typeof row.receivingLocation === 'object' ? row.receivingLocation?.name || '-' : (row.receivingLocation || '-')}
                </span>
            )
        },
        {
            header: 'RECEIVED ITEMS & ROLLS',
            exportValue: (row) => {
                const byUnit = {};
                for (const i of row.items || []) {
                    const u = i.unit || 'Kg';
                    byUnit[u] = (byUnit[u] || 0) + (Number(i.receivedQuantity) || 0);
                }
                return Object.entries(byUnit).map(([u, q]) => `${q % 1 === 0 ? q : q.toFixed(3)} ${u}`).join(', ');
            },
            render: (row) => {
                const items = row.items || [];
                const byUnit = {};
                for (const it of items) {
                    const u = it.unit || 'Kg';
                    const q = Number(it.receivedQuantity) || 0;
                    byUnit[u] = (byUnit[u] || 0) + q;
                }
                const unitEntries = Object.entries(byUnit);
                const qtyText = unitEntries.length > 0
                    ? unitEntries.map(([u, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(3)).toLocaleString('en-IN')} ${u}`).join(', ')
                    : '0 Kg';
                const rollCount = Array.isArray(row.rolls) ? row.rolls.length : 0;
                return (
                    <div className="text-xs">
                        <span className="font-mono font-bold text-emerald-800">{qtyText}</span>
                        {rollCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {rollCount} Roll{rollCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'AUDIT',
            exportValue: (row) => row.lastEditedAt ? `Last edited by ${row.lastEditedBy?.name || 'Admin'} on ${new Date(row.lastEditedAt).toLocaleDateString('en-GB').replace(/\//g, '-')}` : '',
            render: (row) => {
                if (!row.lastEditedAt) return <span className="text-text-muted text-[11px]">-</span>;
                const editorName = typeof row.lastEditedBy === 'object' ? (row.lastEditedBy?.name || 'Admin') : 'Admin';
                const dateStr = new Date(row.lastEditedAt).toLocaleDateString('en-GB').replace(/\//g, '-');
                return (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-300"
                        title={`Last edited by ${editorName} on ${dateStr}`}
                    >
                        Edited: {dateStr}
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
                        onClick={() => {
                            setViewRecord(row);
                            setIsDetailModalOpen(true);
                        }}
                        className="text-gray-500 hover:text-blue-600 mr-1.5 cursor-pointer"
                        title="View GRN Details"
                    >
                        <Eye size={14} />
                    </button>
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditGrn(row);
                                setSelectedPoForGrn(row.purchaseOrder);
                                setIsGrnPanelOpen(true);
                            }}
                            className="text-gray-500 hover:text-amber-600 mr-1.5 cursor-pointer"
                            title="Edit Goods Receipt Note (Tenant Admin Only)"
                        >
                            <Pencil size={14} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    // ─── Tabs config ──────────────────────────────────────────────────────────
    // ─── Purchase Register line-item columns ─────────────────────────────────
    const purchaseRegisterColumns = [
        {
            header: 'PO #',
            exportValue: (row) => row.poNumber || '',
            render: (row) => <span className="font-mono font-bold text-primary uppercase text-xs">{row.poNumber || '-'}</span>,
            sortable: true
        },
        {
            header: 'PO DATE',
            exportValue: (row) => row.poDate ? new Date(row.poDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '',
            render: (row) => (
                <span className="font-mono text-xs text-text-main whitespace-nowrap">
                    {row.poDate ? new Date(row.poDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'SUPPLIER NAME & GSTIN',
            exportValue: (row) => `${row.supplierName || ''} (${row.supplierGstin || ''})`,
            render: (row) => (
                <div className="space-y-0.5">
                    <div className="font-bold text-xs text-text-main">{row.supplierName || '-'}</div>
                    <div className="text-[10.5px] font-mono text-text-muted flex items-center gap-1">
                        <span>GSTIN: {row.supplierGstin || '-'}</span>
                        {row.supplierCity && row.supplierCity !== '-' && <span>• {row.supplierCity}</span>}
                    </div>
                </div>
            ),
            sortable: true
        },
        {
            header: 'MATERIAL / QUALITY / GRADE',
            exportValue: (row) => `${row.materialName || ''} (${row.materialCode || ''}) - ${row.materialGrade || ''}`,
            render: (row) => (
                <div className="flex flex-col max-w-full overflow-hidden">
                    <span className="font-bold text-gray-900 text-sm whitespace-normal break-words">
                        {row.materialName || '-'}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5 whitespace-normal break-words line-clamp-2">
                        • {row.materialCode !== '-' ? row.materialCode : ''} {row.materialGrade !== '-' ? `• ${row.materialGrade}` : ''} {row.grammage !== '-' ? `• ${row.grammage}` : ''}
                    </span>
                </div>
            ),
            sortable: true
        },
        {
            header: 'HSN CODE',
            exportValue: (row) => row.hsnCode || '39012000',
            render: (row) => <span className="font-mono text-xs text-text-muted">{row.hsnCode || '39012000'}</span>
        },
        {
            header: 'ORDERED QTY',
            exportValue: (row) => formatQty(Number(row.orderedQuantity || 0).toLocaleString('en-IN'), row.unit),
            render: (row) => (
                <span className="font-mono font-bold text-xs text-text-main">
                    {formatQty(Number(row.orderedQuantity || 0).toLocaleString('en-IN'), row.unit)}
                </span>
            )
        },
        {
            header: 'RECEIVED QTY',
            exportValue: (row) => formatQty(Number(row.receivedQuantity || 0).toLocaleString('en-IN'), row.unit),
            render: (row) => (
                <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {formatQty(Number(row.receivedQuantity || 0).toLocaleString('en-IN'), row.unit)}
                </span>
            )
        },
        {
            header: 'PENDING QTY',
            exportValue: (row) => formatQty(Number(row.pendingQuantity || 0).toLocaleString('en-IN'), row.unit),
            render: (row) => (
                <span className={`font-mono font-bold text-xs ${Number(row.pendingQuantity || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'}`}>
                    {formatQty(Number(row.pendingQuantity || 0).toLocaleString('en-IN'), row.unit)}
                </span>
            )
        },
        {
            header: 'RATE / UNIT (₹)',
            exportValue: (row) => row.ratePerUnit || 0,
            render: (row) => (
                <span className="font-mono text-xs text-text-main">
                    ₹{Number(row.ratePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'TAXABLE VALUE (₹)',
            exportValue: (row) => row.taxableValue || 0,
            render: (row) => (
                <span className="font-mono font-semibold text-xs text-text-main">
                    ₹{Number(row.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'GST (18%) (₹)',
            exportValue: (row) => row.gstAmount || 0,
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    ₹{Number(row.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'TOTAL VALUE (₹)',
            exportValue: (row) => row.totalValueWithTax || 0,
            render: (row) => (
                <span className="font-mono font-bold text-xs text-primary">
                    ₹{Number(row.totalValueWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'EXPECTED / RECD DATE',
            exportValue: (row) => {
                const exp = row.expectedDelivery ? new Date(row.expectedDelivery).toLocaleDateString('en-GB').replace(/\//g, '-') : '-';
                const act = row.actualReceivedDate ? new Date(row.actualReceivedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-';
                return `Exp: ${exp} | Recd: ${act}`;
            },
            render: (row) => (
                <div className="text-[11px] font-mono space-y-0.5 whitespace-nowrap">
                    <div className="text-text-main">Exp: {row.expectedDelivery ? new Date(row.expectedDelivery).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</div>
                    <div className="text-emerald-700 dark:text-emerald-400">Recd: {row.actualReceivedDate ? new Date(row.actualReceivedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}</div>
                </div>
            )
        },
        {
            header: 'LINKED GRN(s)',
            exportValue: (row) => row.linkedGrns || '-',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted font-medium">
                    {row.linkedGrns || '-'}
                </span>
            )
        },
        {
            header: 'TERMS & REMARKS',
            exportValue: (row) => `${row.paymentTerms || '-'} | ${row.remarks || '-'}`,
            render: (row) => (
                <div className="text-[11px] space-y-0.5 max-w-[180px]">
                    <div className="font-semibold text-text-main truncate" title={row.paymentTerms}>{row.paymentTerms || '-'}</div>
                    <div className="text-text-muted truncate text-[10px]" title={row.remarks}>{row.remarks || '-'}</div>
                </div>
            )
        },
        {
            header: 'STATUS',
            exportValue: (row) => row.status || 'DRAFT',
            render: (row) => {
                const status = row.status || 'DRAFT';
                let badgeStyle = 'bg-gray-100 text-gray-800 border-gray-300';
                if (status === 'FULLY_RECEIVED') badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                else if (status === 'PARTIALLY_RECEIVED') badgeStyle = 'bg-blue-100 text-blue-800 border-blue-300';
                else if (status === 'SENT_TO_SUPPLIER') badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                else if (status === 'CANCELLED') badgeStyle = 'bg-rose-100 text-rose-800 border-rose-300';
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}>
                        • {status.replace(/_/g, ' ')}
                    </span>
                );
            }
        }
    ];

    // Date range filter state for Purchase Register (IST YYYY-MM-DD)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const extraFilterParams = {
        ...(startDate && startDate.trim() ? { startDate: startDate.trim() } : {}),
        ...(endDate && endDate.trim() ? { endDate: endDate.trim() } : {})
    };

    // Date filter controls slot
    const dateFilterControls = (
        <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                <label className="text-[10px] font-bold text-text-muted uppercase">From:</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                />
            </div>
            <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                <label className="text-[10px] font-bold text-text-muted uppercase">To:</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                />
            </div>
            {(startDate || endDate) && (
                <button
                    type="button"
                    onClick={() => {
                        setStartDate('');
                        setEndDate('');
                    }}
                    className="px-2 py-1 text-[11px] text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-semibold cursor-pointer"
                    title="Clear Date Filter"
                >
                    Clear
                </button>
            )}
        </div>
    );

    // Purchase Register Export Handlers (CSV + PDF)
    const handleExportPurchaseRegisterCsv = async () => {
        try {
            toast.loading('Generating Purchase Register CSV export...', { id: 'pr-csv-export' });
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await axiosInstance.get(`/purchase-orders/purchase-register?${params.toString()}`);
            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const list = res.data.data;
                const headers = [
                    'PO_NUMBER',
                    'PO_DATE',
                    'SUPPLIER_NAME',
                    'SUPPLIER_GSTIN',
                    'SUPPLIER_CITY',
                    'MATERIAL_NAME',
                    'MATERIAL_CODE',
                    'MATERIAL_GRADE',
                    'HSN_CODE',
                    'ORDERED_QTY',
                    'RECEIVED_QTY',
                    'PENDING_QTY',
                    'UNIT',
                    'RATE_PER_UNIT_INR',
                    'TAXABLE_VALUE_INR',
                    'GST_RATE_PCT',
                    'GST_AMOUNT_INR',
                    'TOTAL_VALUE_INR',
                    'EXPECTED_DELIVERY',
                    'ACTUAL_RECEIVED_DATE',
                    'LINKED_GRNS',
                    'PAYMENT_TERMS',
                    'STATUS',
                    'REMARKS'
                ];

                const csvRows = [headers.join(',')];
                list.forEach((r) => {
                    const row = [
                        `"${(r.poNumber || '').replace(/"/g, '""')}"`,
                        `"${r.poDate ? new Date(r.poDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${(r.supplierName || '').replace(/"/g, '""')}"`,
                        `"${(r.supplierGstin || '').replace(/"/g, '""')}"`,
                        `"${(r.supplierCity || '').replace(/"/g, '""')}"`,
                        `"${(r.materialName || '').replace(/"/g, '""')}"`,
                        `"${(r.materialCode || '').replace(/"/g, '""')}"`,
                        `"${(r.materialGrade || '').replace(/"/g, '""')}"`,
                        `"${(r.hsnCode || '').replace(/"/g, '""')}"`,
                        `"${Number(r.orderedQuantity || 0).toLocaleString('en-IN')}"`,
                        `"${Number(r.receivedQuantity || 0).toLocaleString('en-IN')}"`,
                        `"${Number(r.pendingQuantity || 0).toLocaleString('en-IN')}"`,
                        `"${(r.unit || 'Kg').replace(/"/g, '""')}"`,
                        `"${Number(r.ratePerUnit || 0).toFixed(2)}"`,
                        `"${Number(r.taxableValue || 0).toFixed(2)}"`,
                        `"${r.gstRate || 18}"`,
                        `"${Number(r.gstAmount || 0).toFixed(2)}"`,
                        `"${Number(r.totalValueWithTax || 0).toFixed(2)}"`,
                        `"${r.expectedDelivery ? new Date(r.expectedDelivery).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${r.actualReceivedDate ? new Date(r.actualReceivedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${(r.linkedGrns || '').replace(/"/g, '""')}"`,
                        `"${(r.paymentTerms || '').replace(/"/g, '""')}"`,
                        `"${(r.status || '').replace(/"/g, '""')}"`,
                        `"${(r.remarks || '').replace(/"/g, '""')}"`
                    ];
                    csvRows.push(row.join(','));
                });

                const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Purchase_Register_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(`Exported ${list.length} Purchase line items to CSV!`, { id: 'pr-csv-export' });
            } else {
                toast.error('No Purchase Register data found to export', { id: 'pr-csv-export' });
            }
        } catch (err) {
            console.error('Error exporting Purchase Register CSV:', err);
            toast.error(err.response?.data?.message || 'Failed to export Purchase Register CSV', { id: 'pr-csv-export' });
        }
    };

    const handleExportPurchaseRegisterPdf = async () => {
        try {
            toast.loading('Generating Purchase Register PDF report...', { id: 'pr-pdf-export' });
            const { generatePdfReport } = await import('../utils/pdfExportUtils');
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await axiosInstance.get(`/purchase-orders/purchase-register?${params.toString()}`);
            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const list = res.data.data;
                const totalTaxable = list.reduce((sum, r) => sum + Number(r.taxableValue || 0), 0);
                const totalGst = list.reduce((sum, r) => sum + Number(r.gstAmount || 0), 0);
                const totalAmount = list.reduce((sum, r) => sum + Number(r.totalValueWithTax || 0), 0);

                const summaryCards = [
                    { label: 'Total Purchase Line Items', value: list.length.toLocaleString('en-IN'), notes: 'Granular material line items' },
                    { label: 'Total Taxable Value', value: `₹${totalTaxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, notes: 'Before GST tax' },
                    { label: 'Total Input GST (18%)', value: `₹${totalGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, notes: 'Eligible ITC credit' },
                    { label: 'Total Gross Value', value: `₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, notes: 'Invoice gross payable' }
                ];

                const headers = ['PO #', 'Date', 'Supplier', 'Material Spec', 'Ordered', 'Recd', 'Rate (₹)', 'Taxable (₹)', 'GST (₹)', 'Total (₹)', 'Status'];
                const rows = list.map((r) => [
                    r.poNumber || '-',
                    r.poDate ? new Date(r.poDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-',
                    r.supplierName || '-',
                    `${r.materialName || '-'}${r.materialGrade !== '-' ? ' (' + r.materialGrade + ')' : ''}`,
                    `${Number(r.orderedQuantity || 0).toLocaleString('en-IN')} ${r.unit || 'Kg'}`,
                    `${Number(r.receivedQuantity || 0).toLocaleString('en-IN')} ${r.unit || 'Kg'}`,
                    `₹${Number(r.ratePerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `₹${Number(r.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `₹${Number(r.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `₹${Number(r.totalValueWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    r.status?.replace(/_/g, ' ') || 'DRAFT'
                ]);

                generatePdfReport({
                    title: 'Detailed Purchase Register',
                    subtitle: `Item-Wise Procurement & Vendor Tax Register • Period: ${startDate ? new Date(startDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'All'} to ${endDate ? new Date(endDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Today'}`,
                    generatedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
                    filename: `Purchase_Register_${Date.now()}.pdf`,
                    summaryCards,
                    sections: [
                        {
                            title: 'ITEM-WISE PURCHASE ORDERS & GRN INWARD REGISTER',
                            subtitle: 'One row per purchase line item with complete pricing, tax, and inward status',
                            headers,
                            rows
                        }
                    ]
                });
                toast.success('Generated Purchase Register PDF report!', { id: 'pr-pdf-export' });
            } else {
                toast.error('No Purchase Register data found to export', { id: 'pr-pdf-export' });
            }
        } catch (err) {
            console.error('Error generating Purchase Register PDF:', err);
            toast.error('Failed to generate Purchase Register PDF report', { id: 'pr-pdf-export' });
        }
    };

    // ─── Tabs config ──────────────────────────────────────────────────────────
    const tabs = [
        {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            resourcePath: '/purchase-orders',
            columns: poColumns
        },
        {
            key: 'grns',
            label: 'Goods Receipt Notes (GRN)',
            resourcePath: '/grns',
            columns: grnColumns,
            isDeletable: false,
            isEditable: false
        },
        {
            key: 'purchase-register',
            label: 'Purchase Register (Detailed)',
            resourcePath: '/purchase-orders/purchase-register',
            columns: purchaseRegisterColumns,
            isDeletable: false,
            isEditable: false
        }
    ];

    // ─── Dynamic header actions ───────────────────────────────────────────────
    const headerActions = (
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {activeTab === 'purchase-register' ? (
                <>
                    <button
                        type="button"
                        onClick={handleExportPurchaseRegisterCsv}
                        className="flex items-center gap-1.5 px-3 py-2 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                        title="Export item-wise Purchase Register in CSV format"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExportPurchaseRegisterPdf}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                        title="Export item-wise Purchase Register in PDF format"
                    >
                        <FileText size={14} />
                        <span>Export PDF</span>
                    </button>
                </>
            ) : null}
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
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={`${refreshKey}-${activeTab}`}
                title="Purchase & GRN Management"
                description="Manage Purchase Orders, Goods Receipt Notes (GRN) and Item-Wise Detailed Purchase Register"
                tabs={tabs}
                headerActions={headerActions}
                filterSlot={activeTab === 'purchase-register' ? dateFilterControls : null}
                extraFilterParams={activeTab === 'purchase-register' ? extraFilterParams : null}
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

            {/* Create / Edit GRN Panel */}
            <CreateGRNPanel
                isOpen={isGrnPanelOpen}
                onClose={() => {
                    setIsGrnPanelOpen(false);
                    setSelectedPoForGrn(null);
                    setEditGrn(null);
                }}
                po={selectedPoForGrn}
                editGrn={editGrn}
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
                tabLabel={activeTab === 'purchase-orders' ? 'Purchase Order' : 'Goods Receipt Note'}
            />
        </>
    );
}
