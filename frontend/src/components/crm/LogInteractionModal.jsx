import { useState, useEffect, useMemo } from 'react';
import { PhoneCall, X, Send, ExternalLink, Clock } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import SearchableSelect from '../shared/SearchableSelect';

const TODAY = new Date().toISOString().split('T')[0];

const toDateInput = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

export default function LogInteractionModal({
    isOpen,
    onClose,
    onSuccess,
    editData,
    initialData,
    customers = [],
    users = [],
    enquiries: propEnquiries = [],
    onOpenEnquiry
}) {
    const activeData = editData || initialData;
    const [enquiries, setEnquiries] = useState(propEnquiries);
    const [formData, setFormData] = useState({
        linkType: 'customer',
        customerId: '',
        enquiryId: '',
        interactionType: 'Phone Call',
        interactionDate: TODAY,
        nextFollowUpDate: '',
        subject: '',
        assignedExecutive: '',
        status: 'Open (Requires Follow-up)',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (Array.isArray(propEnquiries) && propEnquiries.length > 0) {
            setEnquiries(propEnquiries);
        }
    }, [propEnquiries]);

    useEffect(() => {
        if (!isOpen || activeData) return;
        if (Array.isArray(propEnquiries) && propEnquiries.length > 0) return;
        axiosInstance.get('/crm/enquiries?limit=200')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setEnquiries(res.data.data);
                }
            })
            .catch(() => {});
    }, [isOpen, activeData, propEnquiries]);

    useEffect(() => {
        if (!isOpen) return;
        if (activeData) {
            let initialStatus = activeData.status || 'OPEN';
            if (['OPEN', 'Open', 'Open (Requires Follow-up)'].includes(initialStatus)) {
                initialStatus = 'Open (Requires Follow-up)';
            } else if (['IN_PROGRESS', 'in_progress', 'In Progress'].includes(initialStatus)) {
                initialStatus = 'In Progress';
            } else if (['CLOSED', 'RESOLVED', 'Resolved', 'Resolved / Complete', 'Closed (Resolved)', 'Closed'].includes(initialStatus)) {
                initialStatus = 'Resolved';
            }

            let initialType = activeData.interactionType || 'Phone Call';
            if (initialType === 'CALL') initialType = 'Phone Call';
            else if (initialType === 'EMAIL' || initialType === 'Email') initialType = 'Email Communication';
            else if (initialType === 'MEETING') initialType = 'In-Person Meeting';
            else if (initialType === 'VISIT') initialType = 'Site Visit';
            else if (initialType === 'OTHER' || initialType === 'Other') initialType = 'Other / Escalation';

            const resolvedCustomerId =
                typeof activeData.customer === 'object' && activeData.customer !== null
                    ? activeData.customer._id || activeData.customer.id || ''
                    : activeData.customer || activeData.customerId || '';

            const rawEnq = activeData.enquiry || activeData.enquiryId || activeData.referenceId;
            const resolvedEnquiryId =
                typeof rawEnq === 'object' && rawEnq !== null
                    ? rawEnq._id || rawEnq.id || ''
                    : rawEnq || '';

            setFormData({
                linkType: resolvedCustomerId ? 'customer' : 'enquiry',
                customerId: resolvedCustomerId,
                enquiryId: resolvedEnquiryId,
                interactionType: initialType,
                interactionDate: toDateInput(activeData.interactionDate || activeData.date) || TODAY,
                nextFollowUpDate: toDateInput(activeData.nextFollowUpDate),
                subject: activeData.subject || '',
                assignedExecutive: activeData.assignedExecutive?._id || activeData.assignedExecutive || '',
                status: initialStatus,
                notes: activeData.notes || ''
            });
        } else {
            setFormData({
                linkType: 'customer',
                customerId: customers[0]?._id || '',
                enquiryId: '',
                interactionType: 'Phone Call',
                interactionDate: TODAY,
                nextFollowUpDate: '',
                subject: '',
                assignedExecutive: users[0]?._id || '',
                status: 'Open (Requires Follow-up)',
                notes: ''
            });
        }
    }, [activeData, isOpen, customers, users]);

    const openEnquiries = useMemo(() => {
        return (enquiries || []).filter(
            (e) => !['Confirmed', 'Converted', 'SO Created', 'Closed - Won', 'Lost'].includes(e.status) && !e.orderConfirmed
        );
    }, [enquiries]);

    if (!isOpen) return null;

    const editHasCustomer = Boolean(activeData && formData.customerId);
    const editEnquiryObj = activeData
        ? (typeof activeData.enquiry === 'object' && activeData.enquiry !== null
            ? activeData.enquiry
            : (typeof activeData.enquiryId === 'object' && activeData.enquiryId !== null ? activeData.enquiryId : null))
        : null;
    const isProspectEditMode = Boolean(activeData && formData.enquiryId && !editHasCustomer);

    const prospectName =
        activeData?.prospectName ||
        editEnquiryObj?.newCustomerDetails?.company ||
        editEnquiryObj?.newCustomerDetails?.name ||
        activeData?.customerName ||
        'Prospect';
    const prospectNsl = activeData?.enquiryNumber || editEnquiryObj?.nslNumber || editEnquiryObj?.enquiryNumber || '';
    const prospectPhone =
        activeData?.contactNumber ||
        editEnquiryObj?.contactNumber ||
        editEnquiryObj?.newCustomerDetails?.phone ||
        '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.subject.trim()) {
            toast.error('Please enter a subject');
            return;
        }
        if (isProspectEditMode || formData.linkType === 'enquiry') {
            if (!formData.enquiryId) {
                toast.error('Please select an Order Enquiry (Prospect)');
                return;
            }
        } else if (!formData.customerId) {
            toast.error('Please select a Customer');
            return;
        }

        try {
            setIsSubmitting(true);
            const isEnquiryMode = isProspectEditMode || formData.linkType === 'enquiry';
            const payload = {
                customer: isEnquiryMode ? null : formData.customerId,
                customerId: isEnquiryMode ? null : formData.customerId,
                enquiry: formData.enquiryId || null,
                enquiryId: formData.enquiryId || null,
                referenceId: formData.enquiryId || null,
                interactionType: formData.interactionType,
                date: formData.interactionDate,
                interactionDate: formData.interactionDate,
                nextFollowUpDate: formData.nextFollowUpDate || null,
                subject: formData.subject.trim(),
                assignedExecutive: formData.assignedExecutive || null,
                status:
                    formData.status === 'Open (Requires Follow-up)'
                        ? 'OPEN'
                        : formData.status === 'In Progress'
                            ? 'IN_PROGRESS'
                            : formData.status === 'Resolved'
                                ? 'CLOSED'
                                : formData.status,
                notes: formData.notes.trim()
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

            <div className="relative z-10 w-full max-w-lg bg-card-bg border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
                <div className="px-5 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between shrink-0">
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

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans overflow-y-auto flex-1">
                    {isProspectEditMode ? (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                        Prospect
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                                        Linked Order Enquiry
                                    </span>
                                </div>
                                <div className="font-bold text-text-main text-xs truncate">
                                    Prospect: {prospectName}
                                    {prospectNsl ? ` (${prospectNsl})` : ''}
                                    {prospectPhone ? ` - ${prospectPhone}` : ''}
                                </div>
                            </div>
                            {onOpenEnquiry && formData.enquiryId && (
                                <button
                                    type="button"
                                    onClick={() => onOpenEnquiry(editEnquiryObj || formData.enquiryId)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                                >
                                    <span>View Enquiry</span>
                                    <ExternalLink size={11} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {!activeData && (
                                <div className="flex items-center gap-1.5 p-1 bg-app-bg border border-border rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setFormData((p) => ({ ...p, linkType: 'customer' }))}
                                        className={`flex-1 py-1.5 px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                            formData.linkType === 'customer'
                                                ? 'bg-primary text-sidebar-bg shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        Existing Customer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData((p) => ({ ...p, linkType: 'enquiry' }))}
                                        className={`flex-1 py-1.5 px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                            formData.linkType === 'enquiry'
                                                ? 'bg-primary text-sidebar-bg shadow-2xs'
                                                : 'text-text-muted hover:text-text-main'
                                        }`}
                                    >
                                        Enquiry (Prospect)
                                    </button>
                                </div>
                            )}

                            {formData.linkType === 'enquiry' && !activeData ? (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Order Enquiry (Prospect) *
                                    </label>
                                    <SearchableSelect
                                        required
                                        value={formData.enquiryId}
                                        onChange={(val) => setFormData((p) => ({ ...p, enquiryId: val }))}
                                        placeholder="-- Search Enquiry by NSL, Name or Phone --"
                                        searchPlaceholder="Search NSL number, prospect name, phone..."
                                        emptyMessage="No open enquiries found"
                                        options={openEnquiries.map((enq) => {
                                            const name =
                                                enq.newCustomerDetails?.company ||
                                                enq.newCustomerDetails?.name ||
                                                enq.customerRef?.companyName ||
                                                enq.customer?.companyName ||
                                                enq.contactPerson ||
                                                'Prospect';
                                            const phone = enq.contactNumber || enq.newCustomerDetails?.phone || '';
                                            const nsl = enq.nslNumber || enq.enquiryNumber || 'ENQ';
                                            return {
                                                value: enq._id,
                                                code: nsl,
                                                label: name,
                                                subLabel: [phone, enq.status].filter(Boolean).join(' • '),
                                                searchText: `${nsl} ${name} ${phone} ${enq.contactPerson || ''}`
                                            };
                                        })}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Customer Master *
                                    </label>
                                    <SearchableSelect
                                        required
                                        value={formData.customerId}
                                        onChange={(val) => setFormData((p) => ({ ...p, customerId: val }))}
                                        placeholder="-- Select Customer --"
                                        searchPlaceholder="Search customer by code, name or phone..."
                                        emptyMessage="No customers found"
                                        options={customers.map((c) => ({
                                            value: c._id,
                                            code: c.code || 'CUST',
                                            label: c.companyName || c.name,
                                            subLabel: [c.contactPerson, c.phone].filter(Boolean).join(' • '),
                                            searchText: `${c.code || ''} ${c.companyName || ''} ${c.name || ''} ${c.phone || ''}`
                                        }))}
                                    />
                                </div>
                            )}
                        </div>
                    )}

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
                                <option value="Email Communication">Email Communication</option>
                                <option value="In-Person Meeting">In-Person Meeting</option>
                                <option value="Site Visit">Site Visit</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Other / Escalation">Other / Escalation</option>
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
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1.5">
                            <Clock size={12} className="text-amber-500" />
                            <span>Next Follow-up Date</span>
                            <span className="text-[10px] font-normal text-text-muted">(Optional)</span>
                        </label>
                        <input
                            type="date"
                            value={formData.nextFollowUpDate}
                            onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                        />
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
