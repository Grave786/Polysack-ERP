import { useState, useEffect } from 'react';
import SlideOverPanel from './SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { Building2, UserCheck } from 'lucide-react';

export default function CreateCustomerModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const [form, setForm] = useState({
        code: '',
        companyName: '',
        contactPerson: '',
        phone: '',
        email: '',
        gstin: '',
        city: '',
        state: 'Gujarat',
        creditLimit: 0,
        panNumber: '',
        paymentTerms: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const prefix = initialData?.companyName || initialData?.company || 'CUST';
            const cleanPrefix = prefix.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'CUST';

            setForm({
                code: `${cleanPrefix}-${randomSuffix}`,
                companyName: initialData?.companyName || initialData?.company || '',
                contactPerson: initialData?.contactPerson || initialData?.name || '',
                phone: initialData?.phone || '',
                email: initialData?.email || '',
                gstin: initialData?.gstin || '',
                city: initialData?.city || '',
                state: initialData?.state || 'Gujarat',
                creditLimit: initialData?.creditLimit || 0,
                panNumber: initialData?.panNumber || '',
                paymentTerms: initialData?.paymentTerms || ''
            });
        }
    }, [isOpen, initialData]);

    const handleCustomerSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isSubmitting) return;
        if (!form.code.trim() || !form.companyName.trim()) {
            toast.error('Customer Code and Company Name are required.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                code: form.code.trim().toUpperCase(),
                companyName: form.companyName.trim(),
                contactPerson: form.contactPerson.trim() || undefined,
                phone: form.phone.trim() || undefined,
                email: form.email.trim().toLowerCase() || undefined,
                gstin: form.gstin.trim().toUpperCase() || undefined,
                city: form.city.trim() || undefined,
                state: form.state.trim() || undefined,
                creditLimit: Number(form.creditLimit) || 0,
                panNumber: form.panNumber ? form.panNumber.trim().toUpperCase() : undefined,
                paymentTerms: form.paymentTerms ? form.paymentTerms.trim() : undefined,
                status: 'ACTIVE_CUSTOMER',
                isActive: true
            };

            const res = await axiosInstance.post('/customers', payload);
            if ((res.status === 200 || res.status === 201 || res.data?.success) && res.data?.data) {
                const customerData = res.data.data;
                const custId = customerData._id || customerData.id;
                const isExisting = res.status === 200 || res.data?.message === 'Existing customer used';
                if (isExisting) {
                    toast.success(`Existing customer '${customerData.companyName}' selected`);
                } else {
                    toast.success(`Customer '${customerData.companyName}' created successfully!`);
                }
                if (onSuccess) {
                    onSuccess(customerData, custId);
                }
                onClose();
            } else {
                toast.error(res.data?.message || 'Failed to create customer');
            }
        } catch (err) {
            console.error('Error creating customer:', err);
            if (err.response?.status === 400 || err.response?.status === 409) {
                try {
                    const fallbackRes = await axiosInstance.get(`/customers?search=${encodeURIComponent(form.companyName.trim())}&limit=1`);
                    if (fallbackRes.data?.data?.[0]) {
                        const existingCustomer = fallbackRes.data.data[0];
                        const custId = existingCustomer._id || existingCustomer.id;
                        toast.success(`Existing customer '${existingCustomer.companyName}' selected`);
                        if (onSuccess) {
                            onSuccess(existingCustomer, custId);
                        }
                        onClose();
                        return;
                    }
                } catch {
                    // ignore fallback failure
                }
            }
            toast.error(err.response?.data?.message || 'Failed to create customer');
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleSubmit = handleCustomerSubmit;
    const handleSaveAndContinue = handleCustomerSubmit;

    const inp = 'w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans';
    const lbl = 'block text-xs font-bold uppercase tracking-wider text-text-main mb-1';

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="Create Customer Master"
            subtitle="Add a new customer to master records before generating sales orders."
            widthClass="w-full max-w-full sm:max-w-xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Customer Code *</label>
                        <input
                            type="text"
                            required
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            className={inp}
                            placeholder="e.g. CUST-001"
                        />
                    </div>
                    <div>
                        <label className={lbl}>Company / Customer Name *</label>
                        <input
                            type="text"
                            required
                            value={form.companyName}
                            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                            className={inp}
                            placeholder="e.g. Sterling Polyfab Ltd"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Contact Person</label>
                        <input
                            type="text"
                            value={form.contactPerson}
                            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                            className={inp}
                            placeholder="e.g. Rajesh Kumar"
                        />
                    </div>
                    <div>
                        <label className={lbl}>Phone Number</label>
                        <input
                            type="text"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className={inp}
                            placeholder="+91 98765 43210"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Email Address</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className={inp}
                            placeholder="contact@company.com"
                        />
                    </div>
                    <div>
                        <label className={lbl}>GSTIN</label>
                        <input
                            type="text"
                            value={form.gstin}
                            onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                            className={inp}
                            placeholder="24AAAAA0000A1Z5"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>PAN Number</label>
                        <input
                            type="text"
                            value={form.panNumber}
                            onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                            className={inp}
                            placeholder="e.g. ABCDE1234F"
                        />
                    </div>
                    <div>
                        <label className={lbl}>Payment Terms</label>
                        <select
                            value={form.paymentTerms}
                            onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                            className={inp}
                        >
                            <option value="">-- Select Terms --</option>
                            <option value="Advance">Advance</option>
                            <option value="Net 15">Net 15 Days</option>
                            <option value="Net 30">Net 30 Days</option>
                            <option value="Net 45">Net 45 Days</option>
                            <option value="Net 60">Net 60 Days</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>City</label>
                        <input
                            type="text"
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            className={inp}
                            placeholder="e.g. Ahmedabad"
                        />
                    </div>
                    <div>
                        <label className={lbl}>State</label>
                        <input
                            type="text"
                            value={form.state}
                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                            className={inp}
                            placeholder="Gujarat"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <UserCheck size={15} />
                        <span>{isSubmitting ? 'Saving Customer...' : 'Save & Continue to Sales Order'}</span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
