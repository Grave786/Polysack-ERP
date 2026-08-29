import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, UserCheck, UserX, UserPlus, RefreshCw, ShieldCheck, CheckCircle2, Pencil, X, Building2, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function UserManagementPage() {
    const currentUser = useAuthStore((state) => state.user);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const isSuperAdmin = Boolean(
        !currentUser?.tenant ||
        currentUser?.email === 'superadmin@polysack.com' ||
        currentUser?.roleName === 'SUPER_ADMIN' ||
        currentUser?.role?.name === 'SUPER_ADMIN' ||
        currentUser?.role === 'SUPER_ADMIN'
    );

    // Form state for creating new user
    const [roles, setRoles] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit User Modal State
    const [editModal, setEditModal] = useState({
        isOpen: false,
        user: null,
        role: '',
        facility_id: '',
        isSaving: false
    });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        facility_id: 'MAIN_UNIT'
    });

    // Fetch Roles and Locations on Mount or Refresh
    useEffect(() => {
        axiosInstance.get('/roles')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const rolesList = res.data.data.filter((r) => r.isActive !== false);
                    setRoles(rolesList);
                    if (rolesList.length > 0) {
                        setFormData((prev) => ({ ...prev, role: prev.role || rolesList[0]._id }));
                    }
                }
            })
            .catch((err) => {
                console.error('Error fetching roles:', err);
            });

        if (!isSuperAdmin) {
            axiosInstance.get('/locations?isActive=true')
                .then((res) => {
                    if (res.data?.success && Array.isArray(res.data.data)) {
                        setLocationsList(res.data.data);
                    }
                })
                .catch(() => {});
        }
    }, [refreshKey, isSuperAdmin]);

    // Open Edit User Modal (Blocked for self to prevent lockout)
    const handleOpenEditUser = (user) => {
        const currentUserId = currentUser?._id || currentUser?.id;
        if (String(user._id) === String(currentUserId)) {
            toast.error('Self-role change is restricted to prevent accidental lockout.');
            return;
        }

        const roleId = typeof user.role === 'object' ? user.role?._id : user.role;
        setEditModal({
            isOpen: true,
            user,
            role: roleId || (roles[0]?._id || ''),
            facility_id: user.facility_id || 'MAIN_UNIT',
            isSaving: false
        });
    };

    // Submit Edit User Form
    const handleSaveEditUser = async (e) => {
        if (e) e.preventDefault();
        if (!editModal.user?._id) return;

        if (!editModal.role) {
            toast.error('Please select a role for this user');
            return;
        }

        try {
            setEditModal((prev) => ({ ...prev, isSaving: true }));
            toast.loading('Updating user account...', { id: 'edit-user-toast' });

            const res = await axiosInstance.put(`/users/${editModal.user._id}`, {
                role: editModal.role,
                facility_id: editModal.facility_id
            });

            if (res.data?.success) {
                toast.success(`User '${editModal.user.name}' updated successfully!`, { id: 'edit-user-toast' });
                setEditModal({ isOpen: false, user: null, role: '', facility_id: '', isSaving: false });
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error updating user:', err);
            toast.error(err.response?.data?.message || 'Failed to update user', { id: 'edit-user-toast' });
            setEditModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    // Handle soft delete / toggle active status
    const handleToggleActive = async (user) => {
        const currentUserId = currentUser?._id || currentUser?.id;
        if (String(user._id) === String(currentUserId)) {
            toast.error('You cannot deactivate or delete your own account.');
            return;
        }

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
            render: (row) => (
                <div className="flex items-center gap-1.5 font-bold text-text-main">
                    <span>{row.name || '-'}</span>
                    {String(row._id) === String(currentUser?._id || currentUser?.id) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            (You)
                        </span>
                    )}
                </div>
            ),
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
            header: isSuperAdmin ? 'ACCESS SCOPE' : 'FACILITY / UNIT',
            render: (row) => (
                <span className="font-mono text-xs font-semibold text-text-main">
                    {isSuperAdmin ? 'Platform Super Admin (Global)' : (row.facility_id || row.facilityName || 'MAIN_UNIT')}
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
            render: (row) => {
                const currentUserId = currentUser?._id || currentUser?.id;
                const isSelf = String(row._id) === String(currentUserId);

                return (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => !isSelf && handleOpenEditUser(row)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-extrabold transition-all shadow-2xs ${
                                isSelf
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-app-bg text-text-muted hover:text-primary hover:bg-primary/10 border border-border cursor-pointer'
                            }`}
                            title={
                                isSelf
                                    ? 'Self-role change is restricted to prevent accidental lockout'
                                    : 'Edit User Role & Facility'
                            }
                        >
                            <Pencil size={13} />
                            <span>Edit</span>
                        </button>

                        <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => !isSelf && handleToggleActive(row)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-extrabold transition-all shadow-2xs ${
                                isSelf
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                    : row.isActive !== false
                                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer'
                            }`}
                            title={
                                isSelf
                                    ? 'You cannot deactivate or delete your own account'
                                    : row.isActive !== false
                                        ? 'Deactivate User Account'
                                        : 'Activate User Account'
                            }
                        >
                            {row.isActive !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                            <span>{row.isActive !== false ? 'Deactivate' : 'Activate'}</span>
                        </button>
                    </div>
                );
            }
        }
    ];

    const tenantAdminColumns = [
        {
            header: 'TENANT / ORGANIZATION',
            render: (row) => {
                const t = row.tenant;
                const companyName = t?.companyName || t?.name || 'Tenant Organization';
                const subdomain = t?.subdomain;
                const isTenantActive = t?.isActive !== false;

                return (
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-text-main">
                            <Building2 size={13} className="text-primary shrink-0" />
                            <span>{companyName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {subdomain && (
                                <span className="font-mono text-[10px] text-text-muted">
                                    ({subdomain}.polysack.com)
                                </span>
                            )}
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                isTenantActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                                {isTenantActive ? 'Active' : 'Suspended'}
                            </span>
                        </div>
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'ADMINISTRATOR',
            render: (row) => (
                <div className="font-bold text-text-main">
                    {row.name || '-'}
                </div>
            ),
            sortable: true
        },
        {
            header: 'EMAIL ADDRESS',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">{row.email || '-'}</span>
            ),
            sortable: true
        },
        {
            header: 'ASSIGNED ROLE',
            render: (row) => {
                const roleName = row.role?.name || 'Tenant Admin';
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
                        • {roleName}
                    </span>
                );
            }
        },
        {
            header: 'ACCOUNT STATUS',
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
                <Link
                    to="/administration/tenants"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-app-bg hover:bg-primary/10 text-text-muted hover:text-primary border border-border rounded text-[11px] font-extrabold transition-all"
                    title="View & Manage Tenant Organization"
                >
                    <ExternalLink size={12} />
                    <span>Manage Tenant</span>
                </Link>
            )
        }
    ];

    const tabs = isSuperAdmin
        ? [
              {
                  key: 'platform-admins',
                  label: 'Platform Super Admins',
                  resourcePath: '/users',
                  columns: columns
              },
              {
                  key: 'tenant-admins',
                  label: 'Tenant Administrators (Across Organizations)',
                  resourcePath: '/super-admin/tenant-admins',
                  columns: tenantAdminColumns
              }
          ]
        : [
              {
                  key: 'users',
                  label: 'User Accounts',
                  resourcePath: '/users',
                  columns: columns
              }
          ];

    const headerButton = !isSuperAdmin ? (
        <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
        >
            <Plus size={15} />
            <span>+ Add New User</span>
        </button>
    ) : null;

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title={isSuperAdmin ? "Platform Users & Tenant Administrators" : "User Accounts & Access Management"}
                description={isSuperAdmin ? "Overview of Platform Super Admins and organization Tenant Administrators." : "Manage tenant user accounts, assigned RBAC roles, facility access, and account activation status."}
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

            {/* Edit User Role & Facility Modal */}
            {editModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setEditModal({ isOpen: false, user: null, role: '', facility_id: '', isSaving: false })}
                    />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-xl shadow-2xl p-6 font-sans space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center pb-3 border-b border-border">
                            <div>
                                <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider">
                                    Edit User Role & Access
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5">
                                    Update RBAC permissions & facility assignment
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditModal({ isOpen: false, user: null, role: '', facility_id: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Read-only User Info Card */}
                        <div className="p-3 bg-app-bg border border-border rounded-lg space-y-1">
                            <div className="text-xs font-bold text-text-main">
                                {editModal.user?.name}
                            </div>
                            <div className="text-xs font-mono text-text-muted">
                                {editModal.user?.email}
                            </div>
                        </div>

                        <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs font-sans">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Assigned Role *
                                </label>
                                <select
                                    required
                                    value={editModal.role}
                                    onChange={(e) => setEditModal((prev) => ({ ...prev, role: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                                >
                                    <option value="">-- Select Role --</option>
                                    {roles.map((r) => (
                                        <option key={r._id} value={r._id}>
                                            {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Facility / Unit Location
                                </label>
                                <select
                                    value={editModal.facility_id}
                                    onChange={(e) => setEditModal((prev) => ({ ...prev, facility_id: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                                >
                                    <option value="MAIN_UNIT">MAIN_UNIT (Default Plant)</option>
                                    {locationsList.map((loc) => (
                                        <option key={loc._id} value={loc.code || loc.name}>
                                            {loc.name} ({loc.code || loc.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setEditModal({ isOpen: false, user: null, role: '', facility_id: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {editModal.isSaving ? 'Saving...' : 'Save User Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
