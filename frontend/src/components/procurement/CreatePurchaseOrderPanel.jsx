import { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingBag, RefreshCw, Send } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreatePurchaseOrderPanel({ isOpen, onClose, onSuccess }) {
    const [suppliers, setSuppliers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);

    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form fields
    const [supplier, setSupplier] = useState('');
    const [expectedDelivery, setExpectedDelivery] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [sendImmediately, setSendImmediately] = useState(false);

    // Repeatable items array
    const [items, setItems] = useState([
        { rawMaterial: '', orderedQuantity: 100, ratePerUnit: 0 }
    ]);

    // Fetch prerequisite options (suppliers, locations, raw materials)
    useEffect(() => {
        if (!isOpen) return;

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
                    if (sups.length > 0) setSupplier(sups[0]._id);
                }
                if (locRes.data?.success) {
                    const locs = locRes.data.data || [];
                    setLocations(locs);
                    if (locs.length > 0) setDeliveryLocation(locs[0]._id);
                }
                if (rmRes.data?.success) {
                    const rms = rmRes.data.data || [];
                    setRawMaterials(rms);
                    if (rms.length > 0 && items.length > 0 && !items[0].rawMaterial) {
                        setItems([
                            { rawMaterial: rms[0]._id, orderedQuantity: 100, ratePerUnit: rms[0].pricePerUnit || 0 }
                        ]);
                    }
                }
            })
            .catch((err) => {
                console.error('Error fetching procurement options:', err);
                toast.error('Failed to load supplier & raw material lists');
            })
            .finally(() => {
                setIsLoadingData(false);
            });
    }, [isOpen]);

    // Item rows handlers
    const handleAddItemRow = () => {
        const defaultRm = rawMaterials.length > 0 ? rawMaterials[0]._id : '';
        const defaultRate = rawMaterials.length > 0 ? (rawMaterials[0].pricePerUnit || 0) : 0;
        setItems((prev) => [...prev, { rawMaterial: defaultRm, orderedQuantity: 100, ratePerUnit: defaultRate }]);
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

    const handleSubmit = async (e) => {
        e.preventDefault();

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

        try {
            setIsSubmitting(true);

            const payload = {
                supplier,
                expectedDelivery,
                deliveryLocation: deliveryLocation || undefined,
                notes: notes.trim() || undefined,
                status: sendImmediately ? 'SENT_TO_SUPPLIER' : 'DRAFT',
                items: items.map((i) => ({
                    rawMaterial: i.rawMaterial,
                    orderedQuantity: Number(i.orderedQuantity),
                    ratePerUnit: Number(i.ratePerUnit)
                }))
            };

            const res = await axiosInstance.post('/purchase-orders', payload);

            if (res.data?.success) {
                toast.success(`Purchase Order ${res.data.data?.poNumber || ''} created successfully!`);
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error creating Purchase Order:', err);
            toast.error(err.response?.data?.message || 'Failed to create Purchase Order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="Issue New Purchase Order"
            subtitle="Create raw material purchase order for suppliers"
        >
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
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
                        <select
                            required
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">-- Select Supplier --</option>
                            {suppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                    {s.companyName || s.name} ({s.contactPersonName || 'Supplier'})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Expected Delivery & Delivery Location */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Expected Delivery Date *
                        </label>
                        <input
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={expectedDelivery}
                            onChange={(e) => setExpectedDelivery(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Delivery Location
                        </label>
                        <select
                            value={deliveryLocation}
                            onChange={(e) => setDeliveryLocation(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">-- Select Location --</option>
                            {locations.map((loc) => (
                                <option key={loc._id} value={loc._id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
                    </div>
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
                                    <select
                                        required
                                        value={item.rawMaterial}
                                        onChange={(e) => handleItemChange(idx, 'rawMaterial', e.target.value)}
                                        className="w-full border border-border rounded p-1.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer"
                                    >
                                        <option value="">-- Select Material --</option>
                                        {rawMaterials.map((rm) => (
                                            <option key={rm._id} value={rm._id}>
                                                {rm.code} - {rm.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-text-muted mb-0.5">
                                            Ordered Qty *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={item.orderedQuantity}
                                            onChange={(e) => handleItemChange(idx, 'orderedQuantity', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                                        />
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

                {/* Total PO Value Live Banner */}
                <div className="bg-app-bg border border-border rounded-lg p-3 flex items-center justify-between font-mono font-bold">
                    <span className="text-xs text-text-muted font-sans font-bold uppercase">Estimated Total PO Value:</span>
                    <span className="text-sm text-primary">₹{computedTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>

                {/* Send Immediately Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                    <input
                        type="checkbox"
                        id="sendImmediately"
                        checked={sendImmediately}
                        onChange={(e) => setSendImmediately(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="sendImmediately" className="text-xs font-semibold text-text-main cursor-pointer">
                        Send to supplier immediately (sets status to 'Sent to Supplier')
                    </label>
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
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <ShoppingBag size={15} />
                        <span>{isSubmitting ? 'Issuing PO...' : 'Issue Purchase Order'}</span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
