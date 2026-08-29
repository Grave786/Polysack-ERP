import { useState, useEffect } from 'react';
import { Sliders, RefreshCw, CheckCircle2 } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function StockAdjustmentPanel({ isOpen, onClose, onSuccess }) {
    const [itemType, setItemType] = useState('RAW_MATERIAL'); // 'RAW_MATERIAL' | 'FINISHED_GOOD'
    const [itemsList, setItemsList] = useState([]);
    const [selectedItem, setSelectedItem] = useState('');
    const [enteredQuantity, setEnteredQuantity] = useState('');
    const [notes, setNotes] = useState('');

    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch items list based on selected itemType
    useEffect(() => {
        if (!isOpen) return;

        setIsLoadingItems(true);
        setSelectedItem('');
        const endpoint = itemType === 'RAW_MATERIAL' ? '/raw-materials?isActive=true&limit=200' : '/finished-goods?isActive=true&limit=200';

        axiosInstance.get(endpoint)
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setItemsList(list);
                    if (list.length > 0) {
                        setSelectedItem(list[0]._id);
                    }
                }
            })
            .catch((err) => {
                console.error('Error fetching inventory items for stock adjustment:', err);
                toast.error('Failed to load inventory items');
            })
            .finally(() => {
                setIsLoadingItems(false);
            });
    }, [isOpen, itemType]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedItem) {
            toast.error('Please select an inventory item');
            return;
        }

        const numQty = Number(enteredQuantity);
        if (isNaN(numQty) || numQty === 0) {
            toast.error('Please enter a valid non-zero adjustment quantity');
            return;
        }

        if (!notes.trim()) {
            toast.error('Reason / Notes are required for stock adjustments');
            return;
        }

        try {
            setIsSubmitting(true);

            // Positive -> ADJUSTMENT (stock increase); Negative -> STOCK_OUT (stock decrease)
            const transactionType = numQty > 0 ? 'ADJUSTMENT' : 'STOCK_OUT';
            const absoluteQuantity = Math.abs(numQty);

            const payload = {
                referenceNumber: `ADJ-${Date.now().toString().slice(-6)}`,
                itemType,
                item: selectedItem,
                transactionType,
                quantity: absoluteQuantity,
                notes: notes.trim()
            };

            const res = await axiosInstance.post('/stock-transactions', payload);

            if (res.data?.success) {
                toast.success(`Stock adjustment recorded (${numQty > 0 ? `+${numQty}` : numQty})!`);
                setEnteredQuantity('');
                setNotes('');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('Error recording stock adjustment:', err);
            toast.error(err.response?.data?.message || 'Failed to record stock adjustment');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SlideOverPanel
            isOpen={isOpen}
            onClose={onClose}
            title="Manual Stock Adjustment"
            subtitle="Adjust stock counts or record manual inventory issues with audit log tracking"
        >
            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
                {/* Item Type Selector */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Item Type *
                    </label>
                    <select
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value)}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
                    >
                        <option value="RAW_MATERIAL">Raw Material</option>
                        <option value="FINISHED_GOOD">Finished Bag Specification</option>
                    </select>
                </div>

                {/* Select Item */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Select Inventory Item *
                    </label>
                    {isLoadingItems ? (
                        <div className="flex items-center gap-2 text-xs text-text-muted p-2.5 border border-border rounded-md">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                            <span>Loading {itemType === 'RAW_MATERIAL' ? 'Raw Materials' : 'Finished Goods'}...</span>
                        </div>
                    ) : (
                        <select
                            required
                            value={selectedItem}
                            onChange={(e) => setSelectedItem(e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-semibold focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">-- Select Item --</option>
                            {itemsList.map((item) => (
                                <option key={item._id} value={item._id}>
                                    {item.code || 'ITEM'} - {item.name} ({item.currentStock || 0} in stock)
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Adjustment Quantity Input */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Adjustment Quantity *
                    </label>
                    <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. +50 to increase or -20 to decrease"
                        value={enteredQuantity}
                        onChange={(e) => setEnteredQuantity(e.target.value)}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                    />
                    <span className="block text-[11px] text-text-muted mt-1">
                        Enter a <strong>positive number</strong> (e.g. <code>+50</code>) to add stock, or a <strong>negative number</strong> (e.g. <code>-20</code>) to deduct stock.
                    </span>
                </div>

                {/* Reason / Notes */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Reason / Notes *
                    </label>
                    <textarea
                        rows={3}
                        required
                        placeholder="e.g. Physical audit count discrepancy, damaged material scrap, manual stock intake..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                </div>

                {/* Actions */}
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
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <CheckCircle2 size={15} />
                        <span>{isSubmitting ? 'Recording Adjustment...' : 'Record Adjustment'}</span>
                    </button>
                </div>
            </form>
        </SlideOverPanel>
    );
}
