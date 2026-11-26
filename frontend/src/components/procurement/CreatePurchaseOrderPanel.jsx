import { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingBag, RefreshCw, Send } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import SearchableSelect from '../shared/SearchableSelect';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { getTodayLocalDateString, getFutureLocalDateString } from '../../utils/dateUtils';
import { computeDocumentTotals } from '../../utils/chargesHelper';
import ChargesAndAdjustmentsSection from '../shared/ChargesAndAdjustmentsSection';

export default function CreatePurchaseOrderPanel({ isOpen, onClose, onSuccess, editPo }) {
    const [suppliers, setSuppliers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);

    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form fields
    const [supplier, setSupplier] = useState('');
    const [poDate, setPoDate] = useState(getTodayLocalDateString());
    const [expectedDelivery, setExpectedDelivery] = useState(getFutureLocalDateString(7));
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [gstTreatment, setGstTreatment] = useState('TAXABLE');
    const [gstRate, setGstRate] = useState(18);
    const [charges, setCharges] = useState({
        discountType: 'FIXED',
        discountValue: '',
        freightAmount: '',
        insuranceAmount: '',
        otherChargesAmount: '',
        otherChargesLabel: '',
        autoRoundOff: true
    });

    // Repeatable items array
    const [items, setItems] = useState([
        { rawMaterial: '', orderedQuantity: 100, ratePerUnit: 0, unit: 'Kg' }
    ]);

    // Fetch prerequisite options (suppliers, locations, raw materials) & populate edit data
    useEffect(() => {
        if (!isOpen) return;

        if (editPo) {
            const suppId = typeof editPo.supplier === 'object' ? editPo.supplier?._id : editPo.supplier;
            setSupplier(suppId || '');
            setPoDate(editPo.poDate ? new Date(editPo.poDate).toISOString().split('T')[0] : getTodayLocalDateString());
            setExpectedDelivery(editPo.expectedDelivery ? new Date(editPo.expectedDelivery).toISOString().split('T')[0] : getFutureLocalDateString(7));
            const locId = typeof editPo.deliveryLocation === 'object' ? editPo.deliveryLocation?._id : editPo.deliveryLocation;
            setDeliveryLocation(locId || '');
            setNotes(editPo.notes || '');
            setGstTreatment(editPo.gstTreatment === 'EXEMPT' ? 'EXEMPT' : 'TAXABLE');
            setGstRate(editPo.gstRate !== undefined ? Number(editPo.gstRate) : 18);
            setCharges({
                discountType: editPo.discountType || 'FIXED',
                discountValue: editPo.discountValue ? String(editPo.discountValue) : '',
                freightAmount: editPo.freightAmount ? String(editPo.freightAmount) : '',
                insuranceAmount: editPo.insuranceAmount ? String(editPo.insuranceAmount) : '',
                otherChargesAmount: editPo.otherChargesAmount ? String(editPo.otherChargesAmount) : '',
                otherChargesLabel: editPo.otherChargesLabel || '',
                autoRoundOff: editPo.autoRoundOff !== false
            });

            const rawItems = editPo.items || editPo.materials;
            if (Array.isArray(rawItems) && rawItems.length > 0) {
                setItems(
                    rawItems.map((it) => ({
                        rawMaterial: typeof it.rawMaterial === 'object' ? it.rawMaterial?._id : it.rawMaterial || '',
                        orderedQuantity: Number(it.orderedQuantity ?? it.quantity ?? 100),
                        ratePerUnit: Number(it.ratePerUnit ?? it.pricePerUnit ?? it.price ?? 0),
                        unit: it.unit || 'Kg'
                    }))
                );
            }
        } else {
            setPoDate(getTodayLocalDateString());
            setExpectedDelivery(getFutureLocalDateString(7));
            setNotes('');
            setGstTreatment('TAXABLE');
            setGstRate(18);
            setCharges({
                discountType: 'FIXED',
                discountValue: '',
                freightAmount: '',
                insuranceAmount: '',
                otherChargesAmount: '',
                otherChargesLabel: '',
                autoRoundOff: true
            });
        }

        setIsLoadingData(true);
        Promise.all([
            axiosInstance.get('/suppliers?isActive=true&limit=200'),
            axiosInstance.get('/locations?isActive=true&limit=200'),
            axiosInstance.get('/raw-materials?isActive=true&limit=200')
        ])
            .then(([supRes, locRes, rmRes]) => {
                if (supRes.data?.success) {
                    const sups = supRes.data.data || [];
                    setSuppliers(sups);
                    if (!editPo && sups.length > 0) setSupplier(sups[0]._id);
                }
                if (locRes.data?.success) {
                    const locs = locRes.data.data || [];
                    setLocations(locs);
                    if (!editPo && locs.length > 0) setDeliveryLocation(locs[0]._id);
                }
                if (rmRes.data?.success) {
                    const rms = rmRes.data.data || [];
                    setRawMaterials(rms);
                    if (!editPo && rms.length > 0 && items.length > 0 && !items[0].rawMaterial) {
                        setItems([
                            { rawMaterial: rms[0]._id, orderedQuantity: 100, ratePerUnit: rms[0].pricePerUnit || 0, unit: 'Kg' }
                        ]);
                    }
                }
            })
            .catch((err) => {
                console.error('Error fetching procurement options:', err);
                toast.error('Failed to load supplier & raw material lists');
            })
            .finally(() => setIsLoadingData(false));
    }, [isOpen, editPo]);

    // Handle Expected Delivery Date Change
    const handleExpectedDeliveryChange = (e) => {
        setExpectedDelivery(e.target.value);
    };

    // Item rows handlers
    const handleAddItemRow = () => {
        const defaultRm = rawMaterials.length > 0 ? rawMaterials[0]._id : '';
        const defaultRate = rawMaterials.length > 0 ? (rawMaterials[0].pricePerUnit || 0) : 0;
        setItems((prev) => [...prev, { rawMaterial: defaultRm, orderedQuantity: 100, ratePerUnit: defaultRate, unit: 'Kg' }]);
    };

    const handleRemoveItemRow = (index) => {
        if (items.length === 1) {
            toast.error('Purchase Order must contain at least one item');
            return;
        }
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        setItems((prev) => {
            const updated = [...prev];
            updated[index][field] = value;

            // If rawMaterial changed, auto-update default ratePerUnit
            if (field === 'rawMaterial') {
                const targetRm = rawMaterials.find((rm) => rm._id === value);
                if (targetRm && targetRm.pricePerUnit) {
                    updated[index].ratePerUnit = targetRm.pricePerUnit;
                }
            }
            return updated;
        });
    };

    // Total Live Value calculation
    const computedTotalValue = items.reduce((acc, item) => {
        const qty = Number(item.orderedQuantity) || 0;
        const rate = Number(item.ratePerUnit) || 0;
        return acc + (qty * rate);
    }, 0);

    const totalsCalc = computeDocumentTotals({
        itemsSubtotal: computedTotalValue,
        discountType: charges.discountType,
        discountValue: charges.discountValue,
        freightAmount: charges.freightAmount,
        insuranceAmount: charges.insuranceAmount,
        otherChargesAmount: charges.otherChargesAmount,
        otherChargesLabel: charges.otherChargesLabel,
        gstTreatment,
        gstRate,
        autoRoundOff: charges.autoRoundOff
    });

    // Group and sum quantities by unit separately
    const poTotalsByUnit = items.reduce((acc, item) => {
        const qty = Number(item.orderedQuantity) || 0;
        if (qty > 0) {
            const unit = item.unit || 'Kg';
            acc[unit] = (acc[unit] || 0) + qty;
        }
        return acc;
    }, {});
    const formattedPoQuantity = Object.entries(poTotalsByUnit).length > 0
        ? Object.entries(poTotalsByUnit)
            .map(([unit, q]) => `${q % 1 === 0 ? q.toLocaleString('en-IN') : Number(q.toFixed(3)).toLocaleString('en-IN')} ${unit}`)
            .join(', ')
        : '0 Kg';

    const submitOrder = async (targetStatus = 'PENDING_APPROVAL') => {
        if (!supplier) {
            toast.error('Please select a Supplier');
            return;
        }

        if (!expectedDelivery) {
            toast.error('Please select an Expected Delivery date');
            return;
        }

        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.rawMaterial) {
                toast.error(`Please select raw material for item #${i + 1}`);
                return;
            }
            if (!item.orderedQuantity || Number(item.orderedQuantity) <= 0) {
                toast.error(`Item #${i + 1} ordered quantity must be greater than 0`);
                return;
            }
            if (item.ratePerUnit === undefined || Number(item.ratePerUnit) < 0) {
                toast.error(`Item #${i + 1} rate per unit must be non-negative`);
                return;
            }
        }

        if (totalsCalc.validationError) {
            toast.error(totalsCalc.validationError);
            return;
        }

        // Determine target status when editing existing PO
        let statusToSend = targetStatus;
        if (editPo?._id) {
            if (editPo.status === 'SENT_TO_SUPPLIER') {
                const confirmed = window.confirm(
                    'This PO was already sent to the supplier. Editing it may require re-communicating changes to them. Continue?'
                );
                if (!confirmed) return;
                statusToSend = 'SENT_TO_SUPPLIER';
            } else if (editPo.status === 'PENDING_APPROVAL') {
                statusToSend = 'PENDING_APPROVAL';
            }
        }

        try {
            setIsSubmitting(true);

            const payload = {
                supplier,
                poDate,
                expectedDelivery,
                deliveryLocation: deliveryLocation || undefined,
                notes: notes.trim() || undefined,
                status: statusToSend,
                gstTreatment,
                gstRate: gstTreatment === 'EXEMPT' ? 0 : Number(gstRate ?? 18),
                discountType: charges.discountType,
                discountValue: Number(charges.discountValue || 0),
                freightAmount: Number(charges.freightAmount || 0),
                insuranceAmount: Number(charges.insuranceAmount || 0),
                otherChargesAmount: Number(charges.otherChargesAmount || 0),
                otherChargesLabel: charges.otherChargesLabel.trim(),
                autoRoundOff: charges.autoRoundOff !== false,
                items: items.map((i) => ({
                    rawMaterial: i.rawMaterial,
                    orderedQuantity: Number(i.orderedQuantity),
                    ratePerUnit: Number(i.ratePerUnit),
                    unit: i.unit || 'Kg'
                }))
            };

            let res;
            if (editPo?._id) {
                res = await axiosInstance.put(`/purchase-orders/${editPo._id}`, payload);
            } else {
                res = await axiosInstance.post('/purchase-orders', payload);
            }

            if (res.data?.success) {
                const poNum = res.data.data?.poNumber || editPo?.poNumber || '';
                let actionMsg;
                if (editPo) {
                    if (editPo.status === 'SENT_TO_SUPPLIER') {
                        actionMsg = `Purchase Order ${poNum} updated successfully! Remember to notify the supplier.`;
                    } else if (editPo.status === 'PENDING_APPROVAL') {
                        actionMsg = `Pending Purchase Order ${poNum} updated successfully!`;
                    } else if (targetStatus === 'DRAFT') {
                        actionMsg = `Draft PO ${poNum} updated successfully!`;
                    } else {
                        actionMsg = `Purchase Order ${poNum} updated and submitted for approval!`;
                    }
                } else {
                    actionMsg = targetStatus === 'DRAFT'
                        ? `Purchase Order ${poNum} saved as Draft!`
                        : 'Sent for Tenant Admin approval';
                }
                toast.success(actionMsg);
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error saving Purchase Order:', err);
            toast.error(err.response?.data?.message || 'Failed to save Purchase Order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title={editPo ? `Edit Purchase Order (${editPo.poNumber || ''})` : "Create Purchase Order"}
            subtitle={editPo
                ? (editPo.status === 'SENT_TO_SUPPLIER'
                    ? "Correct PO details before delivery arrives (Sent to Supplier)"
                    : editPo.status === 'PENDING_APPROVAL'
                        ? "Correct PO details while awaiting Tenant Admin approval"
                        : "Modify draft purchase order details")
                : "Create purchase order for Tenant Admin approval"}
        >
            <form onSubmit={(e) => { e.preventDefault(); submitOrder(editPo?.status || 'PENDING_APPROVAL'); }} className="space-y-4 font-sans text-xs">
                {/* Supplier Selection */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Select Supplier *
                    </label>
                    {isLoadingData ? (
                        <div className="flex items-center gap-2 p-2 border border-border rounded-md text-xs text-text-muted">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                            <span>Loading suppliers & raw materials...</span>
                        </div>
                    ) : (
                        <SearchableSelect
                            required
                            value={supplier}
                            onChange={(val) => setSupplier(val)}
                            placeholder="-- Select Supplier --"
                            searchPlaceholder="Search supplier by code, name, or GSTIN..."
                            emptyMessage="No suppliers found"
                            options={suppliers.map((s) => ({
                                value: s._id,
                                code: s.code || s.supplierCode || 'SUPP',
                                label: s.companyName || s.name,
                                subLabel: [s.gstin ? `GSTIN: ${s.gstin}` : null, s.city].filter(Boolean).join(' • '),
                                searchText: `${s.code || s.supplierCode || ''} ${s.companyName || ''} ${s.name || ''} ${s.gstin || ''} ${s.city || ''}`
                            }))}
                        />
                    )}
                </div>

                {/* PO Date & Expected Delivery Date (Side-by-Side) */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            PO Date *
                        </label>
                        <input
                            type="date"
                            value={poDate}
                            onChange={(e) => setPoDate(e.target.value)}
                            className="border border-border rounded p-2 text-xs w-full bg-card-bg text-text-main font-mono font-bold focus:outline-none focus:border-primary cursor-pointer"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Expected Delivery Date *
                        </label>
                        <input
                            type="date"
                            required
                            value={expectedDelivery}
                            onChange={handleExpectedDeliveryChange}
                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        />
                    </div>
                </div>

                {/* Delivery Location (Full Width Below Dates) */}
                <div className="w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Delivery Location
                    </label>
                    <SearchableSelect
                        value={deliveryLocation}
                        onChange={(val) => setDeliveryLocation(val)}
                        placeholder="-- Select Location --"
                        searchPlaceholder="Search delivery location..."
                        emptyMessage="No locations found"
                        options={locations.map((loc) => ({
                            value: loc._id,
                            code: loc.code || '',
                            label: loc.name,
                            subLabel: loc.type || '',
                            searchText: `${loc.code || ''} ${loc.name || ''} ${loc.type || ''}`
                        }))}
                    />
                </div>

                {/* Repeatable Items Section */}
                <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                            Raw Material Items List ({items.length}) *
                        </label>
                        <button
                            type="button"
                            onClick={handleAddItemRow}
                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                            <Plus size={13} />
                            <span>+ Add Item</span>
                        </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {items.map((item, idx) => (
                            <div key={idx} className="bg-app-bg border border-border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-extrabold uppercase text-text-muted">
                                        ITEM #{idx + 1}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItemRow(idx)}
                                        className="text-text-muted hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                        Raw Material *
                                    </label>
                                    <SearchableSelect
                                        required
                                        value={item.rawMaterial}
                                        onChange={(val) => handleItemChange(idx, 'rawMaterial', val)}
                                        placeholder="-- Select Material --"
                                        searchPlaceholder="Search by RM code or material name..."
                                        emptyMessage="No raw materials found"
                                        options={rawMaterials.map((rm) => {
                                            const uomLabel = typeof rm.uom === 'object' ? (rm.uom?.symbol || rm.uom?.name || 'Kg') : (rm.uom || 'Kg');
                                            return {
                                                value: rm._id,
                                                code: rm.code || 'RM',
                                                label: rm.name,
                                                subLabel: `Stock: ${Number(rm.currentStock || 0).toLocaleString('en-IN')} ${uomLabel}`,
                                                searchText: `${rm.code || ''} ${rm.name || ''} ${rm.materialGrade || ''}`
                                            };
                                        })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                            Ordered Qty & Unit *
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0.001"
                                                required
                                                value={item.orderedQuantity}
                                                onChange={(e) => handleItemChange(idx, 'orderedQuantity', e.target.value)}
                                                className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                                            />
                                            <select
                                                value={item.unit || 'Kg'}
                                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                className="border border-border rounded p-1.5 bg-card-bg text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                                            >
                                                <option value="Kg">Kg</option>
                                                <option value="Roll">Roll</option>
                                                <option value="Bags">Bags</option>
                                                <option value="Pcs">Pcs</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                            Rate / Unit (₹) *
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            required
                                            value={item.ratePerUnit}
                                            onChange={(e) => handleItemChange(idx, 'ratePerUnit', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GST Treatment & Charges & Adjustments */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-text-muted mb-1">
                            GST Treatment
                        </label>
                        <select
                            value={gstTreatment}
                            onChange={(e) => setGstTreatment(e.target.value)}
                            className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="TAXABLE">Taxable (GST Applicable)</option>
                            <option value="EXEMPT">GST Exempt (0%)</option>
                        </select>
                    </div>
                    {gstTreatment !== 'EXEMPT' && (
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-text-muted mb-1">
                                GST Rate (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="28"
                                step="any"
                                value={gstRate}
                                onChange={(e) => setGstRate(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    )}
                </div>

                <ChargesAndAdjustmentsSection
                    charges={charges}
                    onChange={setCharges}
                    totals={totalsCalc}
                    disabled={isSubmitting}
                />

                {/* Total PO Value & Grouped Quantity Live Banner */}
                <div className="bg-app-bg border border-border rounded-lg p-3 space-y-1.5 font-sans">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-bold uppercase text-[10px]">Total Quantity:</span>
                        <span className="font-mono font-bold text-text-main">{formattedPoQuantity}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-medium">Items Subtotal:</span>
                        <span className="font-mono font-bold text-text-main">₹{totalsCalc.itemsSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    {totalsCalc.discountAmount > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-700">
                            <span className="font-medium">Less: Discount{totalsCalc.discountType === 'PERCENT' ? ` (${totalsCalc.discountValue}%)` : ''}:</span>
                            <span className="font-mono font-bold">-₹{totalsCalc.discountAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {totalsCalc.freightAmount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">Freight / Transport:</span>
                            <span className="font-mono font-semibold text-text-main">+₹{totalsCalc.freightAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {totalsCalc.insuranceAmount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">Insurance Charges:</span>
                            <span className="font-mono font-semibold text-text-main">+₹{totalsCalc.insuranceAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {totalsCalc.otherChargesAmount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">{totalsCalc.otherChargesLabel ? `Other (${totalsCalc.otherChargesLabel}):` : 'Other Charges:'}</span>
                            <span className="font-mono font-semibold text-text-main">+₹{totalsCalc.otherChargesAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                        <span className="text-text-muted font-semibold">Taxable Value:</span>
                        <span className="font-mono font-bold text-text-main">₹{totalsCalc.taxableValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-medium">{gstTreatment === 'EXEMPT' ? 'GST (Exempt):' : `GST (${totalsCalc.gstRate}%):`}</span>
                        <span className="font-mono font-bold text-text-main">₹{totalsCalc.taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    {totalsCalc.roundOff !== 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-medium">Round Off:</span>
                            <span className="font-mono font-semibold text-text-main">
                                {totalsCalc.roundOff > 0 ? `+₹${totalsCalc.roundOff.toFixed(2)}` : `-₹${Math.abs(totalsCalc.roundOff).toFixed(2)}`}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-border/70 font-mono font-bold">
                        <span className="text-text-muted font-sans text-xs uppercase">Estimated PO Grand Total:</span>
                        <span className="text-sm text-primary">₹{totalsCalc.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-3 border-t border-border flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    {(!editPo || editPo.status === 'DRAFT') && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => submitOrder('DRAFT')}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting
                                ? (editPo ? 'Updating Draft...' : 'Saving Draft...')
                                : (editPo ? 'Update Draft' : 'Save as Draft')}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <ShoppingBag size={15} />
                        <span>
                            {isSubmitting
                                ? (editPo ? 'Saving Changes...' : 'Submitting PO...')
                                : (editPo
                                    ? (editPo.status === 'SENT_TO_SUPPLIER'
                                        ? 'Save & Update Sent PO'
                                        : editPo.status === 'PENDING_APPROVAL'
                                            ? 'Update Pending PO'
                                            : 'Update & Submit for Approval')
                                    : 'Submit for Approval')}
                        </span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
