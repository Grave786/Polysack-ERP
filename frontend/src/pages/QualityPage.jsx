import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function QualityPage() {
    const tabs = [
        {
            key: 'qc-inspections',
            label: 'QC Inspections',
            resourcePath: '/qc-inspections',
            columns: [
                { header: 'Inspection #', accessor: 'inspectionNumber' },
                { header: 'Work Order #', accessor: 'workOrder.workOrderNumber' },
                { header: 'Sample Size', accessor: 'sampleSize' },
                { header: 'Passed Qty', accessor: 'passedQuantity' },
                { header: 'Failed Qty', accessor: 'failedQuantity' },
                {
                    header: 'Result',
                    render: (row) => (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.result === 'PASSED' ? 'bg-status-success-bg text-status-success-text' : 'bg-rose-100 text-rose-800'
                        }`}>
                            {row.result || 'PENDING'}
                        </span>
                    )
                },
                {
                    header: 'Inspection Date',
                    render: (row) => row.inspectionDate ? new Date(row.inspectionDate).toLocaleDateString() : '-'
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Quality Control & Inspection"
            description="Manage quality checks, lab inspection records, and defect approvals."
            tabs={tabs}
        />
    );
}
