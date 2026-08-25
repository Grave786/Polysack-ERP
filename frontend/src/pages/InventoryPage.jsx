import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function InventoryPage() {
    const tabs = [
        {
            key: 'stock-transactions',
            label: 'Stock Ledger',
            resourcePath: '/stock-transactions',
            columns: [
                { header: 'Transaction Type', accessor: 'transactionType' },
                { header: 'Quantity', accessor: 'quantity' },
                { header: 'Ref Number', accessor: 'referenceNumber' },
                { header: 'Notes', accessor: 'notes' },
                {
                    header: 'Date & Time',
                    render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Inventory & Stock Ledger"
            description="Track real-time stock movements, allocations, adjustments, and transaction logs."
            tabs={tabs}
        />
    );
}
