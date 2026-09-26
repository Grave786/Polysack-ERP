import { useState, useEffect } from 'react';
import { PhoneCall, Calendar, MessageSquare, X, Send, Clock } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const TODAY = new Date().toISOString().split('T')[0];

export default function LogFollowUpModal({ isOpen, onClose, nslData, onSuccess }) {
    const [communicationType, setCommunicationType] = useState('Phone Call');
    const [followUpDate, setFollowUpDate] = useState(TODAY);
    const [notes, setNotes] = useState('');
    const [nextFollowUpDate, setNextFollowUpDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCommunicationType('Phone Call');
            setFollowUpDate(TODAY);
            setNotes('');
            setNextFollowUpDate('');
        }
    }, [isOpen, nslData]);

    if (!isOpen || !nslData) return null;

    const prospectName =
        nslData.customerRef?.companyName ||
        nslData.customerRef?.name ||
        nslData.customer?.companyName ||
        nslData.customer?.name ||
        nslData.newCustomerDetails?.company ||
        nslData.newCustomerDetails?.name ||
        'Lead / Customer';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!notes.trim()) {
            toast.error('Please enter discussion notes for the follow-up.');
            return;
        }

        try {
            setIsSubmitting(true);
            const targetCustomer =
                nslData.customerRef?._id ||
                nslData.customerRef ||
                nslData.customer?._id ||
                nslData.customer ||
                undefined;

            const payload = {
                customer: targetCustomer,
                customerId: targetCustomer,
                customerName: prospectName,
                enquiryId: nslData._id,
                referenceId: nslData._id,
                date: followUpDate,
                interactionType: communicationType,
                subject: `Follow-up: ${nslData.nslNumber || prospectName}`,
                notes: notes.trim(),
                status: 'OPEN',
                ...(nextFollowUpDate ? { nextFollowUpDate } : {})
            };

            const res = await axiosInstance.post('/crm/interactions', payload);

            if (res?.data?.success || res?.status === 200 || res?.status === 201) {
                toast.success('Follow-up logged successfully!');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(res?.data?.message || 'Failed to log follow-up');
            }
        } catch (err) {
            console.error('Error logging follow-up:', err);
            toast.error(err.response?.data?.message || 'Failed to log follow-up. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
            {/* Click-outside backdrop */}
            <div className="fixed inset-0" onClick={onClose} />

            {/* Modal Dialog Card */}
            <div className="relative z-10 w-full max-w-lg bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary/20 text-primary-light rounded-xl shrink-0">
                            <PhoneCall size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-sidebar-text-active flex items-center gap-2">
                                <span>Log Lead Follow-up</span>
                                {nslData.nslNumber && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/15 text-white">
                                        {nslData.nslNumber}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-sidebar-text truncate max-w-[280px] sm:max-w-md">
                                {prospectName}
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Communication Type */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Communication Type *
                            </label>
                            <select
                                required
                                value={communicationType}
                                onChange={(e) => setCommunicationType(e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="Phone Call">Phone Call</option>
                                <option value="Email">Email</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Site Visit">Site Visit</option>
                            </select>
                        </div>

                        {/* Follow-up Date */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Follow-up Date *
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={followUpDate}
                                    onChange={(e) => setFollowUpDate(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Discussion Notes */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center justify-between">
                            <span>Discussion Notes & Feedback *</span>
                            <span className="text-[10px] font-normal text-text-muted">Key agenda, buyer response, pricing talks</span>
                        </label>
                        <textarea
                            required
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter detailed notes regarding what was discussed, client feedback, or required specifications..."
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary resize-y"
                        />
                    </div>

                    {/* Next Action / Next Follow-up Date */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1.5">
                            <Clock size={12} className="text-amber-500" />
                            <span>Next Action / Follow-up Date</span>
                            <span className="text-[10px] font-normal text-text-muted">(Optional)</span>
                        </label>
                        <input
                            type="date"
                            value={nextFollowUpDate}
                            min={followUpDate || TODAY}
                            onChange={(e) => setNextFollowUpDate(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Send size={13} />
                            <span>{isSubmitting ? 'Saving...' : 'Save Follow-up'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
