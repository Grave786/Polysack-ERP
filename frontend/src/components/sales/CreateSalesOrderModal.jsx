import { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingCart, Calculator, Calendar, User, MapPin, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CreateSalesOrderModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const isEditMode = Boolean(initialData && initialData._id);

    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [locations, setLocations] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [deliveryDue, setDeliveryDue] = useState(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [dispatchLocation, setDispatchLocation] = useState('');
    const [status, setStatus] = useState('CONFIRMED');
    const [notes, setNotes] = useState('');

    // Line Items State
    const [items, setItems] = useState([
        { finishedGood: '', quantity: '', ratePerUnit: '', subtotal: 0 }
    ]);

    // Quick Inline Customer Creation State
    const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
    const [quickCustomerForm, setQuickCustomerForm] = useState({
        companyName: '',
        contactPerson: '',
        phone: '',
        gstin: '',
        city: '',
        state: 'Gujarat'
    });
    const [isSavingCustomer, setIsSavingCustomer] = useState(false);

    // Load Dropdowns
    useEffect(() => {
        if (!isOpen) return;

        const loadDropdowns = async () => {
            try {
                setIsLoadingDropdowns(true);
                const [custRes, fgRes, locRes] = await Promise.all([
                    axiosInstance.get('/customers?isActive=true&limit=100'),
                    axiosInstance.get('/finished-goods?isActive=true&limit=100'),
                    axiosInstance.get('/locations?isActive=true&limit=50')
                ]);

                if (custRes.data?.success) {
                    setCustomers(custRes.data.data || []);
                }
                if (fgRes.data?.success) {
                    setFinishedGoods(fgRes.data.data || []);
                }
                if (locRes.data?.success) {
                    setLocations(locRes.data.data || []);
                }
            } catch (err) {
                console.error('Failed to load Sales Order form options:', err);
                toast.error('Failed to load customers or products catalog.');
            } finally {
                setIsLoadingDropdowns(false);
            }
        };

        loadDropdowns();
    }, [isOpen]);

    // Populate Initial Data on Edit Mode
    useEffect(() => {
        if (isOpen && isEditMode && initialData) {
            const custId = typeof initialData.customer === 'object' ? initialData.customer?._id : initialData.customer;
            setCustomerId(custId || '');
            setOrderDate(
                initialData.orderDate ? new Date(initialData.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            );
            setDeliveryDue(
                initialData.deliveryDue ? new Date(initialData.deliveryDue).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            );
            const locId = typeof initialData.dispatchLocation === 'object' ? initialData.dispatchLocation?._id : initialData.dispatchLocation;
            setDispatchLocation(locId || '');
            setStatus(initialData.status || 'CONFIRMED');
            setNotes(initialData.notes || '');

            if (Array.isArray(initialData.items) && initialData.items.length > 0) {
                setItems(
                    initialData.items.map((it) => {
                        const fgId = typeof it.finishedGood === 'object' ? it.finishedGood?._id : it.finishedGood;
                        const qty = Number(it.quantity || 0);
                        const rate = Number(it.ratePerUnit || 0);
                        return {
                            finishedGood: fgId || '',
                            quantity: qty > 0 ? String(qty) : '',
                            ratePerUnit: rate >= 0 ? String(rate) : '',
                            subtotal: qty * rate
                        };
                    })
                );
            }
        } else if (isOpen && !isEditMode) {
            // Reset for new Sales Order
            setCustomerId('');
            setOrderDate(new Date().toISOString().split('T')[0]);
            setDeliveryDue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setDispatchLocation('');
            setStatus('CONFIRMED');
            setNotes('');
            setItems([{ finishedGood: '', quantity: '', ratePerUnit: '', subtotal: 0 }]);
        }
    }, [isOpen, isEditMode, initialData]);

    // Handle Item Field Changes
    const handleItemChange = (index, field, value) => {
        setItems((prevItems) => {
            const updated = [...prevItems];
            const currentItem = { ...updated[index], [field]: value };

            // When Finished Good selection changes, auto-fill unit price from master catalog
            if (field === 'finishedGood') {
                const fg = finishedGoods.find((f) => f._id === value);
                if (fg && (currentItem.ratePerUnit === '' || Number(currentItem.ratePerUnit) === 0)) {
                    const defaultRate = fg.pricePerBag || fg.pricePerUnit || fg.sellingPrice || 15;
                    currentItem.ratePerUnit = String(defaultRate);
                }
            }

            const qty = Number(currentItem.quantity) || 0;
            const rate = Number(currentItem.ratePerUnit) || 0;
            currentItem.subtotal = qty * rate;

            updated[index] = currentItem;
            return updated;
        });
    };

    // Add New Line Item Row
    const handleAddItem = () => {
        setItems((prev) => [...prev, { finishedGood: '', quantity: '', ratePerUnit: '', subtotal: 0 }]);
    };

    // Remove Line Item Row
    const handleRemoveItem = (index) => {
        if (items.length <= 1) {
            toast.error('Sales Order must contain at least one line item.');
            return;
        }
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Live Calculation
    const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const subtotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    const gstRate = 18; // Standard 18% GST for Woven Poly Bags
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const grandTotal = subtotal + gstAmount;

    const isFormValid =
        customerId &&
        deliveryDue &&
        items.length > 0 &&
        items.every(
            (it) => it.finishedGood && Number(it.quantity) > 0 && Number(it.ratePerUnit) >= 0
        );

    // Save Sales Order
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            toast.error('Please complete all required fields and valid line items.');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                customer: customerId,
                orderDate,
                deliveryDue,
                dispatchLocation: dispatchLocation || undefined,
                status,
                notes: notes.trim() || undefined,
                items: items.map((it) => ({
                    finishedGood: it.finishedGood,
                    quantity: Number(it.quantity),
                    ratePerUnit: Number(it.ratePerUnit)
                }))
            };

            let res;
            if (isEditMode) {
                res = await axiosInstance.put(`/sales-orders/${initialData._id}`, payload);
            } else {
                res = await axiosInstance.post('/sales-orders', payload);
            }

            if (res.data?.success) {
                const soNum = res.data.data?.soNumber || (isEditMode ? initialData.soNumber : 'Sales Order');
                toast.success(
                    isEditMode
                        ? `Sales Order ${soNum} updated successfully!`
                        : `Sales Order ${soNum} booked successfully!`
                );
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error saving sales order:', err);
            toast.error(err.response?.data?.message || 'Failed to save Sales Order');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Quick Add Customer Handler
    const handleSaveQuickCustomer = async (e) => {
        e.preventDefault();
        if (!quickCustomerForm.companyName.trim()) {
            toast.error('Company / Customer name is required');
            return;
        }

        try {
            setIsSavingCustomer(true);
            const res = await axiosInstance.post('/customers', {
                companyName: quickCustomerForm.companyName.trim(),
                contactPerson: quickCustomerForm.contactPerson.trim() || undefined,
                phone: quickCustomerForm.phone.trim() || undefined,
                gstin: quickCustomerForm.gstin.trim().toUpperCase() || undefined,
                city: quickCustomerForm.city.trim() || undefined,
                state: quickCustomerForm.state || 'Gujarat'
            });

            if (res.data?.success && res.data.data) {
                const newCust = res.data.data;
                toast.success(`Customer '${newCust.companyName}' added!`);
                setCustomers((prev) => [newCust, ...prev]);
                setCustomerId(newCust._id);
                setIsQuickCustomerOpen(false);
                setQuickCustomerForm({
                    companyName: '',
                    contactPerson: '',
                    phone: '',
                    gstin: '',
                    city: '',
                    state: 'Gujarat'
                });
            }
        } catch (err) {
            console.error('Error creating customer:', err);
            toast.error(err.response?.data?.message || 'Failed to add customer');
        } finally {
            setIsSavingCustomer(false);
        }
    };

    const selectedCustomerObj = customers.find((c) => c._id === customerId);

    const footerButtons = (
        <div className="flex items-center justify-between w-full">
            <div className="text-xs font-mono font-bold text-text-main">
                Grand Total: <span className="text-primary text-sm">₹{grandTotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="sales-order-form"
                    disabled={!isFormValid || isSubmitting}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                    <ShoppingCart size={14} />
                    <span>{isSubmitting ? 'Saving Sales Order...' : isEditMode ? 'Update Sales Order' : 'Confirm Sales Order'}</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            <SlideOverPanel
                isOpen={isOpen}
                onClose={onClose}
                title={isEditMode ? `Edit Sales Order: ${initialData.soNumber || ''}` : 'Create Customer Sales Order'}
                subtitle="Book Finished Bag Orders, Custom Specs, Pricing & Scheduled Delivery Dues"
                widthClass="w-full max-w-full sm:max-w-2xl"
                footer={footerButtons}
            >
                <form id="sales-order-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                    {/* Customer Selection Card */}
                    <div className="bg-card-bg border border-border rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                                <User size={13} className="text-primary" />
                                <span>Customer / Buyer Details *</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsQuickCustomerOpen(true)}
                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={13} />
                                <span>+ New Customer</span>
                            </button>
                        </div>

                        <select
                            required
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            disabled={isLoadingDropdowns}
                            className="w-full border border-border rounded-lg p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                        >
                            <option value="" disabled>
                                {isLoadingDropdowns ? 'Loading Customers catalog...' : '-- Select Customer / Buyer --'}
                            </option>
                            {customers.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.companyName || c.name} {c.code ? `(${c.code})` : ''} {c.gstin ? `— GSTIN: ${c.gstin}` : ''}
                                </option>
                            ))}
                        </select>

                        {selectedCustomerObj && (
                            <div className="bg-app-bg/80 border border-border/70 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                                <div>
                                    <span className="font-semibold text-text-main">Contact:</span>{' '}
                                    {selectedCustomerObj.contactPerson || 'N/A'} ({selectedCustomerObj.phone || 'No phone'})
                                </div>
                                <div>
                                    <span className="font-semibold text-text-main">GSTIN:</span>{' '}
                                    <span className="font-mono">{selectedCustomerObj.gstin || 'Unregistered'}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-text-main">State:</span>{' '}
                                    {selectedCustomerObj.state || 'Gujarat'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Dates & Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1">
                                <Calendar size={12} className="text-text-muted" />
                                <span>Order Date *</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1">
                                <Calendar size={12} className="text-primary" />
                                <span>Delivery Due Date *</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={deliveryDue}
                                onChange={(e) => setDeliveryDue(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1">
                                <MapPin size={12} className="text-text-muted" />
                                <span>Dispatch Dock</span>
                            </label>
                            <select
                                value={dispatchLocation}
                                onChange={(e) => setDispatchLocation(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="">-- Optional Location --</option>
                                {locations.map((loc) => (
                                    <option key={loc._id} value={loc._id}>
                                        {loc.name} ({loc.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="bg-card-bg border border-border rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <span className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                                <ShoppingCart size={14} className="text-primary" />
                                <span>Finished Bag Line Items *</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-md text-[11px] transition-colors cursor-pointer"
                            >
                                <Plus size={13} />
                                <span>Add Product Row</span>
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {items.map((item, index) => {
                                const selectedFg = finishedGoods.find((f) => f._id === item.finishedGood);
                                return (
                                    <div
                                        key={index}
                                        className="grid grid-cols-12 gap-2 items-center bg-app-bg p-2.5 border border-border/70 rounded-lg"
                                    >
                                        <div className="col-span-12 sm:col-span-5">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Finished Bag Specification *
                                            </label>
                                            <select
                                                required
                                                value={item.finishedGood}
                                                onChange={(e) => handleItemChange(index, 'finishedGood', e.target.value)}
                                                className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                                            >
                                                <option value="" disabled>-- Select Bag Product --</option>
                                                {finishedGoods.map((fg) => (
                                                    <option key={fg._id} value={fg._id}>
                                                        {fg.code || 'FG'} - {fg.name} (Stock: {fg.currentStock || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-span-5 sm:col-span-3">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Order Qty (Bags) *
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder="e.g. 5000"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                                            />
                                        </div>

                                        <div className="col-span-4 sm:col-span-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Rate (₹/Bag) *
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step="0.01"
                                                placeholder="₹"
                                                value={item.ratePerUnit}
                                                onChange={(e) => handleItemChange(index, 'ratePerUnit', e.target.value)}
                                                className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                                            />
                                        </div>

                                        <div className="col-span-3 sm:col-span-2 flex items-center justify-between pt-3 sm:pt-0">
                                            <div className="text-right flex-1 pr-1">
                                                <span className="block text-[9px] text-text-muted uppercase font-bold">Total</span>
                                                <span className="font-mono font-extrabold text-xs text-text-main">
                                                    ₹{(item.subtotal || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="p-1 text-text-muted hover:text-rose-600 transition-colors cursor-pointer"
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Financial Summary */}
                        <div className="bg-app-bg/80 border border-border/80 rounded-lg p-3 space-y-1.5 font-sans">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted font-medium">Total Quantity:</span>
                                <span className="font-mono font-bold text-text-main">{totalQuantity.toLocaleString()} Bags</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted font-medium">Taxable Subtotal:</span>
                                <span className="font-mono font-bold text-text-main">₹{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted font-medium">Estimated GST (18%):</span>
                                <span className="font-mono font-bold text-text-main">₹{gstAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs pt-1 border-t border-border/70">
                                <span className="font-bold text-text-main">Estimated Grand Total:</span>
                                <span className="font-mono font-extrabold text-sm text-primary">₹{grandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Order Workflow Status & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Workflow Status *
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value="CONFIRMED">CONFIRMED (Ready for Production)</option>
                                <option value="DRAFT">DRAFT (Quotation / Proposal)</option>
                                {isEditMode && <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>}
                                {isEditMode && <option value="DISPATCHED">DISPATCHED</option>}
                                {isEditMode && <option value="CANCELLED">CANCELLED</option>}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Special Delivery Instructions / Notes
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Standard 50kg BOPP Laminated Poly Bags with Handle"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                </form>
            </SlideOverPanel>

            {/* Quick Add Customer Modal */}
            {isQuickCustomerOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-border">
                            <h3 className="font-bold text-sm text-text-main">Quick Register Customer</h3>
                            <button
                                type="button"
                                onClick={() => setIsQuickCustomerOpen(false)}
                                className="text-text-muted hover:text-text-main text-xs font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuickCustomer} className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Company / Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Shree Ram Agrochem Ltd"
                                    value={quickCustomerForm.companyName}
                                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, companyName: e.target.value })}
                                    className="w-full border border-border rounded p-2 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Mr. Rajesh Patel"
                                        value={quickCustomerForm.contactPerson}
                                        onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, contactPerson: e.target.value })}
                                        className="w-full border border-border rounded p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. +91 98765 43210"
                                        value={quickCustomerForm.phone}
                                        onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                                        className="w-full border border-border rounded p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-text-main mb-1">GSTIN (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="24AAAAA0000A1Z5"
                                        value={quickCustomerForm.gstin}
                                        onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, gstin: e.target.value.toUpperCase() })}
                                        className="w-full border border-border rounded p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-text-main mb-1">City</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ahmedabad"
                                        value={quickCustomerForm.city}
                                        onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, city: e.target.value })}
                                        className="w-full border border-border rounded p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickCustomerOpen(false)}
                                    className="px-3 py-1.5 border border-border rounded text-text-muted hover:text-text-main font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingCustomer}
                                    className="px-4 py-1.5 bg-primary text-sidebar-bg font-bold rounded hover:bg-primary-hover disabled:opacity-50"
                                >
                                    {isSavingCustomer ? 'Saving...' : 'Add Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
