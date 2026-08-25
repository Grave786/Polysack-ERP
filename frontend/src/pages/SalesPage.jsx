import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function SalesPage() {
    const tabs = [
        {
            key: 'sales-orders',
            label: 'Sales Orders',
            resourcePath: '/sales-orders',
            columns: [
                { header: 'SO Number', accessor: 'soNumber' },
                { header: 'Customer', accessor: 'customer.companyName' },
                {
                    header: 'Order Date',
                    render: (row) => row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '-'
                },
                {
                    header: 'Total Amount',
                    render: (row) => row.totalAmount !== undefined ? `₹${row.totalAmount.toLocaleString()}` : '-'
                },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-neutral-bg text-status-neutral-text">
                            {row.status || 'PENDING'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'invoices',
            label: 'Tax Invoices',
            resourcePath: '/invoices',
            columns: [
                { header: 'Invoice #', accessor: 'invoiceNumber' },
                { header: 'Customer', accessor: 'customer.companyName' },
                {
                    header: 'Invoice Date',
                    render: (row) => row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-'
                },
                {
                    header: 'Grand Total',
                    render: (row) => row.grandTotal !== undefined ? `₹${row.grandTotal.toLocaleString()}` : '-'
                },
                {
                    header: 'Payment Status',
                    render: (row) => (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.paymentStatus === 'PAID' ? 'bg-status-success-bg text-status-success-text' : 'bg-amber-100 text-amber-800'
                        }`}>
                            {row.paymentStatus || 'UNPAID'}
                        </span>
                    )
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Sales Booking & Billing"
            description="Manage customer Sales Orders, tax invoices, and payment tracking."
            tabs={tabs}
        />
    );
}
