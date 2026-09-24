import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import { Users, Truck, UserCheck, Settings, Layers, Package } from 'lucide-react';

export default function MasterDataPage() {
    const tabs = [
        {
            key: 'customers',
            label: 'Customers',
            icon: Users,
            resourcePath: '/customers',
            columns: [
                {
                    header: 'Code',
                    render: (row) => row.code || row.customerCode || '-'
                },
                { header: 'Company Name', accessor: 'companyName', sortable: true },
                { header: 'Contact Person', accessor: 'contactPerson' },
                { header: 'GSTIN', accessor: 'gstin' },
                { header: 'City', accessor: 'city' },
                { header: 'State', accessor: 'state' },
                {
                    header: 'Credit Limit',
                    render: (row) => row.creditLimit !== undefined ? `₹${Number(row.creditLimit).toLocaleString()}` : '-'
                },
                {
                    header: 'STATUS',
                    render: (row) => {
                        if (row.isActive === false) {
                            return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block bg-gray-100 text-gray-700 border border-gray-200">
                                    Inactive
                                </span>
                            );
                        }

                        const val = row.status || 'ACTIVE_CUSTOMER';
                        let bgClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                        let labelText = 'Active Customer';

                        if (val === 'LEAD') {
                            bgClass = 'bg-amber-100 text-amber-800 border border-amber-200';
                            labelText = 'Lead';
                        } else if (val === 'INACTIVE') {
                            bgClass = 'bg-rose-100 text-rose-800 border border-rose-200';
                            labelText = 'Inactive';
                        }

                        return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${bgClass}`}>
                                {labelText}
                            </span>
                        );
                    }
                }
            ]
        },
        {
            key: 'suppliers',
            label: 'Suppliers',
            icon: Truck,
            resourcePath: '/suppliers',
            columns: [
                {
                    header: 'Code',
                    render: (row) => row.code || row.supplierCode || '-'
                },
                {
                    header: 'Supplier Name',
                    render: (row) => row.name || row.companyName || '-',
                    sortable: true
                },
                { header: 'Contact Person', accessor: 'contactPerson' },
                { header: 'GSTIN', accessor: 'gstin' },
                { header: 'City', accessor: 'city' },
                { header: 'State', accessor: 'state' },
                { header: 'Payment Terms', accessor: 'paymentTerms' },
                {
                    header: 'STATUS',
                    render: (row) => (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${row.isActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {row.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'employees',
            label: 'Employees',
            icon: UserCheck,
            resourcePath: '/employees',
            columns: [
                {
                    header: 'Emp Code',
                    render: (row) => row.employeeCode || row.code || '-'
                },
                { header: 'Employee Name', accessor: 'name', sortable: true },
                { header: 'Department', accessor: 'department' },
                { header: 'Designation', accessor: 'designation' },
                {
                    header: 'Shift',
                    render: (row) => {
                        if (row.shiftAssignment && typeof row.shiftAssignment === 'object') {
                            const name = row.shiftAssignment.name || row.shiftAssignment.shiftCode;
                            const times = row.shiftAssignment.startTime && row.shiftAssignment.endTime ? ` (${row.shiftAssignment.startTime}–${row.shiftAssignment.endTime})` : '';
                            return `${name}${times}`;
                        }
                        return row.shiftAssignment || '-';
                    }
                },
                {
                    header: 'Facility',
                    render: (row) => typeof row.facility === 'object' ? row.facility?.name : (row.facility || '-')
                },
                {
                    header: 'Monthly Salary',
                    render: (row) => row.monthlySalary !== undefined ? `₹${Number(row.monthlySalary).toLocaleString()}` : '-'
                },
                {
                    header: 'STATUS',
                    render: (row) => (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${row.isActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {row.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'machines',
            label: 'Machines',
            icon: Settings,
            resourcePath: '/machines',
            columns: [
                {
                    header: 'Machine Code',
                    render: (row) => row.code || row.machineCode || '-'
                },
                { header: 'Machine Name', accessor: 'name', sortable: true },
                { header: 'Section', accessor: 'section' },
                {
                    header: 'Plant Location',
                    render: (row) => row.plantLocation || '-'
                },
                {
                    header: 'Capacity / Hr',
                    render: (row) => row.capacityPerHour ? `${row.capacityPerHour} kg/hr` : (row.capacity || '-')
                },
                {
                    header: 'Operators',
                    render: (row) => {
                        const ops = (Array.isArray(row.currentOperators) && row.currentOperators.length > 0)
                            ? row.currentOperators
                            : (row.currentOperator ? [row.currentOperator] : []);
                        if (!ops.length) return '-';
                        return (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                                {ops.map((op, idx) => {
                                    if (typeof op === 'object' && op !== null) {
                                        const code = op.employeeCode ? `${op.employeeCode} - ` : '';
                                        return (
                                            <span
                                                key={op._id || idx}
                                                className="inline-block bg-app-bg text-text-main border border-border px-1.5 py-0.5 rounded text-[11px] font-medium"
                                                title={op.department ? `${code}${op.name} (${op.department})` : `${code}${op.name}`}
                                            >
                                                {code}{op.name || '-'}
                                            </span>
                                        );
                                    }
                                    return <span key={idx} className="text-xs">{String(op)}</span>;
                                })}
                            </div>
                        );
                    }
                },
                {
                    header: 'Efficiency (%)',
                    render: (row) => row.efficiency !== undefined ? `${row.efficiency}%` : '-'
                },
                {
                    header: 'STATUS',
                    render: (row) => {
                        if (row.isActive === false) {
                            return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block bg-gray-100 text-gray-700 border border-gray-200">
                                    Inactive
                                </span>
                            );
                        }

                        const st = (row.status || 'Available').toUpperCase();
                        let badgeStyle = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                        let labelText = 'Available';

                        if (st === 'IN_USE' || st === 'IN USE') {
                            badgeStyle = 'bg-blue-100 text-blue-800 border border-blue-200';
                            labelText = 'In Use';
                        } else if (st === 'UNDER_MAINTENANCE' || st === 'UNDER MAINTENANCE' || st === 'MAINTENANCE') {
                            badgeStyle = 'bg-amber-100 text-amber-800 border border-amber-200';
                            labelText = 'Under Maintenance';
                        } else if (st === 'OUT_OF_SERVICE' || st === 'OUT OF SERVICE' || st === 'OFFLINE') {
                            badgeStyle = 'bg-rose-100 text-rose-800 border border-rose-200';
                            labelText = 'Out of Service';
                        }

                        return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${badgeStyle}`}>
                                {labelText}
                            </span>
                        );
                    }
                }
            ]
        },
        {
            key: 'raw-materials',
            label: 'Raw Materials',
            icon: Layers,
            resourcePath: '/raw-materials',
            columns: [
                {
                    header: 'Item Code',
                    render: (row) => row.code || row.itemCode || '-'
                },
                { header: 'Material Name', accessor: 'name', sortable: true },
                {
                    header: 'Description',
                    render: (row) => row.materialDescription || '-'
                },
                {
                    header: 'Category',
                    render: (row) => typeof row.category === 'object' ? row.category?.name : (row.category || '-')
                },
                {
                    header: 'UOM',
                    render: (row) => typeof row.uom === 'object' ? (row.uom?.symbol || row.uom?.name) : (row.uom || 'kg')
                },
                {
                    header: 'Location',
                    render: (row) => typeof row.defaultLocation === 'object' ? (row.defaultLocation?.name || row.defaultLocation?.code) : (row.defaultLocation || '-')
                },
                { header: 'Reorder Level', accessor: 'reorderLevel' },
                { header: 'Stock', accessor: 'currentStock' },
                {
                    header: 'Price / Unit',
                    render: (row) => row.pricePerUnit !== undefined ? `₹${row.pricePerUnit}` : '-'
                },
                {
                    header: 'STATUS',
                    render: (row) => (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${row.isActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {row.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'finished-goods',
            label: 'Finished Bags',
            icon: Package,
            resourcePath: '/finished-goods',
            columns: [
                {
                    header: 'PRODUCT CODE',
                    render: (row) => row.code || row.itemCode || '-'
                },
                { header: 'PRODUCT SPECIFICATION', accessor: 'name', sortable: true },
                {
                    header: 'BAG TYPE',
                    render: (row) => typeof row.category === 'object' ? row.category?.name : (row.category || '-')
                },
                {
                    header: 'GSM',
                    render: (row) => row.fabricGSM ? `${row.fabricGSM} GSM` : '-'
                },
                {
                    header: 'DIMENSIONS',
                    render: (row) => row.dimensions?.width && row.dimensions?.length
                        ? `${row.dimensions.width}x${row.dimensions.length} ${row.dimensions?.unit || row.dimensionUnit || 'cm'}`
                        : '-'
                },
                {
                    header: 'STOCK (BAGS)',
                    render: (row) => <span className="font-bold text-text-main">{row.currentStock || 0}</span>
                },
                {
                    header: 'PRICE',
                    render: (row) => row.pricePerBag !== undefined ? `₹${row.pricePerBag}/bag` : '-'
                },
                {
                    header: 'STATUS',
                    render: (row) => (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${row.isActive !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                            {row.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        }
    ];

    return (
        <TabbedResourcePage
            title="Master Data Management"
            description="Central master records for Customers, Suppliers, Employees, Machines, Materials, and Finished Bags."
            tabs={tabs}
        />
    );
}
