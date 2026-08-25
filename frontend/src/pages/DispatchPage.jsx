import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function DispatchPage() {
    const tabs = [
        {
            key: 'dispatches',
            label: 'Dispatches',
            resourcePath: '/dispatches',
            columns: [
                { header: 'Dispatch #', accessor: 'dispatchNumber' },
                { header: 'Sales Order #', accessor: 'salesOrder.soNumber' },
                {
                    header: 'Dispatch Date',
                    render: (row) => row.dispatchDate ? new Date(row.dispatchDate).toLocaleDateString() : '-'
                },
                { header: 'Carrier / Transporter', accessor: 'carrier' },
                { header: 'Tracking / Vehicle #', accessor: 'trackingNumber' },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-neutral-bg text-status-neutral-text">
                            {row.status || 'DISPATCHED'}
                        </span>
                    )
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Dispatch & Logistics"
            description="Track outward dispatches, gate passes, vehicle numbers, and delivery status."
            tabs={tabs}
        />
    );
}
