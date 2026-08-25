import TabbedResourcePage from '../components/shared/TabbedResourcePage';

export default function UsersPage() {
    const tabs = [
        {
            key: 'users',
            label: 'User Accounts',
            resourcePath: '/users',
            columns: [
                { header: 'Full Name', accessor: 'name' },
                { header: 'Email Address', accessor: 'email' },
                { header: 'Assigned Role', accessor: 'role.name' },
                {
                    header: 'Status',
                    render: (row) => (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.isActive ? 'bg-status-success-bg text-status-success-text' : 'bg-status-neutral-bg text-status-neutral-text'}`}>
                            {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                    )
                }
            ]
        },
        {
            key: 'roles',
            label: 'Role Permissions',
            resourcePath: '/roles',
            columns: [
                { header: 'Role Name', accessor: 'name' },
                { header: 'Description', accessor: 'description' },
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
            title="User & Access Control"
            description="Manage user accounts, roles, and security permissions."
            tabs={tabs}
        />
    );
}
