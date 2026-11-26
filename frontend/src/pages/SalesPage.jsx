import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, Plus, FileText, CreditCard, Eye, Pencil, Receipt, CheckCircle2, DollarSign, AlertCircle, Users, Wallet, Check, X } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreateSalesOrderModal from '../components/sales/CreateSalesOrderModal';
import GenerateInvoiceModal from '../components/sales/GenerateInvoiceModal';
import RecordPaymentModal from '../components/sales/RecordPaymentModal';
import ViewSalesOrderModal from '../components/sales/ViewSalesOrderModal';
import ViewInvoiceModal from '../components/sales/ViewInvoiceModal';
import PartyAdvanceModal from '../components/shared/PartyAdvanceModal';
import { formatDate, isDateOverdue } from '../utils/dateUtils';
import axiosInstance from '../api/axiosInstance';
import { useAuthStore } from '../store/authStore';
import { hasApprovalPermission } from '../utils/permissionUtils';
import toast from 'react-hot-toast';

export default function SalesPage() {
    const user = useAuthStore((state) => state.user);
    const canApprove = hasApprovalPermission(user);
    const [approvingSoId, setApprovingSoId] = useState(null);
    const [rejectSoModal, setRejectSoModal] = useState({
        isOpen: false,
        salesOrder: null,
        remark: '',
        isSubmitting: false
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTabKey, setActiveTabKey] = useState('sales-orders');
    const [appliedDashboardFilter, setAppliedDashboardFilter] = useState(null);

    // One-time consumption of dashboard redirect params (tab & filter)
    useEffect(() => {
        const tab = searchParams.get('tab');
        const filter = searchParams.get('filter') || searchParams.get('paymentStatus') || searchParams.get('status');
        const isOutstanding = filter === 'outstanding' || filter === 'OUTSTANDING' || filter === 'UNPAID';

        if (tab || isOutstanding) {
            if (tab) {
                setActiveTabKey(tab);
            } else if (isOutstanding) {
                setActiveTabKey('invoices');
            }
            if (isOutstanding) {
                setAppliedDashboardFilter('OUTSTANDING');
            }
            // Consume and clear query parameters from the URL so subsequent tab navigation is clean and unrestricted
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const handleTabChange = (key) => {
        setActiveTabKey(key);
        // Clear the dashboard-applied filter when switching tabs so other tabs show normal data
        setAppliedDashboardFilter(null);
    };

    const [refreshKey, setRefreshKey] = useState(0);

    // Accounts Receivable Summary State
    const [receivablesSummary, setReceivablesSummary] = useState({
        totalReceivable: 0,
        overdueAmount: 0,
        customersWithDues: 0
    });

    useEffect(() => {
        axiosInstance.get('/invoices/receivables-summary')
            .then((res) => {
                if (res.data?.success && res.data.data) {
                    setReceivablesSummary(res.data.data);
                }
            })
            .catch((err) => {
                console.error('Error fetching receivables summary:', err);
            });
    }, [refreshKey]);

    // Modals State
    const [isCreateSoOpen, setIsCreateSoOpen] = useState(false);
    const [editingSoData, setEditingSoData] = useState(null);
    const [viewingSoData, setViewingSoData] = useState(null);
    const [productionFilter, setProductionFilter] = useState('ALL');

    const handleViewSo = async (row) => {
        setViewingSoData(row);
        if (!row?._id) return;
        try {
            const res = await axiosInstance.get(`/sales-orders/${row._id}`);
            if (res.data?.success && res.data?.data) {
                setViewingSoData(res.data.data);
            }
        } catch {
            // Keep existing row data if detail fetch fails
        }
    };

    const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
    const [recordingPaymentInvoice, setRecordingPaymentInvoice] = useState(null);
    const [viewingInvoiceData, setViewingInvoiceData] = useState(null);
    const [partyAdvanceModal, setPartyAdvanceModal] = useState({
        isOpen: false,
        partyId: null,
        partyName: '',
        mode: 'RECORD'
    });
    const [statusActionModal, setStatusActionModal] = useState({
        isOpen: false,
        salesOrder: null,
        targetStatus: '',
        remark: '',
        cancelLinkedWorkOrders: undefined,
        plannedWorkOrders: [],
        requiresWoDecision: false,
        isSubmitting: false
    });

    const handleQuickApproveSo = async (so) => {
        if (!so?._id) return;
        try {
            setApprovingSoId(so._id);
            const res = await axiosInstance.post(`/approvals/${so._id}/approve`, { remarks: 'Approved' });
            if (res.data?.success) {
                toast.success(`Sales Order ${so.soNumber || ''} approved!`);
                window.dispatchEvent(new CustomEvent('approval-count-changed'));
                window.dispatchEvent(new CustomEvent('notification-read'));
                setViewingSoData(null);
                setRefreshKey((k) => k + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve Sales Order');
        } finally {
            setApprovingSoId(null);
        }
    };

    const handleQuickRejectSo = async (e) => {
        e.preventDefault();
        const { salesOrder, remark } = rejectSoModal;
        if (!salesOrder?._id) return;
        if (!remark.trim()) {
            toast.error('Rejection remark is mandatory.');
            return;
        }
        try {
            setRejectSoModal((p) => ({ ...p, isSubmitting: true }));
            const res = await axiosInstance.post(`/approvals/${salesOrder._id}/reject`, { remarks: remark.trim() });
            if (res.data?.success) {
                toast.success(`Sales Order ${salesOrder.soNumber || ''} rejected.`);
                window.dispatchEvent(new CustomEvent('approval-count-changed'));
                window.dispatchEvent(new CustomEvent('notification-read'));
                setRejectSoModal({ isOpen: false, salesOrder: null, remark: '', isSubmitting: false });
                setViewingSoData(null);
                setRefreshKey((k) => k + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject Sales Order');
            setRejectSoModal((p) => ({ ...p, isSubmitting: false }));
        }
    };

    const openStatusActionModal = (so, targetStatus) => {
        setStatusActionModal({
            isOpen: true,
            salesOrder: so,
            targetStatus,
            remark: '',
            cancelLinkedWorkOrders: undefined,
            plannedWorkOrders: so?.dependencies?.plannedWorkOrders || [],
            requiresWoDecision: false,
            isSubmitting: false
        });
    };

    const handleConfirmStatusAction = async (e) => {
        e.preventDefault();
        const { salesOrder, targetStatus, remark, cancelLinkedWorkOrders } = statusActionModal;
        if (!salesOrder?._id) return;

        if ((targetStatus === 'CANCELLED' || targetStatus === 'DISPATCHED') && !remark.trim()) {
            toast.error(targetStatus === 'CANCELLED' ? 'Cancellation reason is required.' : 'Dispatch remark is required.');
            return;
        }

        try {
            setStatusActionModal((prev) => ({ ...prev, isSubmitting: true }));
            const res = await axiosInstance.patch(`/sales-orders/${salesOrder._id}/status`, {
                status: targetStatus,
                remark: remark.trim(),
                cancellationReason: targetStatus === 'CANCELLED' ? remark.trim() : undefined,
                ...(cancelLinkedWorkOrders !== undefined ? { cancelLinkedWorkOrders } : {})
            });
            if (res.data?.success) {
                toast.success(res.data.message || `Status updated to ${targetStatus}`);
                setStatusActionModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
                setRefreshKey((prev) => prev + 1);
                if (viewingSoData?._id === salesOrder._id) {
                    handleViewSo(salesOrder);
                }
            }
        } catch (err) {
            const data = err.response?.data;
            if (err.response?.status === 409 && data?.requiresWoDecision) {
                setStatusActionModal((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    requiresWoDecision: true,
                    plannedWorkOrders: data.plannedWorkOrders || [],
                    cancelLinkedWorkOrders: true
                }));
                return;
            }
            toast.error(data?.message || 'Failed to update Sales Order status.');
            setStatusActionModal((prev) => ({ ...prev, isSubmitting: false }));
        }
    };

    // Sales Orders Tab Columns
    const salesOrderColumns = [
        {
            header: 'SO NUMBER',
            exportValue: (row) => row.soNumber || '',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => handleViewSo(row)}
                    className="font-mono font-bold uppercase text-primary hover:underline text-xs cursor-pointer text-left"
                >
                    {row.soNumber || '-'}
                </button>
            ),
            sortable: true
        },
        {
            header: 'CUSTOMER / BUYER',
            exportValue: (row) => row.customer?.companyName || row.customer?.name || row.customerName || (typeof row.sourceEnquiry === 'object' ? (row.sourceEnquiry?.customer?.companyName || row.sourceEnquiry?.customerRef?.companyName || row.sourceEnquiry?.newCustomerDetails?.company || row.sourceEnquiry?.newCustomerDetails?.name) : '') || '-',
            render: (row) => {
                const se = typeof row.sourceEnquiry === 'object' ? row.sourceEnquiry : null;
                const seCust = se?.customer || se?.customerRef;
                const custName = 
                    row.customer?.companyName || 
                    row.customer?.name || 
                    row.customerName || 
                    seCust?.companyName || 
                    seCust?.name || 
                    se?.newCustomerDetails?.company || 
                    se?.newCustomerDetails?.name || 
                    '-';
                return (
                    <div className="font-extrabold text-text-main text-xs">
                        {custName}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'ORDER DATE',
            exportValue: (row) => formatDate(row.orderDate),
            render: (row) => (
                <span className="font-mono text-text-muted text-xs">
                    {formatDate(row.orderDate)}
                </span>
            )
        },
        {
            header: 'DELIVERY DUE',
            exportValue: (row) => formatDate(row.deliveryDue),
            render: (row) => (
                <span className="font-mono font-semibold text-text-main text-xs">
                    {formatDate(row.deliveryDue)}
                </span>
            )
        },
        {
            header: 'ORDERED QUANTITY',
            exportValue: (row) => {
                const items = Array.isArray(row.items) ? row.items : [];
                const totals = items.reduce((acc, it) => {
                    const q = Number(it.quantity || 0);
                    if (q > 0) {
                        const u = it.unit || 'Pcs';
                        acc[u] = (acc[u] || 0) + q;
                    }
                    return acc;
                }, {});
                const entries = Object.entries(totals);
                return entries.length > 0
                    ? entries.map(([u, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(3)).toLocaleString('en-IN')} ${u}`).join(' + ')
                    : (row.totalQuantity ? `${row.totalQuantity}` : '-');
            },
            render: (row) => {
                const items = Array.isArray(row.items) ? row.items : [];
                const totals = items.reduce((acc, it) => {
                    const q = Number(it.quantity || 0);
                    if (q > 0) {
                        const u = it.unit || 'Pcs';
                        acc[u] = (acc[u] || 0) + q;
                    }
                    return acc;
                }, {});
                const entries = Object.entries(totals);
                const text = entries.length > 0
                    ? entries.map(([u, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(3)).toLocaleString('en-IN')} ${u}`).join(' + ')
                    : (row.totalQuantity ? `${row.totalQuantity}` : '-');

                return (
                    <span className="font-mono font-bold text-text-main text-xs">
                        {text}
                    </span>
                );
            }
        },
        {
            header: 'GRAND TOTAL',
            exportValue: (row) => {
                const subtotal = row.totalAmount !== undefined ? row.totalAmount : (row.totalValue || 0);
                if (row.gstTreatment === 'EXEMPT') return subtotal;
                return row.grandTotal !== undefined ? row.grandTotal : Math.round(subtotal * 1.18);
            },
            render: (row) => {
                const subtotal = row.totalAmount !== undefined ? row.totalAmount : (row.totalValue || 0);
                const isExempt = row.gstTreatment === 'EXEMPT';
                const grandTotal = isExempt ? subtotal : (row.grandTotal !== undefined ? row.grandTotal : Math.round(subtotal * 1.18));
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-extrabold text-text-main text-xs">
                            ₹{grandTotal.toLocaleString()}
                        </span>
                        {isExempt && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                GST Exempt
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'STATUS',
            exportValue: (row) => {
                if (row.soApprovalStatus === 'Pending Approval') return 'Pending Approval';
                if (row.soApprovalStatus === 'Rejected') return 'Rejected';
                return row.status || 'CONFIRMED';
            },
            render: (row) => {
                if (row.soApprovalStatus === 'Pending Approval') {
                    return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block bg-amber-100 text-amber-800 border border-amber-300">
                            Pending Approval
                        </span>
                    );
                }
                if (row.soApprovalStatus === 'Rejected') {
                    return (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block bg-rose-100 text-rose-800 border border-rose-300" title={row.approvalRemarks || ''}>
                            Rejected
                        </span>
                    );
                }
                const st = row.status || 'CONFIRMED';
                const isConfirmed = st === 'CONFIRMED';
                const isDraft = st === 'DRAFT';
                const isPartiallyDispatched = st === 'PARTIALLY_DISPATCHED';
                const isDispatched = st === 'DISPATCHED' || st === 'READY_FOR_DISPATCH' || st === 'FULLY_DISPATCHED';
                const isCancelled = st === 'CANCELLED';

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${
                        isConfirmed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isDraft
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isPartiallyDispatched
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : isDispatched
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                        {st.replace(/_/g, ' ')}
                    </span>
                );
            }
        },
        {
            header: 'PRODUCTION',
            accessor: 'productionStatus',
            exportValue: (row) => row.productionStatus || 'Not Planned',
            render: (row) => {
                const ps = row.productionStatus || 'Not Planned';
                const badgeCls =
                    ps === 'Production Completed'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : ps === 'In Production'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : ps === 'Fully Planned'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : ps === 'Partially Planned'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200';
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap inline-block ${badgeCls}`}>
                        {ps}
                    </span>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => (
                <div className="flex items-center gap-1.5 justify-end">
                    <button
                        type="button"
                        onClick={() => handleViewSo(row)}
                        className="px-2 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-text-main rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        title="View Details"
                    >
                        <Eye size={13} />
                    </button>

                    {row.status !== 'CANCELLED' && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSoData(row);
                                setIsCreateSoOpen(true);
                            }}
                            className="px-2 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-primary rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Edit Sales Order"
                        >
                            <Pencil size={13} />
                        </button>
                    )}

                    {row.soApprovalStatus === 'Pending Approval' && canApprove && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleQuickApproveSo(row)}
                                disabled={approvingSoId === row._id}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Approve Sales Order"
                            >
                                <Check size={12} />
                                <span>Approve</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRejectSoModal({ isOpen: true, salesOrder: row, remark: '', isSubmitting: false })}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Reject Sales Order"
                            >
                                <X size={12} />
                                <span>Reject</span>
                            </button>
                            {/* Modal 6: Customer Advance & Ledger */}
            <PartyAdvanceModal
                isOpen={partyAdvanceModal.isOpen}
                partyType="CUSTOMER"
                partyId={partyAdvanceModal.partyId}
                partyName={partyAdvanceModal.partyName}
                initialMode={partyAdvanceModal.mode}
                onClose={() => setPartyAdvanceModal((p) => ({ ...p, isOpen: false }))}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
                    )}

                    {row.status === 'CONFIRMED' &&
                        !['Pending Approval', 'Rejected'].includes(row.soApprovalStatus) &&
                        (['Production Completed', 'Completed', 'Produced'].includes(row.productionStatus) ||
                            ['Production Completed', 'Completed', 'Produced'].includes(row.productionSummary?.status)) && (
                        <button
                            type="button"
                            onClick={() => openStatusActionModal(row, 'READY_FOR_DISPATCH')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Mark Ready for Dispatch"
                        >
                            Ready
                        </button>
                    )}

                    {!['DISPATCHED', 'FULLY_DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(row.status) && (
                        <button
                            type="button"
                            onClick={() => openStatusActionModal(row, 'CANCELLED')}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Cancel Sales Order"
                        >
                            Cancel
                        </button>
                    )}

                    {row.status !== 'DRAFT' && row.status !== 'CANCELLED' && !['Pending Approval', 'Rejected'].includes(row.soApprovalStatus) && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsGenerateInvoiceOpen(true);
                            }}
                            className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Generate Invoice"
                        >
                            <Receipt size={12} />
                            <span>Invoice</span>
                        </button>
                    )}
                </div>
            )
        }
    ];

    // Tax Invoices Tab Columns
    const invoiceColumns = [
        {
            header: 'INVOICE #',
            exportValue: (row) => row.invoiceNumber || '',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => setViewingInvoiceData(row)}
                    className="font-mono font-bold uppercase text-primary hover:underline text-xs cursor-pointer text-left"
                >
                    {row.invoiceNumber || '-'}
                </button>
            ),
            sortable: true
        },
        {
            header: 'SALES ORDER REF',
            exportValue: (row) => {
                const soObj = typeof row.salesOrder === 'object' ? row.salesOrder : null;
                return soObj?.soNumber || row.soNumber || '';
            },
            render: (row) => {
                const soObj = typeof row.salesOrder === 'object' ? row.salesOrder : null;
                const soNum = soObj?.soNumber || row.soNumber || '-';
                return (
                    <span className="font-mono text-text-muted text-xs">
                        {soNum}
                    </span>
                );
            }
        },
        {
            header: 'CUSTOMER',
            exportValue: (row) => {
                if (row.customer?.companyName) return row.customer.companyName;
                if (row.walkInCustomer?.name) return `${row.walkInCustomer.name} (Walk-in)`;
                if (row.customerType === 'WALK_IN') return 'Walk-in Customer';
                return row.customerName || 'Walk-in Customer';
            },
            render: (row) => {
                if (row.customer?.companyName) return <span className="font-extrabold text-text-main text-xs">{row.customer.companyName}</span>;
                if (row.walkInCustomer?.name) return <span className="font-semibold text-text-main text-xs">{row.walkInCustomer.name} <span className="text-[10px] text-text-muted font-normal">(Walk-in)</span></span>;
                if (row.customerType === 'WALK_IN') return <span className="font-semibold text-text-muted text-xs">Walk-in Customer</span>;
                return <span className="font-semibold text-text-main text-xs">{row.customerName || 'Walk-in Customer'}</span>;
            },
            sortable: true
        },
        {
            header: 'INVOICE DATE',
            exportValue: (row) => formatDate(row.invoiceDate),
            render: (row) => (
                <span className="font-mono text-text-muted text-xs">
                    {formatDate(row.invoiceDate)}
                </span>
            )
        },
        {
            header: 'DUE DATE',
            exportValue: (row) => (row.effectiveDueDate || row.dueDate) ? formatDate(row.effectiveDueDate || row.dueDate) : '-',
            render: (row) => {
                const dueD = row.effectiveDueDate || row.dueDate;
                if (!dueD) return <span className="font-mono text-xs text-text-muted">-</span>;
                const isOverdue = Boolean(row.isOverdue || row.paymentStatus === 'OVERDUE');
                return (
                    <div className="flex flex-col">
                        <span className={`font-mono text-xs ${isOverdue ? 'text-rose-600 font-bold' : 'text-text-muted'}`}>
                            {formatDate(dueD)}
                        </span>
                        {isOverdue && row.daysOverdue > 0 && (
                            <span className="text-[10px] font-extrabold text-rose-600">
                                {row.daysOverdue} day{row.daysOverdue === 1 ? '' : 's'} overdue
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'GRAND TOTAL',
            exportValue: (row) => (row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0)),
            render: (row) => {
                const isExempt = row.gstTreatment === 'EXEMPT' || (Number(row.gstRate) === 0 && Number(row.gstAmount || 0) === 0);
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-extrabold text-text-main text-xs">
                            ₹{Number(row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0)).toLocaleString('en-IN')}
                        </span>
                        {isExempt && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                GST Exempt
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'PAID AMOUNT',
            exportValue: (row) => (row.paidAmount || 0),
            render: (row) => (
                <span className="font-mono font-semibold text-emerald-700 text-xs">
                    ₹{Number(row.paidAmount || 0).toLocaleString('en-IN')}
                </span>
            )
        },
        {
            header: 'BALANCE (OUTSTANDING)',
            exportValue: (row) => Math.max(0, (row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0)) - (row.paidAmount || 0)),
            render: (row) => {
                const grandTotal = Number(row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0));
                const paid = Number(row.paidAmount || 0);
                const bal = Math.max(0, grandTotal - paid);
                return (
                    <span className={`font-mono font-extrabold text-xs ${bal > 0 ? 'text-amber-700' : 'text-text-muted'}`}>
                        ₹{bal.toLocaleString('en-IN')}
                    </span>
                );
            }
        },
        {
            header: 'PAYMENT STATUS',
            exportValue: (row) => row.paymentStatus || 'UNPAID',
            render: (row) => {
                const st = row.paymentStatus || 'UNPAID';
                const isPaid = st === 'PAID';
                const isPartial = st === 'PARTIALLY_PAID';
                const isOverdue = st === 'OVERDUE';
                let label = 'Unpaid';
                let badgeClass = 'bg-slate-100 text-slate-800 border-slate-200';

                if (isPaid) {
                    label = 'Paid';
                    badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                } else if (isOverdue) {
                    label = 'Overdue';
                    badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
                } else if (isPartial) {
                    label = 'Partial';
                    badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                }

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block border ${badgeClass}`}>
                        {label}
                    </span>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => {
                const isPaid = row.paymentStatus === 'PAID';

                return (
                    <div className="flex items-center gap-1.5 justify-end">
                        <button
                            type="button"
                            onClick={() => setViewingInvoiceData(row)}
                            className="px-2.5 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-text-main rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="View / Print Invoice"
                        >
                            <Eye size={13} />
                            <span>View</span>
                        </button>

                        {!isPaid && (
                            <button
                                type="button"
                                onClick={() => setRecordingPaymentInvoice(row)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Update Payment Status"
                            >
                                <CreditCard size={12} />
                                <span>Pay</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ];

    const customerOutstandingColumns = [
        {
            header: 'CUSTOMER',
            sortable: true,
            exportValue: (row) => row.customerName || '',
            render: (row) => (
                <div className="max-w-[200px]" title={row.customerName}>
                    <div className="font-bold text-text-main text-xs truncate">{row.customerName || '-'}</div>
                    {row.customerCode && row.customerCode !== '-' && (
                        <span className="text-[10px] font-mono text-text-muted">{row.customerCode}</span>
                    )}
                </div>
            )
        },
        {
            header: 'CONTACT PHONE',
            exportValue: (row) => row.phone || '-',
            render: (row) => <span className="font-mono text-xs text-text-muted whitespace-nowrap pl-0.5">{row.phone || '-'}</span>
        },
        {
            header: 'TOTAL BILLED (₹)',
            align: 'right',
            sortable: true,
            exportValue: (row) => row.totalBilled || 0,
            render: (row) => <span className="font-mono font-bold text-xs text-text-main">₹{(row.totalBilled || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        },
        {
            header: 'TOTAL RECEIVED (₹)',
            align: 'right',
            sortable: true,
            exportValue: (row) => row.totalPaid || 0,
            render: (row) => <span className="font-mono font-bold text-xs text-emerald-700">₹{(row.totalPaid || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        },
        {
            header: 'BALANCE (OUTSTANDING) (₹)',
            align: 'right',
            sortable: true,
            exportValue: (row) => row.balance || 0,
            render: (row) => (
                <span className={`font-mono font-extrabold text-xs ${(row.balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    ₹{(row.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'OVERDUE (₹)',
            align: 'right',
            sortable: true,
            exportValue: (row) => row.overdueAmount || 0,
            render: (row) => (
                <span className={`font-mono font-extrabold text-xs ${(row.overdueAmount || 0) > 0 ? 'text-rose-600' : 'text-text-muted'}`}>
                    {(row.overdueAmount || 0) > 0 ? `₹${(row.overdueAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '₹0'}
                </span>
            )
        },
        {
            header: 'ADVANCE (₹)',
            align: 'right',
            sortable: true,
            exportValue: (row) => row.advanceBalance || 0,
            render: (row) => (
                <span className={`font-mono font-bold text-xs ${(row.advanceBalance || 0) > 0 ? 'text-emerald-700' : 'text-text-muted'}`}>
                    ₹{(row.advanceBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            header: 'UNPAID INVOICES',
            align: 'center',
            exportValue: (row) => `${row.unpaidInvoiceCount || 0} / ${row.invoiceCount || 0}`,
            render: (row) => (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-app-bg border border-border whitespace-nowrap">
                    <span className="text-amber-700 font-black">{row.unpaidInvoiceCount || 0}</span> / {row.invoiceCount || 0}
                </span>
            )
        },
        {
            header: 'ACTIONS',
            align: 'right',
            render: (row) => (
                <div className="flex items-center justify-end gap-1.5">
                    {row.customerId && String(row.customerId).length === 24 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setPartyAdvanceModal({ isOpen: true, partyId: row.customerId, partyName: row.customerName, mode: 'RECORD' })}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer whitespace-nowrap"
                                title="Record Customer Advance"
                            >
                                + Advance
                            </button>
                            <button
                                type="button"
                                onClick={() => setPartyAdvanceModal({ isOpen: true, partyId: row.customerId, partyName: row.customerName, mode: 'LEDGER' })}
                                className="px-2 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-text-main rounded text-[10px] font-semibold cursor-pointer"
                                title="View Advance & Payment Ledger"
                            >
                                Ledger
                            </button>
                            {/* Modal 6: Customer Advance & Ledger */}
            <PartyAdvanceModal
                isOpen={partyAdvanceModal.isOpen}
                partyType="CUSTOMER"
                partyId={partyAdvanceModal.partyId}
                partyName={partyAdvanceModal.partyName}
                initialMode={partyAdvanceModal.mode}
                onClose={() => setPartyAdvanceModal((p) => ({ ...p, isOpen: false }))}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTabKey('invoices');
                        }}
                        className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer rounded"
                        title="View Customer Invoices"
                    >
                        <Eye size={15} />
                    </button>
                </div>
            )
        }
    ];

    const tabs = [
        {
            key: 'sales-orders',
            label: 'Sales Orders',
            resourcePath: '/sales-orders',
            columns: salesOrderColumns,
            availableStatuses: ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED']
        },
        {
            key: 'invoices',
            label: 'Tax Invoices',
            resourcePath: '/invoices',
            columns: invoiceColumns,
            availableStatuses: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']
        },
        {
            key: 'customer-outstanding',
            label: 'Customer Outstanding (AR)',
            resourcePath: '/invoices/customer-outstanding',
            columns: customerOutstandingColumns,
            availableStatuses: ['All Statuses', 'Outstanding', 'Overdue', 'Paid'],
            isEditable: false,
            isDeletable: false
        }
    ];

    // Summary Cards for Accounts Receivable (3-column responsive grid)
    const renderReceivablesSummaryCards = () => {
        if (activeTabKey !== 'invoices' && activeTabKey !== 'customer-outstanding') return null;

        const totalRec = Number(receivablesSummary.totalReceivable || 0);
        const overdueAmt = Number(receivablesSummary.overdueReceivable !== undefined ? receivablesSummary.overdueReceivable : (receivablesSummary.overdueAmount || 0));
        const custCount = Number(receivablesSummary.customersWithDues || 0);

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full mb-3">
                <div className="bg-card-bg border border-border rounded-xl p-3.5 sm:p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">TOTAL RECEIVABLE</span>
                        <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-0.5">
                            ₹{totalRec.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-600 shrink-0">
                        <Wallet size={20} className="text-amber-600" />
                    </div>
                </div>

                <div className="bg-card-bg border border-border rounded-xl p-3.5 sm:p-4 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">OVERDUE RECEIVABLE</span>
                        <span className={`text-base sm:text-lg font-black font-mono block mt-0.5 ${overdueAmt > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            ₹{overdueAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="p-2.5 bg-red-50 border border-red-200/80 rounded-xl text-red-600 shrink-0">
                        <AlertCircle size={20} className="text-red-600" />
                    </div>
                </div>

                <div className="bg-card-bg border border-border rounded-xl p-3.5 sm:p-4 shadow-2xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">CUSTOMERS WITH DUES</span>
                        <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-0.5">
                            {custCount} Customers
                        </span>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200/80 rounded-xl text-blue-600 shrink-0">
                        <Users size={20} className="text-blue-600" />
                    </div>
                </div>
            </div>
        );
    };

    // Dynamic Header Action Button
    const renderHeaderActions = () => {
        if (activeTabKey === 'invoices') {
            return (
                <button
                    type="button"
                    onClick={() => setIsGenerateInvoiceOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <Plus size={15} />
                    <span>+ Generate Invoice from Sales Order</span>
                </button>
            );
        }

        return (
            <button
                type="button"
                onClick={() => {
                    setEditingSoData(null);
                    setIsCreateSoOpen(true);
                }}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
            >
                <Plus size={15} />
                <span>+ Book New Sales Order</span>
            </button>
        );
    };

    return (
        <>
            <TabbedResourcePage
                key={`${refreshKey}-${activeTabKey}`}
                title="Sales Booking & Billing Ledger"
                description="Manage customer Sales Orders, generate GST tax invoices, and track payment receipts."
                tabs={tabs}
                activeTabKey={activeTabKey}
                onTabChange={handleTabChange}
                headerActions={renderHeaderActions}
                topSlot={renderReceivablesSummaryCards}
                filterSlot={activeTabKey === 'sales-orders' ? (
                    <select
                        value={productionFilter}
                        onChange={(e) => setProductionFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-card-bg border border-border rounded-lg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        title="Filter by Production Status"
                    >
                        <option value="ALL">All Production Statuses</option>
                        <option value="Not Planned">Not Planned</option>
                        <option value="Partially Planned">Partially Planned</option>
                        <option value="Fully Planned">Fully Planned</option>
                        <option value="In Production">In Production</option>
                        <option value="Production Completed">Production Completed</option>
                    </select>
                ) : null}
                extraFilterParams={
                    appliedDashboardFilter && activeTabKey === 'invoices'
                        ? { paymentStatus: 'OUTSTANDING' }
                        : activeTabKey === 'sales-orders' && productionFilter !== 'ALL'
                        ? { productionStatus: productionFilter }
                        : null
                }
                onAddClick={() => {
                    if (activeTabKey === 'invoices') {
                        setIsGenerateInvoiceOpen(true);
                    } else {
                        setEditingSoData(null);
                        setIsCreateSoOpen(true);
                    }
                }}
                onEditClick={(row) => {
                    if (activeTabKey === 'sales-orders') {
                        setEditingSoData(row);
                        setIsCreateSoOpen(true);
                    } else {
                        setViewingInvoiceData(row);
                    }
                }}
            />

            {/* Modal 1: Create / Edit Sales Order */}
            <CreateSalesOrderModal
                isOpen={isCreateSoOpen}
                initialData={editingSoData}
                onClose={() => {
                    setIsCreateSoOpen(false);
                    setEditingSoData(null);
                }}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Modal 2: Generate Invoice from Sales Order */}
            <GenerateInvoiceModal
                isOpen={isGenerateInvoiceOpen}
                onClose={() => setIsGenerateInvoiceOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Modal 3: Record Payment for Invoice */}
            <RecordPaymentModal
                isOpen={Boolean(recordingPaymentInvoice)}
                invoice={recordingPaymentInvoice}
                onClose={() => setRecordingPaymentInvoice(null)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Modal 4: View Sales Order Details */}
            <ViewSalesOrderModal
                isOpen={Boolean(viewingSoData)}
                salesOrder={viewingSoData}
                onClose={() => setViewingSoData(null)}
                onEdit={(so) => {
                    setEditingSoData(so);
                    setIsCreateSoOpen(true);
                }}
                onQuickStatusChange={(so, target) => openStatusActionModal(so, target)}
                onCancelOrder={(so) => openStatusActionModal(so, 'CANCELLED')}
                onApproveSo={(so) => handleQuickApproveSo(so)}
                onRejectSo={(so) => setRejectSoModal({ isOpen: true, salesOrder: so, remark: '', isSubmitting: false })}
                onGenerateInvoice={() => {
                    setIsGenerateInvoiceOpen(true);
                }}
            />

            {/* Modal 5: View / Print Tax Invoice */}
            <ViewInvoiceModal
                isOpen={Boolean(viewingInvoiceData)}
                invoice={viewingInvoiceData}
                onClose={() => setViewingInvoiceData(null)}
                onRecordPayment={(inv) => {
                    setRecordingPaymentInvoice(inv);
                }}
            />

            {/* Modal 6: Status Change / Cancel Confirmation */}
            {statusActionModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleConfirmStatusAction}
                        className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                            <h3 className="font-bold text-sm text-text-main">
                                {statusActionModal.targetStatus === 'CANCELLED'
                                    ? `Cancel Sales Order ${statusActionModal.salesOrder?.soNumber || ''}`
                                    : `Update Status to ${statusActionModal.targetStatus.replace(/_/g, ' ')}`}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setStatusActionModal((prev) => ({ ...prev, isOpen: false }))}
                                className="text-text-muted hover:text-text-main font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                    {statusActionModal.targetStatus === 'CANCELLED'
                                        ? 'Cancellation Reason *'
                                        : statusActionModal.targetStatus === 'DISPATCHED'
                                        ? 'Dispatch Override Remark *'
                                        : 'Remark (Optional)'}
                                </label>
                                <textarea
                                    rows={3}
                                    required={statusActionModal.targetStatus === 'CANCELLED' || statusActionModal.targetStatus === 'DISPATCHED'}
                                    placeholder={
                                        statusActionModal.targetStatus === 'CANCELLED'
                                            ? 'Enter mandatory reason for cancelling this Sales Order...'
                                            : 'Add an optional note for the audit trail...'
                                    }
                                    value={statusActionModal.remark}
                                    onChange={(e) => setStatusActionModal((prev) => ({ ...prev, remark: e.target.value }))}
                                    className="w-full border border-border rounded-lg p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            {statusActionModal.targetStatus === 'CANCELLED' && statusActionModal.requiresWoDecision && statusActionModal.plannedWorkOrders.length > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-[11px] text-amber-900">
                                    <div className="font-bold">
                                        Linked planned Work Orders found ({statusActionModal.plannedWorkOrders.map((w) => w.workOrderNumber).join(', ')}). How should they be handled?
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                                        <input
                                            type="radio"
                                            name="woCancelAction"
                                            checked={statusActionModal.cancelLinkedWorkOrders === true}
                                            onChange={() => setStatusActionModal((prev) => ({ ...prev, cancelLinkedWorkOrders: true }))}
                                        />
                                        <span>Cancel linked planned Work Orders together</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                                        <input
                                            type="radio"
                                            name="woCancelAction"
                                            checked={statusActionModal.cancelLinkedWorkOrders === false}
                                            onChange={() => setStatusActionModal((prev) => ({ ...prev, cancelLinkedWorkOrders: false }))}
                                        />
                                        <span>Release them as unlinked stock Work Orders</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setStatusActionModal((prev) => ({ ...prev, isOpen: false }))}
                                className="px-3.5 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={statusActionModal.isSubmitting}
                                className={`px-4 py-2 rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 ${
                                    statusActionModal.targetStatus === 'CANCELLED'
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-primary hover:bg-primary-hover text-sidebar-bg'
                                }`}
                            >
                                {statusActionModal.isSubmitting
                                    ? 'Updating...'
                                    : statusActionModal.targetStatus === 'CANCELLED'
                                    ? 'Confirm Cancel Order'
                                    : 'Confirm Status Update'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Quick Reject Sales Order Modal */}
            {rejectSoModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <form onSubmit={handleQuickRejectSo} className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                            <h3 className="font-bold text-sm text-text-main">
                                Reject Sales Order {rejectSoModal.salesOrder?.soNumber || ''}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRejectSoModal({ isOpen: false, salesOrder: null, remark: '', isSubmitting: false })}
                                className="text-text-muted hover:text-text-main text-xs font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Rejection Remark *
                            </label>
                            <textarea
                                rows={3}
                                required
                                placeholder="Enter mandatory reason for rejecting this Sales Order..."
                                value={rejectSoModal.remark}
                                onChange={(e) => setRejectSoModal((p) => ({ ...p, remark: e.target.value }))}
                                className="w-full border border-border rounded-lg p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-rose-500"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setRejectSoModal({ isOpen: false, salesOrder: null, remark: '', isSubmitting: false })}
                                className="px-3.5 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={rejectSoModal.isSubmitting || !rejectSoModal.remark.trim()}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50"
                            >
                                {rejectSoModal.isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Modal 6: Customer Advance & Ledger */}
            <PartyAdvanceModal
                isOpen={partyAdvanceModal.isOpen}
                partyType="CUSTOMER"
                partyId={partyAdvanceModal.partyId}
                partyName={partyAdvanceModal.partyName}
                initialMode={partyAdvanceModal.mode}
                onClose={() => setPartyAdvanceModal((p) => ({ ...p, isOpen: false }))}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
