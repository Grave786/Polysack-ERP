import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, Plus, FileText, CreditCard, Eye, Pencil, Receipt, CheckCircle2, DollarSign, AlertCircle, Users, Wallet } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreateSalesOrderModal from '../components/sales/CreateSalesOrderModal';
import GenerateInvoiceModal from '../components/sales/GenerateInvoiceModal';
import RecordPaymentModal from '../components/sales/RecordPaymentModal';
import ViewSalesOrderModal from '../components/sales/ViewSalesOrderModal';
import ViewInvoiceModal from '../components/sales/ViewInvoiceModal';
import { formatDate, isDateOverdue } from '../utils/dateUtils';
import axiosInstance from '../api/axiosInstance';

export default function SalesPage() {
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

    const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
    const [recordingPaymentInvoice, setRecordingPaymentInvoice] = useState(null);
    const [viewingInvoiceData, setViewingInvoiceData] = useState(null);

    // Sales Orders Tab Columns
    const salesOrderColumns = [
        {
            header: 'SO NUMBER',
            exportValue: (row) => row.soNumber || '',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => setViewingSoData(row)}
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
                return row.grandTotal !== undefined ? row.grandTotal : Math.round(subtotal * 1.18);
            },
            render: (row) => {
                const subtotal = row.totalAmount !== undefined ? row.totalAmount : (row.totalValue || 0);
                const grandTotal = Math.round(subtotal * 1.18); // 18% GST estimate
                return (
                    <div className="font-mono font-extrabold text-text-main text-xs">
                        ₹{grandTotal.toLocaleString()}
                    </div>
                );
            }
        },
        {
            header: 'STATUS',
            exportValue: (row) => row.status || 'CONFIRMED',
            render: (row) => {
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
            header: 'ACTIONS',
            render: (row) => (
                <div className="flex items-center gap-1.5 justify-end">
                    <button
                        type="button"
                        onClick={() => setViewingSoData(row)}
                        className="px-2 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-text-main rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        title="View Details"
                    >
                        <Eye size={13} />
                    </button>

                    {(row.status === 'DRAFT' || row.status === 'CONFIRMED') && (
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

                    {row.status !== 'DRAFT' && row.status !== 'CANCELLED' && (
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
            exportValue: (row) => formatDate(row.dueDate || row.invoiceDate),
            render: (row) => {
                const dueD = row.dueDate || row.invoiceDate;
                const isOverdue = row.paymentStatus === 'OVERDUE' || (row.paymentStatus !== 'PAID' && isDateOverdue(dueD));
                return (
                    <span className={`font-mono text-xs ${isOverdue ? 'text-danger font-bold' : 'text-text-muted'}`}>
                        {formatDate(dueD)}
                    </span>
                );
            }
        },
        {
            header: 'GRAND TOTAL',
            exportValue: (row) => (row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0)),
            render: (row) => (
                <span className="font-mono font-extrabold text-text-main text-xs">
                    ₹{Number(row.grandTotal !== undefined ? row.grandTotal : (row.totalAmount || 0)).toLocaleString('en-IN')}
                </span>
            )
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
                <div className="flex items-center justify-end">
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
                filterSlot={null}
                extraFilterParams={appliedDashboardFilter && activeTabKey === 'invoices' ? { paymentStatus: 'OUTSTANDING' } : null}
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
        </>
    );
}
