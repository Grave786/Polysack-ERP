import { useState, useEffect } from 'react';
import { Building2, RefreshCw, Save, CheckCircle, Plus, Edit2, ShieldAlert, Check, X, UserCheck, Layers, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

const PLATFORM_MODULES = [
    { key: 'MASTER_DATA', label: 'Master Data & Industrial Specs', category: 'Core ERP', description: 'Products, Raw Materials, Machines, Categories, Bag Shapes & UOMs' },
    { key: 'PRODUCTION', label: 'Production & Shop Floor', category: 'Operations', description: 'Work Orders, Job Cards & Flexible Starting Stage routing' },
    { key: 'QUALITY', label: 'Quality Control & COA', category: 'Operations', description: 'Raw material & finished good QC inspections, defect logs & COA certificates' },
    { key: 'INVENTORY', label: 'Inventory & Stock Master', category: 'Operations', description: 'Real-time stock ledger, batch tracking, warehouse bin transfers & low stock alerts' },
    { key: 'POS', label: 'POS Billing Terminal', category: 'Commercial', description: 'Fast retail counter sales, cash/UPI payments & instant thermal receipt generation' },
    { key: 'SALES', label: 'Sales & Invoicing', category: 'Commercial', description: 'Sales Orders, Tax Invoices, payment receipts & overdue collections tracking' },
    { key: 'PROCUREMENT', label: 'Purchase & GRN Inward', category: 'Commercial', description: 'Purchase Orders, Vendor management & Goods Receipt Note inward workflows' },
    { key: 'CRM', label: 'Customer Relations & CRM', category: 'Commercial', description: 'Lead pipelines, customer interaction logs & complaint resolution management' },
    { key: 'DISPATCH', label: 'Dispatch & Delivery', category: 'Commercial', description: 'Delivery Challans, Vehicle loading, E-way bill & Proof of Delivery approval' },
    { key: 'HR', label: 'Attendance & HR Management', category: 'Management', description: 'Employee shifts, biometric attendance logs, leave & payroll records' },
    { key: 'ANALYTICS', label: 'Analytics & Executive Reports', category: 'Management', description: 'Financial dashboards, machine productivity KPIs & comprehensive audit reports' }
];

export default function AdministrationPage() {
    const user = useAuthStore((state) => state.user);
    const userRoleName = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
    const isSuperAdmin = Boolean(
        user?.isSuperAdmin ||
        !user?.tenant ||
        user?.email === 'superadmin@polysack.com' ||
        userRoleName === 'super admin' ||
        userRoleName === 'super_admin'
    );

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // =========================================================
    // SUPER ADMIN STATE
    // =========================================================
    const [tenantsList, setTenantsList] = useState([]);
    const [isCreateTenantDrawerOpen, setIsCreateTenantDrawerOpen] = useState(false);
    const [isEditTenantDrawerOpen, setIsEditTenantDrawerOpen] = useState(false);
    const [isModulesDrawerOpen, setIsModulesDrawerOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState(null);
    const [selectedTenantForModules, setSelectedTenantForModules] = useState(null);
    const [tenantModulesForm, setTenantModulesForm] = useState([]);
    const [isSavingModules, setIsSavingModules] = useState(false);

    // Create Tenant Form State
    const [newTenantForm, setNewTenantForm] = useState({
        tenantName: '',
        tenantEmail: '',
        tenantPhone: '',
        adminName: '',
        adminEmail: '',
        adminPassword: 'Password@123'
    });

    // Edit Specific Tenant Profile State
    const [tenantProfileForm, setTenantProfileForm] = useState({
        companyName: '',
        gstin: '',
        stateName: 'Gujarat',
        pan: '',
        contactEmail: '',
        contactPhone: '',
        registeredAddress: { line1: '', line2: '', city: '', pincode: '' }
    });

    // =========================================================
    // TENANT ADMIN STATE
    // =========================================================
    const [formData, setFormData] = useState({
        companyName: '',
        gstin: '',
        stateName: 'Gujarat',
        pan: '',
        contactEmail: '',
        contactPhone: '',
        registeredAddress: { line1: '', line2: '', city: '', pincode: '' }
    });

    const derivedStateCode = formData.gstin && formData.gstin.length >= 2 ? formData.gstin.substring(0, 2) : '';
    const derivedTenantEditStateCode = tenantProfileForm.gstin && tenantProfileForm.gstin.length >= 2 ? tenantProfileForm.gstin.substring(0, 2) : '';

    // Load initial data based on role
    useEffect(() => {
        setIsLoading(true);

        if (isSuperAdmin) {
            // Super Admin: Fetch list of all platform tenants
            axiosInstance.get('/super-admin/tenants')
                .then((res) => {
                    if (res.data?.success && Array.isArray(res.data.data)) {
                        setTenantsList(res.data.data);
                    }
                })
                .catch((err) => {
                    console.error('Error fetching platform tenants:', err);
                    toast.error('Failed to load platform tenants list');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            // Tenant Admin: Fetch self-scoped company profile
            axiosInstance.get('/admin/company-profile')
                .then((res) => {
                    if (res.data?.success && res.data?.data) {
                        const profile = res.data.data;
                        setFormData({
                            companyName: profile.companyName || profile.name || '',
                            gstin: profile.gstin || '',
                            stateName: profile.stateName || 'Gujarat',
                            pan: profile.pan || '',
                            contactEmail: profile.contactEmail || profile.email || '',
                            contactPhone: profile.contactPhone || profile.phone || '',
                            registeredAddress: {
                                line1: profile.registeredAddress?.line1 || '',
                                line2: profile.registeredAddress?.line2 || '',
                                city: profile.registeredAddress?.city || '',
                                pincode: profile.registeredAddress?.pincode || ''
                            },
                            productionSettings: {
                                activeStartingStage: profile.productionSettings?.activeStartingStage || 'FLEXO_PRINTING'
                            }
                        });
                    }
                })
                .catch((err) => {
                    console.error('Error loading company profile:', err);
                    toast.error('Failed to load company profile');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isSuperAdmin]);

    // Refresh tenants list for Super Admin
    const refreshTenants = () => {
        setIsLoading(true);
        axiosInstance.get('/super-admin/tenants')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setTenantsList(res.data.data);
                }
            })
            .catch((err) => console.error(err))
            .finally(() => setIsLoading(false));
    };

    // Open Edit Specific Tenant Drawer
    const handleOpenEditTenant = (tenantId) => {
        setSelectedTenantId(tenantId);
        setIsLoading(true);
        axiosInstance.get(`/super-admin/tenants/${tenantId}/company-profile`)
            .then((res) => {
                if (res.data?.success && res.data?.data) {
                    const t = res.data.data;
                    setTenantProfileForm({
                        companyName: t.companyName || t.name || '',
                        gstin: t.gstin || '',
                        stateName: t.stateName || 'Gujarat',
                        pan: t.pan || '',
                        contactEmail: t.email || '',
                        contactPhone: t.phone || '',
                        registeredAddress: {
                            line1: t.registeredAddress?.line1 || '',
                            line2: t.registeredAddress?.line2 || '',
                            city: t.registeredAddress?.city || '',
                            pincode: t.registeredAddress?.pincode || ''
                        },
                        productionSettings: {
                            activeStartingStage: t.productionSettings?.activeStartingStage || 'FLEXO_PRINTING'
                        }
                    });
                    setIsEditTenantDrawerOpen(true);
                }
            })
            .catch((err) => {
                console.error('Error fetching tenant details:', err);
                toast.error('Failed to load tenant details');
            })
            .finally(() => setIsLoading(false));
    };

    // Save Specific Tenant Profile (Super Admin)
    const handleSaveTenantProfile = async (e) => {
        e.preventDefault();
        if (!selectedTenantId) return;

        try {
            setIsSaving(true);
            const payload = {
                companyName: tenantProfileForm.companyName.trim(),
                name: tenantProfileForm.companyName.trim(),
                gstin: tenantProfileForm.gstin.trim().toUpperCase(),
                stateName: tenantProfileForm.stateName.trim(),
                stateCode: derivedTenantEditStateCode || undefined,
                pan: tenantProfileForm.pan.trim().toUpperCase(),
                email: tenantProfileForm.contactEmail.trim(),
                phone: tenantProfileForm.contactPhone.trim(),
                registeredAddress: tenantProfileForm.registeredAddress,
                productionSettings: tenantProfileForm.productionSettings
            };

            const res = await axiosInstance.patch(`/super-admin/tenants/${selectedTenantId}/company-profile`, payload);
            if (res.data?.success) {
                toast.success('Tenant company & GST profile updated successfully!');
                setIsEditTenantDrawerOpen(false);
                refreshTenants();
            }
        } catch (err) {
            console.error('Error updating tenant profile:', err);
            toast.error(err.response?.data?.message || 'Failed to update tenant profile');
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Tenant Active/Suspended Status
    const handleToggleTenantStatus = async (tenant) => {
        try {
            const nextStatus = !tenant.isActive;
            const res = await axiosInstance.patch(`/super-admin/tenants/${tenant._id}/status`, { isActive: nextStatus });
            if (res.data?.success) {
                toast.success(`Tenant ${tenant.name} is now ${nextStatus ? 'Active' : 'Suspended'}`);
                refreshTenants();
            }
        } catch (err) {
            console.error('Error toggling tenant status:', err);
            toast.error('Failed to toggle tenant status');
        }
    };

    // Create New Tenant Submission
    const handleCreateTenant = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const res = await axiosInstance.post('/tenants', newTenantForm);
            if (res.data?.success) {
                toast.success('New Tenant and Tenant Admin created successfully!');
                setIsCreateTenantDrawerOpen(false);
                setNewTenantForm({
                    tenantName: '',
                    tenantEmail: '',
                    tenantPhone: '',
                    adminName: '',
                    adminEmail: '',
                    adminPassword: 'Password@123'
                });
                refreshTenants();
            }
        } catch (err) {
            console.error('Error creating tenant:', err);
            toast.error(err.response?.data?.message || 'Failed to create tenant');
        } finally {
            setIsSaving(false);
        }
    };

    // Open Manage Modules Drawer
    const handleOpenManageModules = (tenant) => {
        setSelectedTenantForModules(tenant);
        setTenantModulesForm(Array.isArray(tenant.enabledModules) && tenant.enabledModules.length > 0
            ? tenant.enabledModules
            : PLATFORM_MODULES.map((m) => m.key)
        );
        setIsModulesDrawerOpen(true);
    };

    // Toggle a single module checkbox
    const handleToggleModule = (key) => {
        setTenantModulesForm((prev) => {
            if (prev.includes(key)) {
                return prev.filter((k) => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    // Select all modules
    const handleSelectAllModules = () => {
        setTenantModulesForm(PLATFORM_MODULES.map((m) => m.key));
    };

    // Deselect all modules
    const handleDeselectAllModules = () => {
        setTenantModulesForm([]);
    };

    // Save Tenant Modules
    const handleSaveTenantModules = async (e) => {
        e.preventDefault();
        if (!selectedTenantForModules) return;

        try {
            setIsSavingModules(true);
            const res = await axiosInstance.patch(`/super-admin/tenants/${selectedTenantForModules._id}/modules`, {
                enabledModules: tenantModulesForm
            });

            if (res.data?.success) {
                toast.success(`Module access for ${selectedTenantForModules.companyName || selectedTenantForModules.name} updated!`);
                setIsModulesDrawerOpen(false);
                refreshTenants();
            }
        } catch (err) {
            console.error('Error saving tenant modules:', err);
            toast.error(err.response?.data?.message || 'Failed to update tenant module access');
        } finally {
            setIsSavingModules(false);
        }
    };

    // Save Tenant Admin Self Company Profile
    const handleSubmitSelfProfile = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const payload = {
                companyName: formData.companyName.trim(),
                name: formData.companyName.trim(),
                gstin: formData.gstin.trim().toUpperCase(),
                stateName: formData.stateName.trim(),
                stateCode: derivedStateCode || undefined,
                pan: formData.pan.trim().toUpperCase(),
                contactEmail: formData.contactEmail.trim(),
                contactPhone: formData.contactPhone.trim(),
                registeredAddress: formData.registeredAddress,
                productionSettings: formData.productionSettings
            };

            const res = await axiosInstance.put('/admin/company-profile', payload);
            if (res.data?.success) {
                toast.success('Company GST Profile & Settings saved successfully!');
            }
        } catch (err) {
            console.error('Error saving company profile:', err);
            toast.error(err.response?.data?.message || 'Failed to save company profile');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-card-bg border border-border rounded-xl font-sans">
                <RefreshCw className="animate-spin text-primary mb-3" size={26} />
                <p className="text-xs font-semibold text-text-muted">Loading Administration Settings...</p>
            </div>
        );
    }

    // =========================================================
    // 1. SUPER ADMIN VIEW: PLATFORM TENANT ACCOUNTS MANAGEMENT
    // =========================================================
    if (isSuperAdmin) {
        return (
            <div className="space-y-6 font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                    <div>
                        <h1 className="text-xl font-extrabold text-text-main tracking-tight">
                            Tenant Accounts Management
                        </h1>
                        <p className="text-xs text-text-muted mt-0.5">
                            Manage Multi-Tenant Organizations, Provision Tenant Admins & Edit Company Profiles
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCreateTenantDrawerOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
                    >
                        <Plus size={16} />
                        <span>+ Register New Tenant</span>
                    </button>
                </div>

                {/* Tenants Table Card */}
                <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                        <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                            SYSTEM TENANT ORGANIZATIONS ({tenantsList.length})
                        </h3>
                        <span className="text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                            • Isolated Compound Indexing
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead>
                                <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                    <th className="p-3 border-b border-border">Tenant / Company Name</th>
                                    <th className="p-3 border-b border-border font-mono">GSTIN</th>
                                    <th className="p-3 border-b border-border">State</th>
                                    <th className="p-3 border-b border-border">Contact Email</th>
                                    <th className="p-3 border-b border-border">Tenant Admin</th>
                                    <th className="p-3 border-b border-border font-mono">Users</th>
                                    <th className="p-3 border-b border-border">Status</th>
                                    <th className="p-3 border-b border-border text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {tenantsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-text-muted">
                                            No tenant accounts registered on platform yet.
                                        </td>
                                    </tr>
                                ) : (
                                    tenantsList.map((t) => (
                                        <tr key={t._id} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                            <td className="p-3 font-bold text-text-main">
                                                {t.companyName || t.name}
                                            </td>
                                            <td className="p-3 font-mono font-bold text-primary">
                                                {t.gstin || 'Not Configured'}
                                            </td>
                                            <td className="p-3 text-text-muted">{t.stateName || 'Gujarat'}</td>
                                            <td className="p-3 font-mono text-text-muted">{t.email || '-'}</td>
                                            <td className="p-3">
                                                {t.tenantAdmin ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-bold text-text-main text-xs">{t.tenantAdmin.name}</div>
                                                        <div className="font-mono text-[11px] text-text-muted">{t.tenantAdmin.email}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-text-muted italic text-[11px]">No Admin Found</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono font-bold text-text-main">
                                                {t.userCount || 0}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                    t.isActive !== false
                                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                                                }`}>
                                                    {t.isActive !== false ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenManageModules(t)}
                                                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                        title="Configure Enabled Top-Level Modules for this Tenant"
                                                    >
                                                        <Layers size={13} />
                                                        <span>Modules</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditTenant(t._id)}
                                                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                        title="View and Edit Tenant GST / Address Profile"
                                                    >
                                                        <Edit2 size={13} />
                                                        <span>Edit Profile</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleTenantStatus(t)}
                                                        className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer border ${
                                                            t.isActive !== false
                                                                ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border-slate-200'
                                                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                                        }`}
                                                    >
                                                        {t.isActive !== false ? 'Suspend' : 'Activate'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Drawer 1: Create New Tenant */}
                <SlideOverPanel
                    isOpen={isCreateTenantDrawerOpen}
                    onClose={() => setIsCreateTenantDrawerOpen(false)}
                    title="Register New Tenant Organization"
                    subtitle="Create tenant company, database workspace, and first Tenant Admin user"
                >
                    <form onSubmit={handleCreateTenant} className="space-y-4 font-sans text-xs">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Tenant / Company Name *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Surat Packaging Mills Pvt Ltd"
                                value={newTenantForm.tenantName}
                                onChange={(e) => setNewTenantForm({ ...newTenantForm, tenantName: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Tenant Official Email *
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="contact@suratpack.com"
                                    value={newTenantForm.tenantEmail}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, tenantEmail: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="+91 98250 12345"
                                    value={newTenantForm.tenantPhone}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, tenantPhone: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                                Tenant Admin Account Provisioning
                            </h4>

                            <div>
                                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                    Admin Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Rajesh Shah"
                                    value={newTenantForm.adminName}
                                    onChange={(e) => setNewTenantForm({ ...newTenantForm, adminName: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        Admin Email *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="rajesh@suratpack.com"
                                        value={newTenantForm.adminEmail}
                                        onChange={(e) => setNewTenantForm({ ...newTenantForm, adminEmail: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        Initial Password *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        value={newTenantForm.adminPassword}
                                        onChange={(e) => setNewTenantForm({ ...newTenantForm, adminPassword: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsCreateTenantDrawerOpen(false)}
                                className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Building2 size={16} />
                                <span>{isSaving ? 'Registering Tenant...' : 'Create Tenant & Provision Admin'}</span>
                            </button>
                        </div>
                    </form>
                </SlideOverPanel>

                {/* Drawer 2: Edit Specific Tenant Profile (Super Admin) */}
                <SlideOverPanel
                    isOpen={isEditTenantDrawerOpen}
                    onClose={() => setIsEditTenantDrawerOpen(false)}
                    title="Edit Tenant GST & Company Profile"
                    subtitle="Update legal entity name, GSTIN, PAN, and registered address for selected tenant"
                >
                    <form onSubmit={handleSaveTenantProfile} className="space-y-4 font-sans text-xs">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Company / Legal Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={tenantProfileForm.companyName}
                                onChange={(e) => setTenantProfileForm({ ...tenantProfileForm, companyName: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    GSTIN Number *
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={15}
                                    value={tenantProfileForm.gstin}
                                    onChange={(e) => setTenantProfileForm({ ...tenantProfileForm, gstin: e.target.value.toUpperCase() })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-primary uppercase focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    PAN Number *
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    value={tenantProfileForm.pan}
                                    onChange={(e) => setTenantProfileForm({ ...tenantProfileForm, pan: e.target.value.toUpperCase() })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-text-main uppercase focus:outline-none focus:border-primary font-sans"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    State Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={tenantProfileForm.stateName}
                                    onChange={(e) => setTenantProfileForm({ ...tenantProfileForm, stateName: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Contact Email
                                </label>
                                <input
                                    type="email"
                                    value={tenantProfileForm.contactEmail}
                                    onChange={(e) => setTenantProfileForm({ ...tenantProfileForm, contactEmail: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                                Registered Address
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        Line 1
                                    </label>
                                    <input
                                        type="text"
                                        value={tenantProfileForm.registeredAddress.line1}
                                        onChange={(e) =>
                                            setTenantProfileForm({
                                                ...tenantProfileForm,
                                                registeredAddress: { ...tenantProfileForm.registeredAddress, line1: e.target.value }
                                            })
                                        }
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        Line 2
                                    </label>
                                    <input
                                        type="text"
                                        value={tenantProfileForm.registeredAddress.line2}
                                        onChange={(e) =>
                                            setTenantProfileForm({
                                                ...tenantProfileForm,
                                                registeredAddress: { ...tenantProfileForm.registeredAddress, line2: e.target.value }
                                            })
                                        }
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={tenantProfileForm.registeredAddress.city}
                                        onChange={(e) =>
                                            setTenantProfileForm({
                                                ...tenantProfileForm,
                                                registeredAddress: { ...tenantProfileForm.registeredAddress, city: e.target.value }
                                            })
                                        }
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                        Pincode
                                    </label>
                                    <input
                                        type="text"
                                        value={tenantProfileForm.registeredAddress.pincode}
                                        onChange={(e) =>
                                            setTenantProfileForm({
                                                ...tenantProfileForm,
                                                registeredAddress: { ...tenantProfileForm.registeredAddress, pincode: e.target.value }
                                            })
                                        }
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsEditTenantDrawerOpen(false)}
                                className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Save size={16} />
                                <span>{isSaving ? 'Updating Profile...' : 'Save Tenant GST Profile'}</span>
                            </button>
                        </div>
                    </form>
                </SlideOverPanel>

                {/* Drawer 3: Manage Tenant Module Entitlements */}
                <SlideOverPanel
                    isOpen={isModulesDrawerOpen}
                    onClose={() => setIsModulesDrawerOpen(false)}
                    title={`Module Entitlements: ${selectedTenantForModules?.companyName || selectedTenantForModules?.name || 'Tenant'}`}
                    subtitle="Control top-level ERP module access for this tenant organization"
                >
                    <form onSubmit={handleSaveTenantModules} className="space-y-4 font-sans text-xs">
                        {/* Header & Global Toggles */}
                        <div className="p-3 bg-app-bg border border-border rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <span className="font-extrabold text-xs text-text-main uppercase tracking-wider">
                                    Enabled Modules ({tenantModulesForm.length}/{PLATFORM_MODULES.length})
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAllModules}
                                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                                >
                                    Select All
                                </button>
                                <span className="text-text-muted text-xs">•</span>
                                <button
                                    type="button"
                                    onClick={handleDeselectAllModules}
                                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {/* Modules Checklist */}
                        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
                            {PLATFORM_MODULES.map((m) => {
                                const isChecked = tenantModulesForm.includes(m.key);
                                return (
                                    <div
                                        key={m.key}
                                        onClick={() => handleToggleModule(m.key)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                                            isChecked
                                                ? 'bg-primary/5 border-primary/40 shadow-2xs'
                                                : 'bg-card-bg border-border opacity-70 hover:opacity-100 hover:border-border/80'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}} // Controlled by outer div click
                                            className="mt-0.5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                                        />

                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-extrabold text-xs text-text-main">
                                                    {m.label}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-app-bg text-text-muted border border-border shrink-0">
                                                    {m.category}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-text-muted leading-relaxed">
                                                {m.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-4 border-t border-border flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModulesDrawerOpen(false)}
                                className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSavingModules}
                                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Save size={16} />
                                <span>{isSavingModules ? 'Saving Entitlements...' : 'Save Module Entitlements'}</span>
                            </button>
                        </div>
                    </form>
                </SlideOverPanel>
            </div>
        );
    }

    // =========================================================
    // 2. TENANT ADMIN VIEW: SELF-SCOPED GST & COMPANY PROFILE
    // =========================================================
    return (
        <div className="space-y-6 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <h1 className="text-xl font-extrabold text-text-main tracking-tight">
                        Administration & System Settings
                    </h1>
                    <p className="text-xs text-text-muted mt-0.5">
                        Configure Company Profile, GST State Code, Tax Registration, and Business Settings
                    </p>
                </div>

                {derivedStateCode && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-950 font-mono">
                            GST State Code: <strong>{derivedStateCode} ({formData.stateName})</strong>
                        </span>
                    </div>
                )}
            </div>

            {/* Company Profile Form Card */}
            <form onSubmit={handleSubmitSelfProfile} className="bg-card-bg border border-border rounded-xl p-6 shadow-2xs space-y-6">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Building2 size={20} className="text-primary" />
                    <h2 className="text-sm font-bold text-text-main">
                        Company Tax & GST Configuration
                    </h2>
                </div>

                {/* Grid 1: Company Name, GSTIN, PAN */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Company / Legal Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Polysack Packaging Industries Ltd"
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            GSTIN Number *
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={15}
                            placeholder="e.g. 24AAAAA0000A1Z5"
                            value={formData.gstin}
                            onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-mono font-bold text-primary uppercase focus:outline-none focus:border-primary"
                        />
                        <span className="text-[10px] text-text-muted mt-1 block">
                            First 2 digits automatically set Seller State Code
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            PAN Number *
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={10}
                            placeholder="e.g. AAAAA0000A"
                            value={formData.pan}
                            onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-mono font-bold text-text-main uppercase focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                {/* Grid 2: State Name, Contact Email, Contact Phone */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            State Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Gujarat"
                            value={formData.stateName}
                            onChange={(e) => setFormData({ ...formData, stateName: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Contact Email *
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="billing@polysack.com"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Contact Phone
                        </label>
                        <input
                            type="text"
                            placeholder="+91 9876543210"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                {/* Registered Address Header */}
                <div className="pt-2 border-t border-border">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-main mb-3">
                        Registered Business Address
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                Address Line 1
                            </label>
                            <input
                                type="text"
                                placeholder="Plot No 45, GIDC Industrial Estate"
                                value={formData.registeredAddress.line1}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        registeredAddress: { ...formData.registeredAddress, line1: e.target.value }
                                    })
                                }
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                Address Line 2
                            </label>
                            <input
                                type="text"
                                placeholder="Phase 2, Near Power Station"
                                value={formData.registeredAddress.line2}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        registeredAddress: { ...formData.registeredAddress, line2: e.target.value }
                                    })
                                }
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                placeholder="Ahmedabad"
                                value={formData.registeredAddress.city}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        registeredAddress: { ...formData.registeredAddress, city: e.target.value }
                                    })
                                }
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                Pincode
                            </label>
                            <input
                                type="text"
                                placeholder="380015"
                                value={formData.registeredAddress.pincode}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        registeredAddress: { ...formData.registeredAddress, pincode: e.target.value }
                                    })
                                }
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Production Pipeline Settings Header */}
                <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                        Production Pipeline & Active Starting Stage Settings
                    </h3>
                    <p className="text-[11px] text-text-muted">
                        Configure which stage newly launched Work Orders will start from. Stages preceding your active starting stage will automatically be marked as <span className="font-bold text-gray-500">Skipped — Not in Use</span> while remaining available for future machine expansion.
                    </p>

                    <div className="max-w-md">
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Active Facility Starting Stage *
                        </label>
                        <select
                            value={formData.productionSettings?.activeStartingStage || 'FLEXO_PRINTING'}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    productionSettings: {
                                        ...formData.productionSettings,
                                        activeStartingStage: e.target.value
                                    }
                                })
                            }
                            className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="TAPE_EXTRUSION">Stage 1: Tape Extrusion</option>
                            <option value="CIRCULAR_WEAVING">Stage 2: Circular Weaving</option>
                            <option value="EXTRUSION_LAMINATION">Stage 3: Extrusion Lamination</option>
                            <option value="FLEXO_PRINTING">Stage 4: Flexo Printing (Default - Skips Stages 1-3)</option>
                            <option value="CUTTING_SEWING">Stage 5: Cutting & Sewing</option>
                            <option value="STITCHING">Stage 6: Stitching</option>
                            <option value="HANDLE_ATTACHMENT">Stage 7: Handle Attachment</option>
                            <option value="BALING_PACKING">Stage 8: Baling & Packing</option>
                        </select>
                    </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-border flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <Save size={16} />
                        <span>{isSaving ? 'Saving Profile & Settings...' : 'Save Company Profile & Settings'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
