import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateQCInspectionModal({ isOpen, onClose, onSuccess }) {
    const [workOrders, setWorkOrders] = useState([]);
    const [isLoadingWO, setIsLoadingWO] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        workOrder: '',
        sampleSize: 50,
        passedQty: 50,
        rejectedQty: 0,
        tensileStrength: 250,
        gsmTested: 65,
        defects: ''
    });

    // Fetch active/in-progress Work Orders for selection
    useEffect(() => {
        if (isOpen) {
            setIsLoadingWO(true);
            axiosInstance.get('/work-orders?limit=100')
                .then((res) => {
                    if (res.data?.success && Array.isArray(res.data.data)) {
                        const list = res.data.data;
                        setWorkOrders(list);
                        if (list.length > 0) {
                            setFormData((prev) => ({
                                ...prev,
                                workOrder: prev.workOrder || list[0]._id
                            }));
                        }
                    }
                })
                .catch((err) => {
                    console.error('Error fetching Work Orders for QC:', err);
                })
                .finally(() => {
                    setIsLoadingWO(false);
                });
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.workOrder) {
            toast.error('Please select a Work Order');
            return;
        }

        const sampleSizeNum = Number(formData.sampleSize);
        const passedQtyNum = Number(formData.passedQty);
        const rejectedQtyNum = Number(formData.rejectedQty);

        if (isNaN(sampleSizeNum) || sampleSizeNum < 1) {
            toast.error('Sample size must be at least 1');
            return;
        }

        if (isNaN(passedQtyNum) || passedQtyNum < 0 || isNaN(rejectedQtyNum) || rejectedQtyNum < 0) {
            toast.error('Passed and Rejected quantities must be valid non-negative numbers');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                workOrder: formData.workOrder,
                sampleSize: sampleSizeNum,
                passedQty: passedQtyNum,
                rejectedQty: rejectedQtyNum,
                tensileStrength: formData.tensileStrength ? Number(formData.tensileStrength) : undefined,
                gsmTested: formData.gsmTested ? Number(formData.gsmTested) : undefined,
                defects: formData.defects || undefined
            };

            const res = await axiosInstance.post('/qc-inspections', payload);

            if (res.data?.success) {
                toast.success('QC Inspection logged & certified successfully!');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error creating QC Inspection:', err);
            toast.error(err.response?.data?.message || 'Failed to create QC Inspection');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="New Quality Control Lab Inspection"
            subtitle="Record lab tensile test findings, sample pass/fail counts & release batch stock"
        >
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
                {/* Work Order Selection */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Select Active Work Order / Batch Job *
                    </label>
                    {isLoadingWO ? (
                        <div className="flex items-center gap-2 text-xs text-text-muted p-2 border border-border rounded-md">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                            <span>Loading Work Orders...</span>
                        </div>
                    ) : (
                        <select
                            required
                            value={formData.workOrder}
                            onChange={(e) => setFormData((prev) => ({ ...prev, workOrder: e.target.value }))}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                        >
                            <option value="">-- Select Work Order --</option>
                            {workOrders.map((wo) => (
                                <option key={wo._id} value={wo._id}>
                                    {wo.workOrderNumber} - {wo.finishedGood?.name || 'Bag Spec'} ({wo.customer?.companyName || 'Client'}) [{wo.status}]
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Sample Size & Tensile Strength */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Sample Size (Units) *
                        </label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={formData.sampleSize}
                            onChange={(e) => setFormData((prev) => ({ ...prev, sampleSize: e.target.value }))}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Tensile Strength (N)
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 250"
                            value={formData.tensileStrength}
                            onChange={(e) => setFormData((prev) => ({ ...prev, tensileStrength: e.target.value }))}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold"
                        />
                    </div>
                </div>

                {/* Passed Qty & Rejected Qty */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Passed Units Count *
                        </label>
                        <input
                            type="number"
                            min="0"
                            required
                            value={formData.passedQty}
                            onChange={(e) => setFormData((prev) => ({ ...prev, passedQty: e.target.value }))}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-emerald-800 focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Rejected / Scrap Units *
                        </label>
                        <input
                            type="number"
                            min="0"
                            required
                            value={formData.rejectedQty}
                            onChange={(e) => setFormData((prev) => ({ ...prev, rejectedQty: e.target.value }))}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-rose-800 focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                {/* Tested Fabric GSM */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Tested Fabric GSM
                    </label>
                    <input
                        type="number"
                        placeholder="e.g. 65"
                        value={formData.gsmTested}
                        onChange={(e) => setFormData((prev) => ({ ...prev, gsmTested: e.target.value }))}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                    />
                </div>

                {/* Defects & Lab Comments */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Defects & Lab Inspector Observations
                    </label>
                    <textarea
                        rows={3}
                        placeholder="Describe any seam bursting, lamination peeling, or color mismatch defects..."
                        value={formData.defects}
                        onChange={(e) => setFormData((prev) => ({ ...prev, defects: e.target.value }))}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                </div>

                {/* Submit Action Button */}
                <div className="pt-3 border-t border-border flex justify-end gap-3">
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
                        <ShieldCheck size={15} />
                        <span>{isSubmitting ? 'Logging QC Test...' : 'Save & Certify QC Inspection'}</span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
