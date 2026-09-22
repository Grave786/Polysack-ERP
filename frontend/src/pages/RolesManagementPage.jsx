import { useState, useEffect, useMemo } from 'react';
import { Plus, ShieldCheck, Edit2, Trash2, Lock, RefreshCw, RotateCcw } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { checkIsSuperAdmin } from '../utils/permissionUtils';

const MODULE_LABELS = {
    SALES: 'POS Billing & Sales Orders',
    PRODUCTION: 'Shop Floor & Work Orders',
    INVENTORY: 'Bag Inventory & Stock Master',
    QUALITY: 'Quality Control & COA Certificates',
    PROCUREMENT: 'Purchase Orders & GRN Inward',
    CRM: 'Customer Relations & CRM',
    DISPATCH: 'Dispatch & Delivery Challans',
    HR: 'Attendance & HR Management',
    USERS: 'User Accounts & Access Control',
    ROLES: 'Roles & Permission Matrices',
    MASTER_DATA: 'Products, Raw Materials & Machines'
};

const ACTION_COLORS = {
    CREATE: 'emerald',
    READ: 'blue',
    UPDATE: 'amber',
    DELETE: 'rose',
    APPROVE: 'purple'
};

export default function RolesManagementPage() {
    const user = useAuthStore((state) => state.user);
    const isSuperAdmin = checkIsSuperAdmin(user);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Status filter — drives the ?status= query param sent to the API
    const [statusFilter, setStatusFilter] = useState('All Statuses');

    // Form State
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Available System Permissions list from backend
    const [systemPermissions, setSystemPermissions] = useState([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

    // Fetch All System Permissions on Mount with robust fallback
    useEffect(() => {
        setIsLoadingPermissions(true);
        axiosInstance.get('/roles/permissions')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                    setSystemPermissions(res.data.data);
                } else {
                    return axiosInstance.get('/roles/permissions-list');
                }
            })
            .then((fallbackRes) => {
                if (fallbackRes?.data?.success && Array.isArray(fallbackRes.data.data)) {
                    setSystemPermissions(fallbackRes.data.data);
                }
            })
            .catch((err) => {
                console.warn('Using default system permissions fallback list:', err.message);
                const fallbackList = [];
                const modules = ['SALES', 'PRODUCTION', 'INVENTORY', 'QUALITY', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'USERS', 'ROLES', 'MASTER_DATA'];
                const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
                modules.forEach((module) => {
                    actions.forEach((action) => {
                        fallbackList.push({
                            _id: `${module}:${action}`,
                            module,
                            action,
                            description: `${action} access for ${module}`
                        });
                    });
                });
                setSystemPermissions(fallbackList);
            })
            .finally(() => {
                setIsLoadingPermissions(false);
            });
    }, []);

    // Group permissions by module name
    const groupedPermissions = useMemo(() => {
        const map = {};
        systemPermissions.forEach((p) => {
            if (!map[p.module]) {
                map[p.module] = [];
            }
            map[p.module].push(p);
        });
        return map;
    }, [systemPermissions]);

    // Handle Open Drawer for Create
    const handleOpenCreate = () => {
        setEditingRoleId(null);
        setRoleName('');
        setRoleDescription('');
        // Default to all READ permissions checked for easy setup
        const defaultReadPermissionIds = systemPermissions
            .filter((p) => p.action === 'READ')
            .map((p) => p._id);
        setSelectedPermissionIds(defaultReadPermissionIds);
        setIsDrawerOpen(true);
    };

    // Handle Open Drawer for Edit
    const handleOpenEdit = (role) => {
        setEditingRoleId(role._id);
        setRoleName(role.name || '');
        setRoleDescription(role.description || '');

        const existingIds = (role.permissions || []).map((p) =>
            typeof p === 'object' ? p._id : p
        );
        setSelectedPermissionIds(existingIds);
        setIsDrawerOpen(true);
    };

    // Deactivate Role (soft-delete)
    const handleDeleteRole = async (role) => {
        if (!window.confirm(`Deactivate role '${role.name}'?\n\nUsers currently assigned to this role keep their access until manually reassigned.`)) {
            return;
        }

        try {
            const res = await axiosInstance.delete(`/roles/${role._id}`);
            if (res.data?.success) {
                toast.success(`Role '${role.name}' deactivated.`);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error deactivating role:', err);
            toast.error(err.response?.data?.message || 'Failed to deactivate role');
        }
    };

    // Toggle isActive status — handles both reactivate and deactivate
    const handleToggleStatus = async (role) => {
        if (role.isActive !== false) {
            if (!window.confirm(`Deactivate role '${role.name}'?\n\nExisting users keep their access until reassigned.`)) return;
        }

        try {
            const res = await axiosInstance.patch(`/roles/${role._id}/status`);
            if (res.data?.success) {
                const isNowActive = res.data.data?.isActive;
                if (isNowActive) {
                    toast.success(`\u2705 Role '${role.name}' successfully reactivated.`);
                } else {
                    toast(`Role '${role.name}' deactivated.`, { icon: '\uD83D\uDD34' });
                }
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error toggling role status:', err);
            toast.error(err.response?.data?.message || 'Failed to toggle role status');
        }
    };

    // Permission Checkbox Toggle
    const handleTogglePermission = (permId) => {
        setSelectedPermissionIds((prev) => {
            if (prev.includes(permId)) {
                return prev.filter((id) => id !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    // Module Select All / Clear All Toggle
    const handleToggleModulePermissions = (moduleName) => {
        const modulePerms = groupedPermissions[moduleName] || [];
        const modulePermIds = modulePerms.map((p) => p._id);
        const allSelected = modulePermIds.every((id) => selectedPermissionIds.includes(id));

        if (allSelected) {
            setSelectedPermissionIds((prev) => prev.filter((id) => !modulePermIds.includes(id)));
        } else {
            setSelectedPermissionIds((prev) => {
                const set = new Set([...prev, ...modulePermIds]);
                return Array.from(set);
            });
        }
    };

    // Submit Handler for Create/Edit Role
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!roleName.trim()) {
            toast.error('Role name is required');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                name: roleName.trim(),
                description: roleDescription.trim(),
                permissions: selectedPermissionIds
            };

            let res;
            if (editingRoleId) {
                res = await axiosInstance.put(`/roles/${editingRoleId}`, payload);
            } else {
                res = await axiosInstance.post('/roles', payload);
            }

            if (res.data?.success) {
                toast.success(editingRoleId ? 'Role updated successfully!' : 'New role created successfully!');
                setIsDrawerOpen(false);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error saving role:', err);
            toast.error(err.response?.data?.message || 'Failed to save role');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = [
        {
            header: 'ROLE NAME',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <ShieldCheck
                        size={16}
                        className={`shrink-0 ${row.isActive !== false ? 'text-primary' : 'text-text-muted/40'}`}
                    />
                    <span className={`font-extrabold ${row.isActive !== false ? 'text-text-main' : 'text-text-muted line-through'}`}>
                        {row.name}
                    </span>
                </div>
            ),
            sortable: true
        },
        {
            header: 'DESCRIPTION',
            render: (row) => (
                <span className="text-xs text-text-muted">
                    {row.description || 'Custom organizational RBAC access role'}
                </span>
            )
        },
        {
            header: 'ASSIGNED PERMISSIONS',
            render: (row) => {
                const count = row.permissions?.length || 0;
                return (
                    <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-extrabold">
                        {count} {count === 1 ? 'Permission' : 'Permissions'} Granted
                    </span>
                );
            }
        },
        {
            header: 'STATUS',
            render: (row) => {
                const isActive = row.isActive !== false;
                return (
                    <button
                        type="button"
                        onClick={() => handleToggleStatus(row)}
                        title={isActive ? 'Click to deactivate this role' : 'Click to reactivate this role'}
                        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                            isActive
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700'
                                : 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        <span className="group-hover:hidden">{isActive ? 'Active Role' : 'Inactive'}</span>
                        <span className="hidden group-hover:inline">{isActive ? 'Deactivate?' : 'Reactivate?'}</span>
                    </button>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => {
                const isActive = row.isActive !== false;
                return (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 rounded-md bg-app-bg hover:bg-primary/10 text-text-muted hover:text-primary border border-border transition-colors cursor-pointer"
                            title="Edit Role & Permission Matrix"
                        >
                            <Edit2 size={14} />
                        </button>

                        {isActive ? (
                            <button
                                type="button"
                                onClick={() => handleDeleteRole(row)}
                                className="p-1.5 rounded-md bg-app-bg hover:bg-rose-50 text-text-muted hover:text-rose-600 border border-border transition-colors cursor-pointer"
                                title="Deactivate Role"
                            >
                                <Trash2 size={14} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleToggleStatus(row)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                                title="Restore / Reactivate this role"
                            >
                                <RotateCcw size={12} />
                                <span>Restore</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ];

    const tabs = [
        {
            key: 'roles',
            label: 'Defined Roles',
            resourcePath: `/roles${statusFilter !== 'All Statuses' ? `?status=${statusFilter.toLowerCase()}` : ''}`,
            columns: columns
        }
    ];

    const headerButton = (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Status filter dropdown */}
            <select
                value={statusFilter}
                onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setRefreshKey((prev) => prev + 1);
                }}
                className="border border-border rounded-lg px-3 py-2 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer transition-colors"
                title="Filter roles by status"
            >
                <option value="All Statuses">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive / Deactivated</option>
            </select>

            <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
            >
                <Plus size={15} />
                <span>+ Add New Role</span>
            </button>
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Roles & Permissions Builder"
                description="Configure tenant RBAC user roles and granular CRUD module permission matrices."
                tabs={tabs}
                headerActions={headerButton}
            />

            {/* SlideOverPanel Drawer for Creating/Editing Role & Permission Matrix */}
            <SlideOverPanel
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={editingRoleId ? 'Edit Role & Permission Matrix' : 'Create Custom RBAC Role'}
                subtitle="Define role title, description, and assign granular CRUD permissions across modules"
            >
                <form onSubmit={handleSubmit} className="space-y-6 font-sans text-xs">
                    {/* Basic Info Section */}
                    <div className="space-y-3 bg-app-bg p-4 rounded-xl border border-border">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Role Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Production Manager, Biller, QA Inspector"
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Role Description
                            </label>
                            <input
                                type="text"
                                placeholder="Brief summary of duties and access permissions"
                                value={roleDescription}
                                onChange={(e) => setRoleDescription(e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    {/* Permissions Matrix Section */}
                    <div>
                        <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-primary" />
                                <h3 className="text-sm font-bold text-text-main">
                                    Granular Module Permission Matrix
                                </h3>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {selectedPermissionIds.length} Granted
                            </span>
                        </div>

                        {isLoadingPermissions ? (
                            <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                                <RefreshCw className="animate-spin text-primary" size={18} />
                                <span>Loading system permission catalog...</span>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                {Object.keys(groupedPermissions)
                                    .filter((moduleName) => {
                                        if (isSuperAdmin) return true;
                                        if (['USERS', 'ROLES'].includes(moduleName)) return true;
                                        const tenantModules = user?.tenantEnabledModules || user?.tenant?.enabledModules || [
                                            'MASTER_DATA', 'PRODUCTION', 'QUALITY', 'INVENTORY', 'POS', 'SALES', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS'
                                        ];
                                        return tenantModules.includes(moduleName);
                                    })
                                    .map((moduleName) => {
                                    const perms = groupedPermissions[moduleName];
                                    const modulePermIds = perms.map((p) => p._id);
                                    const allSelected = modulePermIds.every((id) => selectedPermissionIds.includes(id));
                                    const someSelected = modulePermIds.some((id) => selectedPermissionIds.includes(id));

                                    return (
                                        <div
                                            key={moduleName}
                                            className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs space-y-3"
                                        >
                                            {/* Module Row Header */}
                                            <div className="flex items-center justify-between border-b border-border pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                                    <span className="font-extrabold text-xs text-text-main uppercase tracking-wider">
                                                        {MODULE_LABELS[moduleName] || moduleName}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleModulePermissions(moduleName)}
                                                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                                                >
                                                    {allSelected ? 'Clear All' : 'Select All'}
                                                </button>
                                            </div>

                                            {/* Action Checkboxes Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {perms.map((p) => {
                                                    const isChecked = selectedPermissionIds.includes(p._id);
                                                    return (
                                                        <label
                                                            key={p._id}
                                                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none ${isChecked
                                                                    ? 'bg-primary/5 border-primary/40 text-text-main font-bold'
                                                                    : 'bg-app-bg border-border text-text-muted hover:border-primary/20'
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleTogglePermission(p._id)}
                                                                className="rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                                                            />
                                                            <span className="text-[11px] uppercase tracking-wider">
                                                                {p.action}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Form Footer Actions */}
                    <div className="pt-4 border-t border-border flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsDrawerOpen(false)}
                            className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <ShieldCheck size={16} />
                            <span>{isSubmitting ? 'Saving Role Matrix...' : editingRoleId ? 'Update Role Matrix' : 'Create Role Matrix'}</span>
                        </button>
                    </div>
                </form>
            </SlideOverPanel>
        </>
    );
}
