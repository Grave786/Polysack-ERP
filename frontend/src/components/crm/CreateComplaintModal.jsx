import { useState, useEffect } from 'react';
import { AlertTriangle, X, Send } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const TODAY = new Date().toISOString().split('T')[0];

export default function CreateComplaintModal({ isOpen, onClose, editData, initialData, onSuccess, customers = [], users = [] }) {
    const activeData = editData || initialData;
    const [formData, setFormData] = useState({
        customerId: '',
        complaintType: 'QUALITY_DEFECT',
        incidentDate: TODAY,
        description: '',
        assignedExecutive: '',
        status: 'Open Ticket'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editData || initialData) {
            const data = editData || initialData;
            setFormData({
                customerId: data.customerId || data.customer?._id || data.customer || '',
                complaintType: data.complaintType || '',
                incidentDate: data.incidentDate
                    ? new Date(data.incidentDate).toISOString().split('T')[0]
                    : (data.date ? new Date(data.date).toISOString().split('T')[0] : ''),
                description: data.description || '',
                assignedExecutive: (typeof data.assignedExecutive === 'object' ? data.assignedExecutive?._id : data.assignedExecutive) || '',
                status: data.status || 'Open Ticket'
            });
        } else {
            // reset form for new entry
            setFormData({
                customerId: '',
                complaintType: '',
                incidentDate: '',
                description: '',
                assignedExecutive: '',
                status: 'Open Ticket'
            });
        }
    }, [editData, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customerId || !formData.description.trim()) {
            toast.error('Please select a customer and provide a description');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                customer: formData.customerId,
                customerId: formData.customerId,
                complaintType: formData.complaintType,
                description: formData.description.trim(),
                date: formData.incidentDate,
                incidentDate: formData.incidentDate,
                assignedExecutive: formData.assignedExecutive || undefined,
                status: formData.status
            };

            let res;
            if (activeData?._id) {
                res = await axiosInstance.put(`/crm/complaints/${activeData._id}`, payload);
            } else {
                res = await axiosInstance.post('/crm/complaints', payload);
            }

            if (res.data?.success) {
                toast.success(activeData ? 'Complaint ticket updated!' : `Complaint ticket '${res.data.data?.ticketNumber || 'COMP-TICKET'}' filed successfully!`);
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(res.data?.message || 'Failed to save complaint ticket');
            }
        } catch (err) {
            console.error('Error saving complaint:', err);
            toast.error(err.response?.data?.message || 'Failed to save complaint');
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
                        <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
                            <AlertTriangle size={18} className="text-rose-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-sidebar-text-active">
                                {activeData ? 'Edit Complaint Ticket' : 'File Quality & Delivery Complaint'}
                            </h3>
                            <p className="text-[11px] text-sidebar-text">
                                Escalate defect complaints, bag bursting, or delivery delay tickets
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
                            required
                            value={formData.customerId}
                            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">Select Customer...</option>
                            {customers.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.code || 'CUST'} - {c.companyName || c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Complaint Type *
                            </label>
                            <select
                                required
                                value={formData.complaintType}
                                onChange={(e) => setFormData({ ...formData, complaintType: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="QUALITY_DEFECT">Bag Burst / Stitching Defect</option>
                                <option value="DELIVERY_DELAY">Delivery Delay / Logistics</option>
                                <option value="QUANTITY_MISMATCH">Shortage / Quantity Mismatch</option>
                                <option value="PACKAGING_DAMAGE">Bale Damage / Wet Bags</option>
                                <option value="PRICE_DISCREPANCY">Invoice / Rate Discrepancy</option>
                                <option value="OTHER">Other Issue</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Incident Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.incidentDate}
                                onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Complaint Description *
                        </label>
                        <textarea
                            required
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe defect in detail (e.g. 50 bags burst during automated filling at customer site...)"
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary resize-y"
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
                                <option value="Open Ticket">Open Ticket</option>
                                <option value="Under Investigation">Under Investigation</option>
                                <option value="Resolved / CAPA Issued">Resolved / CAPA Issued</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>
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
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Send size={13} />
                            <span>{isSubmitting ? 'Saving...' : (activeData ? 'Update Ticket' : 'File Complaint Ticket')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
