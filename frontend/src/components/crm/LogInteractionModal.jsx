import { useState, useEffect } from 'react';
import { PhoneCall, X, Send } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const TODAY = new Date().toISOString().split('T')[0];

export default function LogInteractionModal({ isOpen, onClose, onSuccess, editData, initialData, customers = [], users = [] }) {
    const activeData = editData || initialData;
    const [formData, setFormData] = useState({
        customerId: '',
        interactionType: 'Phone Call',
        interactionDate: TODAY,
        subject: '',
        assignedExecutive: '',
        status: 'Open (Requires Follow-up)',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (activeData) {
            setFormData({
                customerId: activeData.customerId || activeData.customer?._id || activeData.customer || '',
                interactionType: activeData.interactionType || 'Phone Call',
                interactionDate: activeData.interactionDate
                    ? new Date(activeData.interactionDate).toISOString().split('T')[0]
                    : (activeData.date ? new Date(activeData.date).toISOString().split('T')[0] : TODAY),
                subject: activeData.subject || '',
                assignedExecutive: activeData.assignedExecutive?._id || activeData.assignedExecutive || '',
                status: activeData.status || 'Open (Requires Follow-up)',
                notes: activeData.notes || ''
            });
        } else {
            // reset form for new entry
            setFormData({
                customerId: customers[0]?._id || '',
                interactionType: 'Phone Call',
                interactionDate: TODAY,
                subject: '',
                assignedExecutive: users[0]?._id || '',
                status: 'Open (Requires Follow-up)',
                notes: ''
            });
        }
    }, [activeData, isOpen, customers, users]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerId || !formData.subject.trim()) {
            toast.error('Please select a customer and enter a subject');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                customer: formData.customerId,
                customerId: formData.customerId,
                interactionType: formData.interactionType,
                date: formData.interactionDate,
                interactionDate: formData.interactionDate,
                subject: formData.subject.trim(),
                assignedExecutive: formData.assignedExecutive || undefined,
                status: formData.status === 'Open (Requires Follow-up)' ? 'OPEN' : formData.status,
                notes: formData.notes.trim(),
                enquiryId: activeData?.enquiryId || activeData?.referenceId || undefined,
                referenceId: activeData?.referenceId || activeData?.enquiryId || undefined
            };

            let res;
            if (activeData?._id) {
                res = await axiosInstance.put(`/crm/interactions/${activeData._id}`, payload);
            } else {
                res = await axiosInstance.post('/crm/interactions', payload);
            }

            if (res.data?.success) {
                toast.success(activeData ? 'Interaction updated successfully!' : 'Customer interaction logged!');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(res.data?.message || 'Failed to save interaction');
            }
        } catch (err) {
            console.error('Error saving interaction:', err);
            toast.error(err.response?.data?.message || 'Failed to save interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
            <div className="fixed inset-0" onClick={onClose} />

            <div className="relative z-10 w-full max-w-lg bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                <div className="px-5 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary/20 text-primary-light rounded-xl shrink-0">
                            <PhoneCall size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-sidebar-text-active">
                                {activeData ? 'Edit Customer Interaction' : 'Log Customer Interaction & Follow-up'}
                            </h3>
                            <p className="text-[11px] text-sidebar-text">
                                Record meeting notes, call follow-up, and status
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-sidebar-text hover:text-white rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Customer Master *
                        </label>
                        <select
                            name="customerId"
                            value={formData.customerId || ''}
                            onChange={(e) => handleInputChange('customerId', e.target.value)}
                            required
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                        >
                            <option value="">Select Customer...</option>
                            {customers.length > 0 && customers.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.code ? `${c.code} - ` : ''}{c.companyName || c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Interaction Type *
                            </label>
                            <select
                                required
                                value={formData.interactionType}
                                onChange={(e) => setFormData({ ...formData, interactionType: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="Phone Call">Phone Call</option>
                                <option value="Email">Email Communication</option>
                                <option value="In-Person Meeting">In-Person Meeting</option>
                                <option value="Site Visit">Site Visit</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Other">Other / Escalation</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Interaction Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.interactionDate}
                                onChange={(e) => setFormData({ ...formData, interactionDate: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Subject / Agenda *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Monthly order commitment & pricing discussion"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Assigned Executive
                            </label>
                            <select
                                value={formData.assignedExecutive}
                                onChange={(e) => setFormData({ ...formData, assignedExecutive: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="">Unassigned</option>
                                {users.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name} ({u.role?.name || u.role || 'Executive'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Status *
                            </label>
                            <select
                                required
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="Open (Requires Follow-up)">Open (Requires Follow-up)</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved / Complete</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Notes & Discussion Points
                        </label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Enter detailed discussion points, customer feedback..."
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary resize-y"
                        />
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
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
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Send size={13} />
                            <span>{isSubmitting ? 'Saving...' : (activeData ? 'Update Interaction' : 'Save Interaction')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
