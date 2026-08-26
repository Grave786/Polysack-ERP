import { useState, useEffect } from 'react';
import { Plus, UserCheck, UserX, UserPlus, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function UserManagementPage() {
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Form state for creating new user
    const [roles, setRoles] = useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        facility_id: 'MAIN_UNIT'
    });

    // Fetch Roles for drawer dropdown on open
    useEffect(() => {
        if (isAddUserOpen) {
            setIsLoadingRoles(true);
            axiosInstance.get('/roles')
                .then((res) => {
                    if (res.data?.success && Array.isArray(res.data.data)) {
                        const rolesList = res.data.data.filter((r) => r.isActive !== false);
                        setRoles(rolesList);
                        if (rolesList.length > 0) {
                            setFormData((prev) => ({ ...prev, role: rolesList[0]._id }));
                        }
                    }
                })
                .catch((err) => {
                    console.error('Error fetching roles:', err);
                    toast.error('Failed to load user roles');
                })
                .finally(() => {
                    setIsLoadingRoles(false);
                });
        }
    }, [isAddUserOpen]);

    // Handle soft delete / toggle active status
    const handleToggleActive = async (user) => {
        try {
            const res = await axiosInstance.patch(`/users/${user._id}/toggle-active`);
            if (res.data?.success) {
                toast.success(res.data.message || `User status updated!`);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error toggling user status:', err);
            toast.error(err.response?.data?.message || 'Failed to update user status');
        }
    };

    const handleCreateUserSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.email.trim() || !formData.password || !formData.role) {
            toast.error('Please fill in all required user fields');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                role: formData.role,
                facility_id: formData.facility_id.trim() || 'MAIN_UNIT'
            };

            const res = await axiosInstance.post('/users', payload);

            if (res.data?.success) {
                toast.success(`User '${res.data.data?.name}' created successfully!`);
                setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: roles.length > 0 ? roles[0]._id : '',
                    facility_id: 'MAIN_UNIT'
                });
                setIsAddUserOpen(false);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error creating user:', err);
            toast.error(err.response?.data?.message || 'Failed to create user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        {
            header: 'FULL NAME',
            render: (row) => <span className="font-bold text-text-main">{row.name || '-'}</span>,
            sortable: true
        },
        {
            header: 'EMAIL ADDRESS',
            render: (row) => <span className="font-mono text-xs text-text-muted">{row.email || '-'}</span>,
            sortable: true
        },
        {
            header: 'ASSIGNED ROLE',
            render: (row) => {
                const roleObj = typeof row.role === 'object' ? row.role : null;
                const roleName = roleObj?.name || row.roleName || (typeof row.role === 'string' ? row.role : 'User');
                const isAdmin = roleName.toLowerCase().includes('admin');

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isAdmin
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                        • {roleName}
                    </span>
                );
            }
        },
        {
            header: 'FACILITY / UNIT',
            render: (row) => (
                <span className="font-mono text-xs font-semibold text-text-main">
                    {row.facility_id || row.facilityName || 'MAIN_UNIT'}
                </span>
            )
        },
        {
            header: 'STATUS',
            render: (row) => (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    row.isActive !== false
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                    {row.isActive !== false ? '• Active' : '• Deactivated'}
                </span>
            )
        },
        {
            header: 'ACTIONS',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => handleToggleActive(row)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer shadow-2xs ${
                        row.isActive !== false
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                    title={row.isActive !== false ? 'Deactivate User Account' : 'Activate User Account'}
                >
                    {row.isActive !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                    <span>{row.isActive !== false ? 'Deactivate' : 'Activate'}</span>
                </button>
            )
        }
    ];

    const tabs = [
        {
            key: 'users',
            label: 'User Accounts',
            resourcePath: '/users',
            columns: columns
        }
    ];

    const headerButton = (
        <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
        >
            <Plus size={15} />
            <span>+ Add New User</span>
        </button>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="User Accounts & Access Management"
                description="Manage tenant user accounts, assigned RBAC roles, facility access, and account activation status."
                tabs={tabs}
                headerActions={headerButton}
            />

            {/* SlideOverPanel Drawer for Creating New User */}
            <SlideOverPanel
                isOpen={isAddUserOpen}
                onClose={() => setIsAddUserOpen(false)}
                title="Provision New User Account"
                subtitle="Create a new user credentials, assign role permissions & facility access"
            >
                <form onSubmit={handleCreateUserSubmit} className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Full Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Rahul Sharma"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Email Address *
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="rahul@polysack.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Temporary Password *
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            placeholder="At least 6 characters"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Assign Role *
                        </label>
                        {isLoadingRoles ? (
                            <div className="flex items-center gap-2 p-2 border border-border rounded-md text-xs text-text-muted">
                                <RefreshCw size={14} className="animate-spin text-primary" />
                                <span>Loading roles...</span>
                            </div>
                        ) : (
                            <select
                                required
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                            >
                                <option value="">-- Select Role --</option>
                                {roles.map((r) => (
                                    <option key={r._id} value={r._id}>
                                        {r.name} ({r.permissions ? `${r.permissions.length} Permissions` : 'Role'})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Facility / Unit Assignment
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. MAIN_UNIT or Vapi Plant #1"
                            value={formData.facility_id}
                            onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div className="pt-3 border-t border-border flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsAddUserOpen(false)}
                            className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <UserPlus size={15} />
                            <span>{isSubmitting ? 'Provisioning User...' : 'Provision User Account'}</span>
                        </button>
                    </div>
                </form>
            </SlideOverPanel>
        </>
    );
}
