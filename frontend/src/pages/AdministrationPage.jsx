import { useState, useEffect } from 'react';
import { Building2, ShieldCheck, RefreshCw, Save, CheckCircle } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function AdministrationPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        companyName: '',
        gstin: '',
        stateName: 'Gujarat',
        pan: '',
        contactEmail: '',
        contactPhone: '',
        registeredAddress: {
            line1: '',
            line2: '',
            city: '',
            pincode: ''
        }
    });

    // Derived state code preview
    const derivedStateCode = formData.gstin && formData.gstin.length >= 2 ? formData.gstin.substring(0, 2) : '';

    // Fetch existing Tenant Company Profile on Mount
    useEffect(() => {
        setIsLoading(true);
        axiosInstance.get('/admin/company-profile')
            .then((res) => {
                if (res.data?.success && res.data?.data) {
                    const profile = res.data.data;
                    setFormData({
                        companyName: profile.companyName || profile.tenantName || '',
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
    }, []);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddressChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            registeredAddress: {
                ...prev.registeredAddress,
                [field]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.gstin) {
            const cleanGstin = formData.gstin.trim().toUpperCase();
            const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/;
            if (!gstinRegex.test(cleanGstin)) {
                toast.error('Invalid GSTIN format. Expected 15 characters (e.g. 24AAAAA0000A1Z5)');
                return;
            }
        }

        if (formData.pan) {
            const cleanPan = formData.pan.trim().toUpperCase();
            const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
            if (!panRegex.test(cleanPan)) {
                toast.error('Invalid PAN format. Expected 10 characters (e.g. AAAAA0000A)');
                return;
            }
        }

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
                registeredAddress: formData.registeredAddress
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
                <p className="text-xs font-semibold text-text-muted">Loading Company Profile & GST Settings...</p>
            </div>
        );
    }

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
            <form onSubmit={handleSubmit} className="bg-card-bg border border-border rounded-xl p-6 shadow-2xs space-y-6">
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
                            onChange={(e) => handleChange('companyName', e.target.value)}
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
                            onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
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
                            onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
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
                            onChange={(e) => handleChange('stateName', e.target.value)}
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
                            onChange={(e) => handleChange('contactEmail', e.target.value)}
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
                            onChange={(e) => handleChange('contactPhone', e.target.value)}
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
                                onChange={(e) => handleAddressChange('line1', e.target.value)}
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
                                onChange={(e) => handleAddressChange('line2', e.target.value)}
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
                                onChange={(e) => handleAddressChange('city', e.target.value)}
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
                                onChange={(e) => handleAddressChange('pincode', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
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
                        <span>{isSaving ? 'Saving Profile & GST Settings...' : 'Save Company Profile & GST Settings'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
