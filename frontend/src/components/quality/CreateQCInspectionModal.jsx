import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateQCInspectionModal({ isOpen, onClose, onSuccess, defaultType = 'INBOUND' }) {
    const [inspectionType, setInspectionType] = useState(defaultType);
    const [pendingInbound, setPendingInbound] = useState([]);
    const [pendingOutbound, setPendingOutbound] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selected target keys
    const [selectedInboundKey, setSelectedInboundKey] = useState(''); // `${grnId}_${rmId}` or 'DIRECT'
    const [selectedDirectRmId, setSelectedDirectRmId] = useState('');
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');

    const [formData, setFormData] = useState({
        sampleSize: 50,
        passedQty: 50,
        rejectedQty: 0,
        tensileStrength: 250,
        gsmTested: 65,
        defects: ''
    });

    // Fetch pending QC targets on open
    const fetchPendingTargets = () => {
        setIsLoadingOptions(true);
        Promise.all([
            axiosInstance.get('/qc-inspections/pending-targets').catch(() => ({ data: { data: { inbound: [], outbound: [] } } })),
            axiosInstance.get('/raw-materials?limit=100').catch(() => ({ data: { data: [] } }))
        ])
            .then(([targetsRes, rmRes]) => {
                const inboundList = targetsRes.data?.data?.inbound || [];
                const outboundList = targetsRes.data?.data?.outbound || [];
                const rmList = rmRes.data?.data || [];

                setPendingInbound(inboundList);
                setPendingOutbound(outboundList);
                setRawMaterials(rmList);

                // Initialize defaults
                if (inboundList.length > 0) {
                    const first = inboundList[0];
                    setSelectedInboundKey(`${first.grnId}_${first.rawMaterial._id}`);
                    setFormData((prev) => ({
                        ...prev,
                        passedQty: Math.min(prev.passedQty, first.remainingQuantity),
                        sampleSize: Math.min(prev.sampleSize, first.remainingQuantity)
                    }));
                } else if (rmList.length > 0) {
                    setSelectedInboundKey('DIRECT');
                    setSelectedDirectRmId(rmList[0]._id);
                }

                if (outboundList.length > 0) {
                    const firstWo = outboundList[0];
                    setSelectedWorkOrderId(firstWo.workOrderId);
                }
            })
            .finally(() => setIsLoadingOptions(false));
    };

    useEffect(() => {
        if (isOpen) {
            setInspectionType(defaultType);
            fetchPendingTargets();
        }
    }, [isOpen, defaultType]);

    // Active selected inbound item metadata
    const activeInboundItem = useMemo(() => {
        if (selectedInboundKey === 'DIRECT' || !selectedInboundKey) return null;
        return pendingInbound.find((item) => `${item.grnId}_${item.rawMaterial._id}` === selectedInboundKey) || null;
    }, [selectedInboundKey, pendingInbound]);

    // Active selected outbound work order metadata
    const activeOutboundItem = useMemo(() => {
        if (!selectedWorkOrderId) return null;
        return pendingOutbound.find((wo) => String(wo.workOrderId) === String(selectedWorkOrderId)) || null;
    }, [selectedWorkOrderId, pendingOutbound]);

    // Calculate max allowed inspectable quantity for current selection
    const maxAllowedQty = useMemo(() => {
        if (inspectionType === 'INBOUND') {
            return activeInboundItem ? activeInboundItem.remainingQuantity : null;
        } else {
            return activeOutboundItem ? activeOutboundItem.remainingQuantity : null;
        }
    }, [inspectionType, activeInboundItem, activeOutboundItem]);

    const totalTested = Number(formData.passedQty || 0) + Number(formData.rejectedQty || 0);
    const isExceedingRemaining = maxAllowedQty !== null && totalTested > maxAllowedQty;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const sampleSizeNum = Number(formData.sampleSize || 1);
        const passedQtyNum = Number(formData.passedQty || 0);
        const rejectedQtyNum = Number(formData.rejectedQty || 0);
        const sumTested = passedQtyNum + rejectedQtyNum;

        if (sumTested <= 0) {
            toast.error('Passed Qty + Rejected Qty must be greater than 0');
            return;
        }

        if (maxAllowedQty !== null && sumTested > maxAllowedQty) {
            toast.error(`Cannot inspect ${sumTested} units. Max remaining inspectable quantity is ${maxAllowedQty}.`);
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
                if (activeInboundItem) {
                    payload.grn = activeInboundItem.grnId;
                    payload.rawMaterial = activeInboundItem.rawMaterial._id;
                } else if (selectedDirectRmId) {
                    payload.rawMaterial = selectedDirectRmId;
                } else {
                    toast.error('Please select a target Raw Material or GRN line item.');
                    return;
                }
            } else {
                if (!selectedWorkOrderId) {
                    toast.error('Please select a Work Order.');
                    return;
                }
                payload.workOrder = selectedWorkOrderId;
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
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Target Inbound GRN Line Item *
                                </label>
                                <span className="text-[10px] text-text-muted">
                                    {pendingInbound.length} pending line item(s)
                                </span>
                            </div>
                            <select
                                required
                                value={selectedInboundKey}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedInboundKey(val);
                                    const match = pendingInbound.find((item) => `${item.grnId}_${item.rawMaterial._id}` === val);
                                    if (match) {
                                        setFormData((prev) => ({
                                            ...prev,
                                            passedQty: Math.min(prev.passedQty || match.remainingQuantity, match.remainingQuantity),
                                            sampleSize: Math.min(prev.sampleSize || 50, match.remainingQuantity)
                                        }));
                                    }
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans font-medium"
                            >
                                {pendingInbound.map((item) => (
                                    <option
                                        key={`${item.grnId}_${item.rawMaterial._id}`}
                                        value={`${item.grnId}_${item.rawMaterial._id}`}
                                    >
                                        {item.grnNumber} — {item.rawMaterial.name} ({item.remainingQuantity} {item.rawMaterial.uom || 'KG'} remaining of {item.receivedQuantity})
                                    </option>
                                ))}
                                <option value="DIRECT">-- Direct Inward / No GRN --</option>
                            </select>
                        </div>

                        {selectedInboundKey === 'DIRECT' && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Select Raw Material *
                                </label>
                                <select
                                    required
                                    value={selectedDirectRmId}
                                    onChange={(e) => setSelectedDirectRmId(e.target.value)}
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
                        )}

                        {activeInboundItem && (
                            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between text-xs shadow-2xs">
                                <div className="space-y-0.5">
                                    <div>
                                        <span className="text-blue-800 font-semibold">GRN / PO Ref: </span>
                                        <span className="font-extrabold text-blue-950 font-mono">{activeInboundItem.grnNumber} ({activeInboundItem.poNumber})</span>
                                    </div>
                                    <div className="text-[11px] text-blue-900">
                                        Received: <strong className="text-blue-950 font-bold">{activeInboundItem.receivedQuantity}</strong> | Already Inspected: <strong className="text-blue-950 font-bold">{activeInboundItem.alreadyInspected}</strong>
                                    </div>
                                </div>
                                <div className="text-right pl-3 border-l border-blue-200">
                                    <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">Remaining to QC</span>
                                    <span className="text-sm font-black font-mono text-blue-950">
                                        {activeInboundItem.remainingQuantity} {activeInboundItem.rawMaterial.uom || 'KG'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Target Work Order *
                                </label>
                                <span className="text-[10px] text-text-muted">
                                    {pendingOutbound.length} pending Work Order(s)
                                </span>
                            </div>
                            <select
                                required
                                value={selectedWorkOrderId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedWorkOrderId(val);
                                    const match = pendingOutbound.find((wo) => String(wo.workOrderId) === String(val));
                                    if (match) {
                                        setFormData((prev) => ({
                                            ...prev,
                                            passedQty: Math.min(prev.passedQty || match.remainingQuantity, match.remainingQuantity),
                                            sampleSize: Math.min(prev.sampleSize || 50, match.remainingQuantity)
                                        }));
                                    }
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans font-medium"
                            >
                                <option value="">-- Select Pending Work Order --</option>
                                {pendingOutbound.map((wo) => (
                                    <option key={wo.workOrderId} value={wo.workOrderId}>
                                        {wo.workOrderNumber} — {wo.finishedGood.name} ({wo.remainingQuantity} remaining of {wo.totalProduced})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activeOutboundItem && (
                            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between text-xs shadow-2xs">
                                <div className="space-y-0.5">
                                    <div>
                                        <span className="text-blue-800 font-semibold">Customer / WO: </span>
                                        <span className="font-extrabold text-blue-950 font-mono">{activeOutboundItem.workOrderNumber} ({activeOutboundItem.customerName})</span>
                                    </div>
                                    <div className="text-[11px] text-blue-900">
                                        Total Produced: <strong className="text-blue-950 font-bold">{activeOutboundItem.totalProduced}</strong> | Already Inspected: <strong className="text-blue-950 font-bold">{activeOutboundItem.alreadyInspected}</strong>
                                    </div>
                                </div>
                                <div className="text-right pl-3 border-l border-blue-200">
                                    <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">Remaining to QC</span>
                                    <span className="text-sm font-black font-mono text-blue-950">
                                        {activeOutboundItem.remainingQuantity} {activeOutboundItem.finishedGood.uom || 'BAGS'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
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
                            max={maxAllowedQty || undefined}
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
                            max={maxAllowedQty || undefined}
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
                            max={maxAllowedQty || undefined}
                            value={formData.rejectedQty}
                            onChange={(e) => setFormData({ ...formData, rejectedQty: e.target.value })}
                            className="w-full border border-rose-300 rounded-md p-2.5 bg-rose-50/50 text-xs font-bold text-rose-900 focus:outline-none focus:border-rose-500 font-mono"
                        />
                    </div>
                </div>

                {isExceedingRemaining && (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 text-rose-800 text-xs font-bold">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        <span>
                            Inspection total ({totalTested}) exceeds remaining un-inspected quantity ({maxAllowedQty})! Please reduce Passed or Rejected quantity.
                        </span>
                    </div>
                )}

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
                        disabled={isSubmitting || isExceedingRemaining}
                        className={`px-4 py-2 rounded-md text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs ${
                            isSubmitting || isExceedingRemaining
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary-hover text-sidebar-bg cursor-pointer'
                        }`}
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
