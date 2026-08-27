import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateQCInspectionModal({ isOpen, onClose, onSuccess, defaultType = 'INBOUND' }) {
    const [inspectionType, setInspectionType] = useState(defaultType);
    const [workOrders, setWorkOrders] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [grns, setGrns] = useState([]);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        workOrder: '',
        rawMaterial: '',
        grn: '',
        sampleSize: 50,
        passedQty: 50,
        rejectedQty: 0,
        tensileStrength: 250,
        gsmTested: 65,
        defects: ''
    });

    useEffect(() => {
        if (isOpen) {
            setInspectionType(defaultType);
            setIsLoadingOptions(true);

            Promise.all([
                axiosInstance.get('/work-orders?limit=100').catch(() => ({ data: { data: [] } })),
                axiosInstance.get('/raw-materials?limit=100').catch(() => ({ data: { data: [] } })),
                axiosInstance.get('/grns?limit=100').catch(() => ({ data: { data: [] } }))
            ])
                .then(([woRes, rmRes, grnRes]) => {
                    const woList = woRes.data?.data || [];
                    const rmList = rmRes.data?.data || [];
                    const grnList = grnRes.data?.data || [];

                    setWorkOrders(woList);
                    setRawMaterials(rmList);
                    setGrns(grnList);

                    setFormData((prev) => ({
                        ...prev,
                        workOrder: prev.workOrder || (woList[0]?._id || ''),
                        rawMaterial: prev.rawMaterial || (rmList[0]?._id || ''),
                        grn: prev.grn || (grnList[0]?._id || '')
                    }));
                })
                .finally(() => setIsLoadingOptions(false));
        }
    }, [isOpen, defaultType]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (inspectionType === 'OUTBOUND' && !formData.workOrder) {
            toast.error('Please select a Work Order');
            return;
        }

        if (inspectionType === 'INBOUND' && !formData.rawMaterial) {
            toast.error('Please select a Raw Material');
            return;
        }

        const sampleSizeNum = Number(formData.sampleSize || 1);
        const passedQtyNum = Number(formData.passedQty || 0);
        const rejectedQtyNum = Number(formData.rejectedQty || 0);

        if (passedQtyNum + rejectedQtyNum <= 0) {
            toast.error('Passed Qty + Rejected Qty must be greater than 0');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                inspectionType,
                sampleSize: sampleSizeNum,
                passedQty: passedQtyNum,
                rejectedQty: rejectedQtyNum,
                tensileStrength: formData.tensileStrength ? Number(formData.tensileStrength) : undefined,
                gsmTested: formData.gsmTested ? Number(formData.gsmTested) : undefined,
                defects: formData.defects || undefined
            };

            if (inspectionType === 'INBOUND') {
                payload.rawMaterial = formData.rawMaterial;
                if (formData.grn) payload.grn = formData.grn;
            } else {
                payload.workOrder = formData.workOrder;
            }

            const res = await axiosInstance.post('/qc-inspections', payload);

            if (res.data?.success) {
                toast.success(`QC Inspection logged & certified (${inspectionType}) successfully!`);
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
            title={
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-primary" size={20} />
                    <span>New Quality Control (QC) Certificate</span>
                </div>
            }
            subtitle="Record laboratory testing metrics, passed/rejected batches, and release stock"
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans p-1">
                {/* Inspection Type Selector */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Inspection Gate Category *
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-app-bg rounded-lg border border-border">
                        <button
                            type="button"
                            onClick={() => setInspectionType('INBOUND')}
                            className={`py-2 px-3 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                                inspectionType === 'INBOUND'
                                    ? 'bg-primary text-sidebar-bg shadow-xs'
                                    : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                            Inbound (Raw Materials)
                        </button>
                        <button
                            type="button"
                            onClick={() => setInspectionType('OUTBOUND')}
                            className={`py-2 px-3 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                                inspectionType === 'OUTBOUND'
                                    ? 'bg-primary text-sidebar-bg shadow-xs'
                                    : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                            Outbound (Finished Goods)
                        </button>
                    </div>
                </div>

                {inspectionType === 'INBOUND' ? (
                    <>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Target Raw Material *
                            </label>
                            <select
                                required
                                value={formData.rawMaterial}
                                onChange={(e) => setFormData({ ...formData, rawMaterial: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                            >
                                <option value="">-- Select Raw Material --</option>
                                {rawMaterials.map((rm) => (
                                    <option key={rm._id} value={rm._id}>
                                        {rm.name} ({rm.code || rm.uom?.name || 'KG'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Associated GRN # (Optional)
                            </label>
                            <select
                                value={formData.grn}
                                onChange={(e) => setFormData({ ...formData, grn: e.target.value })}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                            >
                                <option value="">-- Direct Inward / No GRN --</option>
                                {grns.map((g) => (
                                    <option key={g._id} value={g._id}>
                                        {g.grnNumber}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                ) : (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Target Work Order *
                        </label>
                        <select
                            required
                            value={formData.workOrder}
                            onChange={(e) => setFormData({ ...formData, workOrder: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                        >
                            <option value="">-- Select Work Order --</option>
                            {workOrders.map((wo) => (
                                <option key={wo._id} value={wo._id}>
                                    {wo.workOrderNumber} — {wo.finishedGood?.name || 'Finished Product'}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Sample Size
                        </label>
                        <input
                            type="number"
                            required
                            min="1"
                            value={formData.sampleSize}
                            onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                            Passed Qty *
                        </label>
                        <input
                            type="number"
                            required
                            min="0"
                            value={formData.passedQty}
                            onChange={(e) => setFormData({ ...formData, passedQty: e.target.value })}
                            className="w-full border border-emerald-300 rounded-md p-2.5 bg-emerald-50/50 text-xs font-bold text-emerald-900 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-rose-800 mb-1">
                            Rejected Qty *
                        </label>
                        <input
                            type="number"
                            required
                            min="0"
                            value={formData.rejectedQty}
                            onChange={(e) => setFormData({ ...formData, rejectedQty: e.target.value })}
                            className="w-full border border-rose-300 rounded-md p-2.5 bg-rose-50/50 text-xs font-bold text-rose-900 focus:outline-none focus:border-rose-500 font-mono"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Tensile Strength (N)
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 250"
                            value={formData.tensileStrength}
                            onChange={(e) => setFormData({ ...formData, tensileStrength: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            GSM Tested
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 65"
                            value={formData.gsmTested}
                            onChange={(e) => setFormData({ ...formData, gsmTested: e.target.value })}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Defects / Failure Notes
                    </label>
                    <textarea
                        rows={2}
                        placeholder="Log any weave defects, color mismatch, or tensile failure details..."
                        value={formData.defects}
                        onChange={(e) => setFormData({ ...formData, defects: e.target.value })}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-border text-text-muted hover:text-text-main rounded-md text-xs font-bold cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg rounded-md text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Certifying...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={14} />
                                <span>Save & Certify QC Inspection</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
