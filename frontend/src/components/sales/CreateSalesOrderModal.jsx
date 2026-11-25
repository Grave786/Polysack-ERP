import { useState, useEffect } from 'react';
import { Plus, Trash2, ShoppingCart, Calculator, Calendar, User, MapPin, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import SlideOverPanel from '../shared/SlideOverPanel';
import SearchableSelect from '../shared/SearchableSelect';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { getTodayLocalDateString, getFutureLocalDateString, formatToLocalDateString } from '../../utils/dateUtils';

// Allowed Sales Order Units (Always lists all 4 units)
const ALL_SO_UNITS = ['Pcs', 'Kg', 'Roll', 'Bags'];

// Normalize any legacy/case-variant unit to the canonical option
const normalizeSoUnit = (unitStr) => {
    if (!unitStr) return 'Pcs';
    const lower = String(unitStr).trim().toLowerCase();
    if (['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(lower)) return 'Kg';
    if (['roll', 'rolls', 'rl'].includes(lower)) return 'Roll';
    if (['bags', 'bag'].includes(lower)) return 'Bags';
    if (['pcs', 'pc', 'pieces', 'piece', 'nos', 'no', 'units', 'unit'].includes(lower)) return 'Pcs';
    return ALL_SO_UNITS.includes(unitStr) ? unitStr : 'Pcs';
};

// Helper to map finished good's own UOM to one of the 4 standard options
const mapFgUomToOption = (selectedFg) => {
    if (!selectedFg) return 'Pcs';
    const fgUom = (selectedFg.uom && typeof selectedFg.uom === 'object' && (selectedFg.uom.symbol || selectedFg.uom.name || selectedFg.uom.abbreviation))
        ? (selectedFg.uom.symbol || selectedFg.uom.name || selectedFg.uom.abbreviation)
        : (typeof selectedFg.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(selectedFg.uom) ? selectedFg.uom : (selectedFg.unit || 'Pcs'));
    return normalizeSoUnit(fgUom);
};

// Helper to resolve physical empty bag weight in grams
const resolveEmptyBagWeightGms = (fg) => {
    if (!fg) return null;
    const directWeight = Number(fg.bagWeightGms || fg.tareWeightGram || 0);
    if (directWeight >= 15 && directWeight <= 500) {
        return directWeight;
    }
    const gsm = Number(fg.fabricGSM || fg.gsm || 0);
    const width = Number(fg.dimensions?.width || 0);
    const length = Number(fg.dimensions?.length || 0);
    const dimUnit = String(fg.dimensionUnit || fg.dimensions?.unit || 'cm').toLowerCase();

    if (gsm > 0 && width > 0 && length > 0) {
        const widthCm = dimUnit === 'inch' || dimUnit === 'inches' ? width * 2.54 : width;
        const lengthCm = dimUnit === 'inch' || dimUnit === 'inches' ? length * 2.54 : length;
        const computedGrams = Number(((2 * widthCm * lengthCm * gsm) / 10000).toFixed(2));
        if (computedGrams >= 15 && computedGrams <= 500) {
            return computedGrams;
        }
    }
    return null;
};

// Helper to evaluate unit conversion feedback (hint or amber warning)
const getUnitConversionFeedback = (selectedFg, lineUnit, lineQuantity) => {
    if (!selectedFg) return null;
    const fgUom = mapFgUomToOption(selectedFg);
    const selectedUnit = normalizeSoUnit(lineUnit);

    const isCount = (u) => ['Pcs', 'Bags'].includes(u);
    const isWeight = (u) => u === 'Kg';

    // If matching unit (or both count units), no conversion note needed
    if (selectedUnit === fgUom || (isCount(selectedUnit) && isCount(fgUom))) {
        return null;
    }

    const qty = Number(lineQuantity) || 0;
    const bagWeightGms = resolveEmptyBagWeightGms(selectedFg);
    const capacityKg = Number(selectedFg.bagCapacity || 0);

    // From Weight (Kg) to Count (Pcs/Bags)
    if (isWeight(selectedUnit) && isCount(fgUom)) {
        if (bagWeightGms && bagWeightGms > 0) {
            const bagWeightKg = bagWeightGms / 1000;
            const approxCount = qty > 0 ? Math.round(qty / bagWeightKg) : null;
            return {
                type: 'hint',
                message: approxCount
                    ? `approx. ${approxCount.toLocaleString('en-IN')} ${fgUom} (${bagWeightGms}g / bag)`
                    : `Convertible to ${fgUom} (~${bagWeightGms}g / bag)`
            };
        }
        if (capacityKg > 0) {
            const approxCount = qty > 0 ? Math.round(qty / capacityKg) : null;
            return {
                type: 'hint',
                message: approxCount
                    ? `approx. ${approxCount.toLocaleString('en-IN')} ${fgUom} (${capacityKg} Kg capacity)`
                    : `Convertible to ${fgUom} (~${capacityKg} Kg / bag)`
            };
        }
    }

    // From Count (Pcs/Bags) to Weight (Kg)
    if (isCount(selectedUnit) && isWeight(fgUom)) {
        if (bagWeightGms && bagWeightGms > 0) {
            const bagWeightKg = bagWeightGms / 1000;
            const approxKg = qty > 0 ? Number((qty * bagWeightKg).toFixed(2)) : null;
            return {
                type: 'hint',
                message: approxKg
                    ? `approx. ${approxKg.toLocaleString('en-IN')} Kg (${bagWeightGms}g / bag)`
                    : `Convertible to Kg (~${bagWeightGms}g / bag)`
            };
        }
        if (capacityKg > 0) {
            const approxKg = qty > 0 ? Number((qty * capacityKg).toFixed(2)) : null;
            return {
                type: 'hint',
                message: approxKg
                    ? `approx. ${approxKg.toLocaleString('en-IN')} Kg (${capacityKg} Kg capacity)`
                    : `Convertible to Kg (~${capacityKg} Kg / bag)`
            };
        }
    }

    // No conversion exists for this product and unit
    return {
        type: 'warning',
        message: 'No conversion for this product, dispatch must be in this same unit'
    };
};

export default function CreateSalesOrderModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const isEditMode = Boolean(initialData && initialData._id);

    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [locations, setLocations] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [orderDate, setOrderDate] = useState(getTodayLocalDateString());
    const [deliveryDue, setDeliveryDue] = useState(getFutureLocalDateString(7));
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

    // Populate Initial Data on Edit Mode & reset
    useEffect(() => {
        if (isOpen) {
            console.log('[Date Verification] Sales Order Form Opened — Local Today:', getTodayLocalDateString(), 'Delivery Due Default:', getFutureLocalDateString(7));
        }

        if (isOpen && isEditMode && initialData) {
            const custId = typeof initialData.customer === 'object' ? initialData.customer?._id : initialData.customer;
            setCustomerId(custId || '');
            setOrderDate(formatToLocalDateString(initialData.orderDate));
            setDeliveryDue(formatToLocalDateString(initialData.deliveryDue));
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
                            unit: normalizeSoUnit(it.unit),
                            ratePerUnit: rate >= 0 ? String(rate) : '',
                            subtotal: qty * rate
                        };
                    })
                );
            }
        } else if (isOpen && !isEditMode) {
            // Reset for new Sales Order or pre-fill from conversion initialData
            const prefillCustId = initialData?.customerId || (typeof initialData?.customer === 'object' ? initialData?.customer?._id : initialData?.customer) || initialData?.customerRef || '';
            setCustomerId(prefillCustId);
            setOrderDate(getTodayLocalDateString());
            setDeliveryDue(initialData?.deliveryDue ? formatToLocalDateString(initialData.deliveryDue) : getFutureLocalDateString(7));
            setDispatchLocation(initialData?.dispatchLocation || '');
            setStatus(initialData?.status || 'CONFIRMED');
            setNotes(initialData?.notes || initialData?.description || '');
            if (Array.isArray(initialData?.items) && initialData.items.length > 0) {
                setItems(initialData.items);
            } else if (initialData?.totalOrderQuantity) {
                setItems([{ finishedGood: '', quantity: String(initialData.totalOrderQuantity), unit: 'Pcs', ratePerUnit: '', subtotal: 0 }]);
            } else {
                setItems([{ finishedGood: '', quantity: '', unit: 'Pcs', ratePerUnit: '', subtotal: 0 }]);
            }
        }
    }, [isOpen, isEditMode, initialData]);

    // Handle Expected Delivery Date Change
    const handleDeliveryDueChange = (e) => {
        setDeliveryDue(e.target.value);
    };

    // Handle Item Field Changes
    const handleItemChange = (index, field, value) => {
        const updated = [...items];
        updated[index][field] = value;

        if (field === 'finishedGood') {
            const selectedFG = finishedGoods.find((f) => String(f._id) === String(value));
            if (selectedFG) {
                updated[index].unit = mapFgUomToOption(selectedFG);
                if (!updated[index].ratePerUnit && selectedFG.pricePerBag) {
                    updated[index].ratePerUnit = String(selectedFG.pricePerBag);
                }
            }
        }

        if (field === 'quantity' || field === 'ratePerUnit') {
            const q = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
            const r = Number(field === 'ratePerUnit' ? value : updated[index].ratePerUnit) || 0;
            updated[index].subtotal = q * r;
        }

        setItems(updated);
    };

    const handleAddItem = () => {
        setItems([...items, { finishedGood: '', quantity: '', unit: 'Pcs', ratePerUnit: '', subtotal: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) {
            toast.error('Sales Order must contain at least one line item.');
            return;
        }
        setItems(items.filter((_, i) => i !== index));
    };

    const addItemRow = handleAddItem;
    const removeItemRow = handleRemoveItem;

    // Live Calculation: Group and sum quantities by unit separately
    const quantityTotalsByUnit = items.reduce((acc, it) => {
        const qty = Number(it.quantity) || 0;
        if (qty > 0) {
            const unit = normalizeSoUnit(it.unit);
            acc[unit] = (acc[unit] || 0) + qty;
        }
        return acc;
    }, {});

    const formattedTotalQuantity = Object.entries(quantityTotalsByUnit).length > 0
        ? Object.entries(quantityTotalsByUnit)
            .map(([unit, qty]) => `${qty % 1 === 0 ? qty.toLocaleString('en-IN') : Number(qty.toFixed(3)).toLocaleString('en-IN')} ${unit}`)
            .join(' + ')
        : '0 Pcs';

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

        if (initialData?.isPendingApproval || initialData?.nslStatus === 'Pending Approval') {
            toast.error('NSL is waiting for Tenant Admin approval');
            return;
        }
        if (initialData?.isRejected || initialData?.nslStatus === 'Rejected') {
            toast.error('NSL was rejected');
            return;
        }
        if (initialData?.isConfirmed || initialData?.orderConfirmed || initialData?.nslStatus === 'Confirmed') {
            toast.error('Sales Order already generated for this enquiry');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                customer: customerId,
                nslId: initialData?.nslId || undefined,
                orderDate,
                deliveryDue,
                dispatchLocation: dispatchLocation || undefined,
                status,
                notes: notes.trim() || undefined,
                items: items.map((it) => ({
                    finishedGood: it.finishedGood,
                    quantity: Number(it.quantity),
                    unit: normalizeSoUnit(it.unit),
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

    const isNslConfirmed = Boolean(
        initialData?.isConfirmed ||
        initialData?.orderConfirmed ||
        initialData?.nslStatus === 'Confirmed'
    );
    const isNslBlocked = Boolean(
        initialData?.isPendingApproval ||
        initialData?.nslStatus === 'Pending Approval' ||
        initialData?.isRejected ||
        initialData?.nslStatus === 'Rejected' ||
        isNslConfirmed
    );
    const nslBlockedTooltip = isNslConfirmed
        ? 'Sales Order already generated for this enquiry'
        : (initialData?.isPendingApproval || initialData?.nslStatus === 'Pending Approval')
            ? 'NSL is waiting for Tenant Admin approval'
            : 'NSL was rejected';

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
                <div title={isNslBlocked ? nslBlockedTooltip : undefined}>
                    <button
                        type="submit"
                        form="sales-order-form"
                        disabled={!isFormValid || isSubmitting || isNslBlocked}
                        className={`px-5 py-2 font-extrabold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                            isNslBlocked
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70'
                                : 'bg-primary hover:bg-primary-hover text-sidebar-bg cursor-pointer disabled:opacity-50'
                        }`}
                    >
                        <ShoppingCart size={14} />
                        <span>{isSubmitting ? 'Saving Sales Order...' : isEditMode ? 'Update Sales Order' : 'Confirm Sales Order'}</span>
                    </button>
                </div>
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

                        <SearchableSelect
                            required
                            value={customerId}
                            onChange={(val) => setCustomerId(val)}
                            disabled={isLoadingDropdowns}
                            loading={isLoadingDropdowns}
                            placeholder={isLoadingDropdowns ? 'Loading Customers catalog...' : '-- Select Customer / Buyer --'}
                            searchPlaceholder="Search customer by code, name, or GSTIN..."
                            emptyMessage="No customers found"
                            footerAction={{
                                label: '+ New Customer',
                                onClick: () => setIsQuickCustomerOpen(true)
                            }}
                            options={customers.map((c) => ({
                                value: c._id,
                                code: c.code || c.customerCode || 'CUST',
                                label: c.companyName || c.name,
                                subLabel: [c.gstin ? `GSTIN: ${c.gstin}` : 'Unregistered', c.city || c.state].filter(Boolean).join(' • '),
                                searchText: `${c.code || c.customerCode || ''} ${c.companyName || ''} ${c.name || ''} ${c.gstin || ''} ${c.contactPerson || ''}`
                            }))}
                        />

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
                                <span>Order Date</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={orderDate || getTodayLocalDateString()}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
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
                                onChange={handleDeliveryDueChange}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center gap-1">
                                <MapPin size={12} className="text-text-muted" />
                                <span>Dispatch Dock</span>
                            </label>
                            <SearchableSelect
                                value={dispatchLocation}
                                onChange={(val) => setDispatchLocation(val)}
                                placeholder="-- Optional Location --"
                                searchPlaceholder="Search dispatch dock..."
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
                                        <div className="col-span-12 sm:col-span-4">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Finished Bag Specification *
                                            </label>
                                            <SearchableSelect
                                                required
                                                value={item.finishedGood}
                                                onChange={(val) => handleItemChange(index, 'finishedGood', val)}
                                                placeholder="-- Select Bag Product --"
                                                searchPlaceholder="Search by code, name, GSM, size, laminated..."
                                                emptyMessage="No finished bag specifications found"
                                                options={finishedGoods.map((fg) => {
                                                    const fgUom = (fg.uom && typeof fg.uom === 'object' && (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation))
                                                        ? (fg.uom.symbol || fg.uom.name || fg.uom.abbreviation)
                                                        : (typeof fg.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(fg.uom) ? fg.uom : (fg.unit || 'Pcs'));
                                                    const stockVal = Number(fg.currentStock !== undefined && fg.currentStock !== null ? fg.currentStock : 0);
                                                    const gsmVal = fg.fabricGSM ?? fg.gsm ?? fg.fabricGsm;
                                                    const dimStr = fg.dimensions?.width && fg.dimensions?.length
                                                        ? `${fg.dimensions.width}x${fg.dimensions.length}${fg.dimensions.unit || 'cm'}`
                                                        : '';
                                                    return {
                                                        value: fg._id,
                                                        code: fg.code || 'FG',
                                                        label: fg.name,
                                                        subLabel: [gsmVal ? `${gsmVal} GSM` : '', dimStr, `Stock: ${stockVal.toLocaleString('en-IN')} ${fgUom}`].filter(Boolean).join(' • '),
                                                        badge: `Stock: ${stockVal.toLocaleString('en-IN')}`,
                                                        badgeTone: stockVal > 0 ? 'emerald' : 'rose',
                                                        searchText: `${fg.code || ''} ${fg.name || ''} ${gsmVal || ''} ${dimStr} ${fg.description || ''}`
                                                    };
                                                })}
                                            />
                                        </div>

                                        <div className="col-span-6 sm:col-span-4">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Order Qty & Unit *
                                            </label>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.001"
                                                    min="0.001"
                                                    placeholder="e.g. 5000"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                    className="w-full min-w-0 border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                                                />
                                                <select
                                                    value={normalizeSoUnit(item.unit)}
                                                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                                    className="border border-border rounded p-1.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer shrink-0"
                                                >
                                                    {ALL_SO_UNITS.map((u) => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="col-span-3 sm:col-span-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">
                                                Rate per {item.unit === 'Bags' ? 'Bag' : (item.unit || 'Unit')} *
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

                                        {/* Unit Conversion Hint or Warning */}
                                        {selectedFg && (() => {
                                            const feedback = getUnitConversionFeedback(selectedFg, item.unit, item.quantity);
                                            if (!feedback) return null;
                                            if (feedback.type === 'hint') {
                                                return (
                                                    <div className="col-span-12 px-1 pt-0.5 text-[11px] text-primary font-medium flex items-center gap-1.5">
                                                        <span className="font-bold">💡</span>
                                                        <span>{feedback.message}</span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="col-span-12 px-2 py-1 bg-amber-50 border border-amber-200/80 rounded text-[11px] text-amber-800 font-medium flex items-center gap-1.5 mt-0.5">
                                                    <AlertCircle size={13} className="text-amber-600 shrink-0" />
                                                    <span>{feedback.message}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Live Financial Summary */}
                        <div className="bg-app-bg/80 border border-border/80 rounded-lg p-3 space-y-1.5 font-sans">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-text-muted font-medium">Total Quantity:</span>
                                <span className="font-mono font-bold text-text-main">{formattedTotalQuantity}</span>
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
