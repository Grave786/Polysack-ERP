import { useState } from 'react';
import { ShoppingCart, Plus, FileText, CreditCard, Eye, Pencil, Receipt, CheckCircle2 } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import CreateSalesOrderModal from '../components/sales/CreateSalesOrderModal';
import GenerateInvoiceModal from '../components/sales/GenerateInvoiceModal';
import RecordPaymentModal from '../components/sales/RecordPaymentModal';
import ViewSalesOrderModal from '../components/sales/ViewSalesOrderModal';
import ViewInvoiceModal from '../components/sales/ViewInvoiceModal';

export default function SalesPage() {
    const [activeTabKey, setActiveTabKey] = useState('sales-orders');
    const [refreshKey, setRefreshKey] = useState(0);

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
            render: (row) => {
                const custName = row.customer?.companyName || row.customerName || '-';
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
            render: (row) => (
                <span className="font-mono text-text-muted text-xs">
                    {row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '-'}
                </span>
            )
        },
        {
            header: 'DELIVERY DUE',
            render: (row) => (
                <span className="font-mono font-semibold text-text-main text-xs">
                    {row.deliveryDue ? new Date(row.deliveryDue).toLocaleDateString() : '-'}
                </span>
            )
        },
        {
            header: 'ORDERED BAGS',
            render: (row) => {
                const totalBags = Array.isArray(row.items)
                    ? row.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0)
                    : 0;
                return (
                    <span className="font-mono font-bold text-text-main text-xs">
                        {totalBags > 0 ? `${totalBags.toLocaleString()} Bags` : '-'}
                    </span>
                );
            }
        },
        {
            header: 'GRAND TOTAL',
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
            render: (row) => {
                const st = row.status || 'CONFIRMED';
                const isConfirmed = st === 'CONFIRMED';
                const isDraft = st === 'DRAFT';
                const isDispatched = st === 'DISPATCHED' || st === 'READY_FOR_DISPATCH';
                const isCancelled = st === 'CANCELLED';

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${
                        isConfirmed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isDraft
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : isDispatched
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : isCancelled
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                        {st}
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
            render: (row) => (
                <span className="font-mono text-text-muted text-xs">
                    {row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-'}
                </span>
            )
        },
        {
            header: 'GRAND TOTAL',
            render: (row) => (
                <span className="font-mono font-extrabold text-text-main text-xs">
                    {row.grandTotal !== undefined ? `₹${row.grandTotal.toLocaleString()}` : '-'}
                </span>
            )
        },
        {
            header: 'PAYMENT STATUS',
            render: (row) => {
                const isPaid = row.paymentStatus === 'PAID';
                const isPartial = row.paymentStatus === 'PARTIALLY_PAID';

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-block ${
                        isPaid
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                        {row.paymentStatus || 'UNPAID'}
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

    const tabs = [
        {
            key: 'sales-orders',
            label: 'Sales Orders',
            resourcePath: '/sales-orders',
            columns: salesOrderColumns,
            availableStatuses: ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'CANCELLED']
        },
        {
            key: 'invoices',
            label: 'Tax Invoices',
            resourcePath: '/invoices',
            columns: invoiceColumns,
            availableStatuses: ['UNPAID', 'PARTIALLY_PAID', 'PAID']
        }
    ];

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
                onTabChange={setActiveTabKey}
                headerActions={renderHeaderActions}
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
