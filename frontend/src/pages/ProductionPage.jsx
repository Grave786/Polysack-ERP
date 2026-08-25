import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function ProductionPage() {
    const tabs = [
        {
            key: 'work-orders',
            label: 'Work Orders',
            resourcePath: '/work-orders',
            columns: [
                { header: 'WO Number', accessor: 'workOrderNumber' },
                { header: 'Customer', accessor: 'customer.companyName' },
                { header: 'Finished Good', accessor: 'finishedGood.name' },
                { header: 'Target Qty', accessor: 'targetQuantity' },
                { header: 'Completed Qty', accessor: 'completedQuantity' },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.status === 'COMPLETED' ? 'bg-status-success-bg text-status-success-text' : 'bg-status-neutral-bg text-status-neutral-text'
                        }`}>
                            {row.status || 'PENDING'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'boms',
            label: 'Bill of Materials (BOM)',
            resourcePath: '/boms',
            columns: [
                { header: 'BOM Code', accessor: 'bomCode' },
                { header: 'Target Finished Good', accessor: 'finishedGood.name' },
                { header: 'Output Qty', accessor: 'outputQuantity' },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.isActive ? 'bg-status-success-bg text-status-success-text' : 'bg-status-neutral-bg text-status-neutral-text'}`}>
                            {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Production Planning & Execution"
            description="Manage factory Work Orders and Bill of Materials (BOM) recipes."
            tabs={tabs}
        />
    );
}
