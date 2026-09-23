import { useState, useEffect } from 'react';
import { Truck, RefreshCw, CheckCircle2 } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import PackingSlipRollsSection, { createEmptyRoll } from '../shared/PackingSlipRollsSection';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateGRNPanel({ isOpen, onClose, po, onSuccess }) {
    const [locations, setLocations] = useState([]);
    const [receivingLocation, setReceivingLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoadingLocs, setIsLoadingLocs] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Items array mapping PO items
    const [grnItems, setGrnItems] = useState([]);
    // Multiple rolls array to manage incoming rolls
    const [inwardRolls, setInwardRolls] = useState([
        { rollNo: '', length: '', width: '', grossWeight: '', netWeight: '', qtyKgs: '', qtyPcs: '' }
    ]);
    const rolls = inwardRolls;
    const setRolls = setInwardRolls;

    const [activePoDetails, setActivePoDetails] = useState(null);

    // Initialize items & refetch fresh PO details whenever modal opens or po._id changes
    useEffect(() => {
        const poId = po?._id;
        if (isOpen && poId) {
            setIsLoadingLocs(true);
            setNotes('');
            setInwardRolls([
                { rollNo: '', length: '', width: '', grossWeight: '', netWeight: '', qtyKgs: '', qtyPcs: '' }
            ]);

            // Fetch receiving locations & fresh PO details in parallel
            Promise.all([
                axiosInstance.get('/locations?isActive=true&limit=200').catch(() => ({ data: { data: [] } })),
                axiosInstance.get(`/purchase-orders/${poId}`).catch(() => ({ data: { data: null } }))
            ])
                .then(([locRes, poRes]) => {
                    if (locRes.data?.success && Array.isArray(locRes.data.data)) {
                        const locs = locRes.data.data;
                        setLocations(locs);
                        if (locs.length > 0) setReceivingLocation(locs[0]._id);
                    }

                    const freshPo = poRes.data?.data || po;
                    setActivePoDetails(freshPo);

                    const itemsList = Array.isArray(freshPo?.items) ? freshPo.items : [];
                    setGrnItems(
                        itemsList.map((i) => {
                            const rmId = typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial;
                            const rmName = typeof i.rawMaterial === 'object' ? i.rawMaterial?.name : 'Raw Material';
                            const rmCode = typeof i.rawMaterial === 'object' ? i.rawMaterial?.code : '';
                            
                            const ordered = i.orderedQuantity || 0;
                            const alreadyRecv = i.receivedQuantity || 0;
                            const remaining = Math.max(0, ordered - alreadyRecv);

                            return {
                                rawMaterial: rmId,
                                name: rmName,
                                code: rmCode,
                                orderedQuantity: ordered,
                                alreadyReceivedQuantity: alreadyRecv,
                                remainingAllowed: remaining,
                                receivedQuantity: remaining,
                                batchNumber: ''
                            };
                        })
                    );
                })
                .finally(() => {
                    setIsLoadingLocs(false);
                });
        } else {
            setActivePoDetails(null);
            setGrnItems([]);
            setInwardRolls([
                { rollNo: '', length: '', width: '', grossWeight: '', netWeight: '', qtyKgs: '', qtyPcs: '' }
            ]);
        }
    }, [isOpen, po?._id]);

    const handleItemChange = (index, field, value) => {
        setGrnItems((prev) => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const activePo = activePoDetails || po;
        const targetPoId = activePo?._id || po?._id;

        if (!targetPoId) {
            toast.error('Invalid Purchase Order selected.');
            return;
        }

        // Safety Check: ensure payload PO ID matches currently displayed PO prop ID
        if (po?._id && String(targetPoId) !== String(po._id)) {
            toast.error(`PO ID mismatch: Active PO (${targetPoId}) does not match panel header (${po._id}). Please re-open the panel.`);
            return;
        }

        if (!receivingLocation) {
            toast.error('Please select a Receiving Location');
            return;
        }

        const validItems = [];
        for (let idx = 0; idx < grnItems.length; idx++) {
            const item = grnItems[idx];
            const numRecv = Number(item.receivedQuantity);

            if (isNaN(numRecv) || numRecv < 0) {
                toast.error(`Invalid received quantity for ${item.name}`);
                return;
            }

            if (numRecv > item.remainingAllowed) {
                toast.error(`Cannot receive ${numRecv} for ${item.name}. Remaining balance allowed is ${item.remainingAllowed}.`);
                return;
            }

            if (numRecv > 0) {
                validItems.push({
                    rawMaterial: item.rawMaterial,
                    receivedQuantity: numRecv,
                    batchNumber: item.batchNumber.trim() || undefined
                });
            }
        }

        if (validItems.length === 0) {
            toast.error('Please enter received quantity (> 0) for at least one item');
            return;
        }

        // Validate Packing Slip & Roll Specifications - Mandatory
        if (!inwardRolls || inwardRolls.length === 0) {
            toast.error('At least one Roll Specification is required. Please fill in the packing slip roll details.');
            return;
        }

        const validRolls = [];
        for (let rIdx = 0; rIdx < inwardRolls.length; rIdx++) {
            const r = inwardRolls[rIdx];
            const rollNumberVal = (r.rollNumber || r.rollNo || '').trim();
            if (!rollNumberVal) {
                toast.error(`Roll Number is required for Roll #${rIdx + 1}.`);
                return;
            }

            const gw = Number(r.grossWeight);
            const nw = Number(r.netWeight);
            if (!isNaN(gw) && !isNaN(nw) && gw > 0 && nw > gw) {
                toast.error(`Roll #${rIdx + 1}: Net Weight (${nw} kg) cannot exceed Gross Weight (${gw} kg).`);
                return;
            }

            const lenVal = (r.fabricLength !== undefined && r.fabricLength !== '' && r.fabricLength !== null)
                ? Number(r.fabricLength)
                : ((r.length !== undefined && r.length !== '' && r.length !== null) ? Number(r.length) : null);

            const kgVal = (r.totalQuantityKg !== undefined && r.totalQuantityKg !== '' && r.totalQuantityKg !== null)
                ? Number(r.totalQuantityKg)
                : ((r.qtyKgs !== undefined && r.qtyKgs !== '' && r.qtyKgs !== null) ? Number(r.qtyKgs) : null);

            const pcsVal = (r.totalQuantityPcs !== undefined && r.totalQuantityPcs !== '' && r.totalQuantityPcs !== null)
                ? Number(r.totalQuantityPcs)
                : ((r.qtyPcs !== undefined && r.qtyPcs !== '' && r.qtyPcs !== null) ? Number(r.qtyPcs) : null);

            validRolls.push({
                rollNumber: rollNumberVal,
                rollNo: rollNumberVal,
                fabricLength: lenVal,
                length: lenVal,
                width: r.width !== '' && r.width !== null && r.width !== undefined ? Number(r.width) : null,
                grossWeight: r.grossWeight !== '' && r.grossWeight !== null && r.grossWeight !== undefined ? Number(r.grossWeight) : null,
                netWeight: r.netWeight !== '' && r.netWeight !== null && r.netWeight !== undefined ? Number(r.netWeight) : null,
                totalQuantityKg: kgVal,
                qtyKgs: kgVal,
                totalQuantityPcs: pcsVal,
                qtyPcs: pcsVal
            });
        }

        if (validRolls.length === 0) {
            toast.error('Please enter at least one roll with a valid Roll Number.');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                purchaseOrder: targetPoId,
                receivingLocation,
                notes: notes.trim() || undefined,
                items: validItems,
                rolls: validRolls
            };

            const res = await axiosInstance.post('/grns', payload);

            if (res.data?.success) {
                toast.success(`GRN ${res.data.data?.grnNumber || ''} created & stock inwarded!`);
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error creating GRN:', err);
            toast.error(err.response?.data?.message || 'Failed to create GRN');
        } finally {
            setIsSubmitting(false);
        }
    };

    const activePo = activePoDetails || po;
    if (!activePo) return null;

    const supplierName = typeof activePo.supplier === 'object' ? (activePo.supplier?.companyName || activePo.supplier?.name) : 'Supplier';

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="Create Goods Receipt Note (GRN)"
            subtitle={`Inward raw materials to inventory for Purchase Order ${activePo?.poNumber || ''}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
                {/* Locked PO Summary Card */}
                <div className="bg-app-bg border border-border rounded-lg p-3 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] font-extrabold uppercase text-text-muted">PURCHASE ORDER</span>
                        <span className="font-mono font-bold text-primary">{activePo?.poNumber || ''}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted">Supplier:</span>
                        <span className="font-semibold text-text-main">{supplierName}</span>
                    </div>
                </div>

                {/* Receiving Location Selection */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Receiving Location / Warehouse *
                    </label>
                    {isLoadingLocs ? (
                        <div className="flex items-center gap-2 p-2.5 border border-border rounded-md text-xs text-text-muted">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                            <span>Loading locations...</span>
                        </div>
                    ) : (
                        <select
                            required
                            value={receivingLocation}
                            onChange={(e) => setReceivingLocation(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">-- Select Receiving Location --</option>
                            {locations.map((loc) => (
                                <option key={loc._id} value={loc._id}>
                                    {loc.code ? `${loc.code} - ` : ''}{loc.name} ({loc.type || 'Warehouse'})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Received Items List */}
                <div className="space-y-3 pt-2 border-t border-border">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                        Inward Items & Quantities Received *
                    </label>

                    <div className="space-y-2.5">
                        {grnItems.map((item, idx) => (
                            <div key={idx} className="bg-app-bg border border-border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-text-main block">{item.name}</span>
                                        <span className="text-[10px] font-mono text-text-muted">{item.code}</span>
                                    </div>
                                    <div className="text-right text-[10px]">
                                        <span className="text-text-muted block">
                                            Ordered: <strong>{item.orderedQuantity}</strong> | Recv: <strong>{item.alreadyReceivedQuantity}</strong>
                                        </span>
                                        <span className="text-emerald-700 font-bold block">
                                            Remaining: {item.remainingAllowed}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                            Received Qty (This GRN) *
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={item.remainingAllowed}
                                            required
                                            value={item.receivedQuantity}
                                            onChange={(e) => handleItemChange(idx, 'receivedQuantity', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-emerald-800 focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                            Batch / Lot Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. LOT-2026-X"
                                            value={item.batchNumber}
                                            onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Packing Slip & Roll Specifications (Multi-Roll Repeatable Section) */}
                <PackingSlipRollsSection
                    rolls={rolls}
                    onChange={setRolls}
                    title="Packing Slip & Roll Specifications"
                    subtitle="Record multiple rolls inwarded with this purchase"
                    required={true}
                />

                {/* Inward Notes */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Inward Notes / Remarks
                    </label>
                    <textarea
                        rows={2}
                        placeholder="e.g. Inspected on delivery truck, no moisture damage observed..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                </div>

                {/* Submit Actions */}
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
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <Truck size={15} />
                        <span>{isSubmitting ? 'Inwarding GRN Stock...' : 'Confirm & Create GRN'}</span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
