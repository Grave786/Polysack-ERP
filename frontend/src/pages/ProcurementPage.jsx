import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function ProcurementPage() {
    const tabs = [
        {
            key: 'purchase-orders',
            label: 'Purchase Orders',
            resourcePath: '/purchase-orders',
            columns: [
                { header: 'PO Number', accessor: 'poNumber' },
                { header: 'Supplier', accessor: 'supplier.companyName' },
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
                            {row.status || 'DRAFT'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'grns',
            label: 'Goods Receipts (GRN)',
            resourcePath: '/grns',
            columns: [
                { header: 'GRN Number', accessor: 'grnNumber' },
                { header: 'PO Number', accessor: 'purchaseOrder.poNumber' },
                {
                    header: 'Received Date',
                    render: (row) => row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : '-'
                },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-neutral-bg text-status-neutral-text">
                            {row.status || 'RECEIVED'}
                        </span>
                    )
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Procurement & Inward Receipts"
            description="Manage vendor Purchase Orders and Goods Receipt Notes (GRN)."
            tabs={tabs}
        />
    );
}
