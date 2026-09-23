import { useState, useEffect } from 'react';
import { Truck, Plus, RefreshCw, CheckCircle2, Eye, PackageCheck, AlertCircle, UploadCloud, ShieldCheck } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import ViewDispatchModal from '../components/dispatch/ViewDispatchModal';
import UploadPodModal from '../components/dispatch/UploadPodModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function DispatchPage() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewingDispatchData, setViewingDispatchData] = useState(null);
    const [uploadPodData, setUploadPodData] = useState(null);

    // Sources (Sales Orders + POS Invoices) and Locations for drawer dropdowns
    const [dispatchableSources, setDispatchableSources] = useState([]);
    const [selectedSourceKey, setSelectedSourceKey] = useState('');
    const [selectedSource, setSelectedSource] = useState(null);
    const [locations, setLocations] = useState([]);
    const [isLoadingFormOptions, setIsLoadingFormOptions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Drawer Form State
    const [formData, setFormData] = useState({
        dispatchLocation: '',
        transporter: 'V-Trans India Ltd',
        vehicleNumber: 'GJ-05-BX-1000',
        driverName: '',
        driverPhone: '',
        notes: ''
    });

    const [dispatchItems, setDispatchItems] = useState([]);

    // Fetch Dispatchable Sources & Locations when Drawer Opens
    useEffect(() => {
        if (isDrawerOpen) {
            setIsLoadingFormOptions(true);
            Promise.all([
                axiosInstance.get('/dispatches/dispatchable-sources'),
                axiosInstance.get('/locations?isActive=true&limit=50')
            ])
                .then(([srcRes, locRes]) => {
                    if (srcRes.data?.success && Array.isArray(srcRes.data.data)) {
                        const list = srcRes.data.data;
                        setDispatchableSources(list);

                        if (list.length > 0) {
                            handleSelectSource(list[0].id, list);
                        } else {
                            setSelectedSource(null);
                            setSelectedSourceKey('');
                            setDispatchItems([]);
                        }
                    }

                    if (locRes.data?.success && Array.isArray(locRes.data.data)) {
                        const locs = locRes.data.data;
                        setLocations(locs);
                        if (locs.length > 0) {
                            setFormData((prev) => ({ ...prev, dispatchLocation: locs[0]._id }));
                        }
                    }
                })
                .catch((err) => {
                    console.error('Error fetching form options for dispatch:', err);
                    toast.error('Failed to load dispatchable orders catalog');
                })
                .finally(() => {
                    setIsLoadingFormOptions(false);
                });
        }
    }, [isDrawerOpen]);

    // Handle Source Selection (SO or POS Invoice)
    const handleSelectSource = (sourceId, sourcesList = dispatchableSources) => {
        const src = sourcesList.find((s) => String(s.id) === String(sourceId));
        setSelectedSource(src || null);
        setSelectedSourceKey(src ? `${src.sourceType}_${src.id}` : '');

        if (src && Array.isArray(src.items)) {
            const prepItems = src.items.map((item) => {
                const fgId = item.finishedGood?._id || item.finishedGood;
                const fgName = item.name || item.finishedGood?.name || 'Finished Goods Bag';
                const orderedQty = item.orderedQuantity || item.quantity || 0;
                const alreadyDispatched = item.alreadyDispatched || 0;
                const remainingQty = Math.max(0, orderedQty - alreadyDispatched);

                return {
                    finishedGood: fgId,
                    finishedGoodName: fgName,
                    orderedQuantity: orderedQty,
                    remainingQuantity: remainingQty,
                    dispatchedQuantity: remainingQty > 0 ? remainingQty : orderedQty
                };
            });
            setDispatchItems(prepItems);
        } else {
            setDispatchItems([]);
        }
    };

    // Submit Dispatch Plan
    const handleSubmitDispatch = async (e) => {
        e.preventDefault();

        if (!selectedSource || !formData.dispatchLocation || !formData.vehicleNumber.trim() || !formData.transporter.trim()) {
            toast.error('Please fill in all required fields (Order/Invoice Reference, Location, Vehicle #, Transporter)');
            return;
        }

        if (dispatchItems.length === 0) {
            toast.error('No items found in selected Order / Invoice');
            return;
        }

        // Validate quantities do not exceed remaining
        for (const it of dispatchItems) {
            const numQty = Number(it.dispatchedQuantity || 0);
            if (numQty <= 0) {
                toast.error(`Please enter a valid quantity > 0 for '${it.finishedGoodName}'`);
                return;
            }
            if (numQty > it.remainingQuantity + 0.0001) {
                toast.error(`Cannot dispatch ${numQty} bags for '${it.finishedGoodName}' — only ${it.remainingQuantity} bags remaining`);
                return;
            }
        }

        try {
            setIsSubmitting(true);

            const payload = {
                sourceType: selectedSource.sourceType,
                salesOrder: selectedSource.sourceType === 'SALES_ORDER' ? selectedSource.id : undefined,
                invoice: selectedSource.sourceType === 'POS_INVOICE' ? selectedSource.id : undefined,
                dispatchLocation: formData.dispatchLocation,
                vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
                transporter: formData.transporter.trim(),
                driverName: formData.driverName.trim(),
                driverPhone: formData.driverPhone.trim(),
                notes: formData.notes.trim(),
                items: dispatchItems.map((item) => ({
                    finishedGood: item.finishedGood,
                    dispatchedQuantity: Number(item.dispatchedQuantity || 0)
                }))
            };

            const res = await axiosInstance.post('/dispatches', payload);

            if (res.data?.success) {
                const dispNum = res.data.data?.dispatch?.dispatchNumber || 'DISP-NEW';
                toast.success(`Dispatch '${dispNum}' planned successfully!`);
                setIsDrawerOpen(false);
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error planning dispatch:', err);
            toast.error(err.response?.data?.message || 'Failed to plan vehicle dispatch');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Columns sequence
    const columns = [
        {
            header: 'DISPATCH #',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => setViewingDispatchData(row)}
                    className="font-mono font-bold uppercase text-primary hover:underline text-xs cursor-pointer text-left"
                >
                    {row.dispatchNumber || '-'}
                </button>
            ),
            sortable: true
        },
        {
            header: 'SOURCE / REFERENCE',
            render: (row) => {
                const isPos = row.sourceType === 'POS_INVOICE' || Boolean(row.invoice && !row.salesOrder);
                const refNum = isPos
                    ? (row.invoice?.invoiceNumber || 'POS Invoice')
                    : (row.salesOrder?.soNumber || row.soNumber || '-');

                return (
                    <div className="flex flex-col">
                        <span className={`font-mono font-extrabold uppercase text-xs ${isPos ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}`}>
                            {refNum}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded w-fit mt-0.5 border ${
                            isPos
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                            {isPos ? 'POS Counter Sale' : 'Sales Order'}
                        </span>
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'CUSTOMER',
            render: (row) => {
                const soCust = row.salesOrder?.customer?.companyName || row.salesOrder?.customer?.name;
                const invCust = row.invoice?.customer?.companyName || row.invoice?.customer?.name || row.invoice?.walkInCustomer?.name;
                const customerName = soCust || invCust || row.customerName || 'Retail Customer';

                return (
                    <span className="font-extrabold text-text-main text-xs">
                        {customerName}
                    </span>
                );
            },
            sortable: true
        },
        {
            header: 'VEHICLE NUMBER',
            render: (row) => (
                <span className="font-mono font-semibold uppercase text-text-main text-xs bg-app-bg px-2 py-0.5 rounded border border-border">
                    {row.vehicleNumber || '-'}
                </span>
            )
        },
        {
            header: 'TRANSPORTER',
            render: (row) => (
                <span className="font-semibold text-text-main text-xs">
                    {row.transporter || row.carrierName || 'V-Trans India Ltd'}
                </span>
            )
        },
        {
            header: 'BAGS SHIPPED',
            render: (row) => {
                const itemsList = row.items || [];
                const totalBags = itemsList.reduce((acc, i) => acc + Number(i.dispatchedQuantity || i.quantity || 0), 0);
                const totalBales = totalBags > 0 ? Math.ceil(totalBags / 300) : 0;

                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">
                            {totalBags > 0 ? `${totalBags.toLocaleString()} Bags` : '-'}
                        </div>
                        {totalBags > 0 && (
                            <div className="text-[10px] text-text-muted font-mono font-medium">
                                ({totalBales} Bales)
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'DELIVERY STATUS',
            render: (row) => {
                const status = (row.deliveryStatus || row.status || 'IN_TRANSIT').toUpperCase();
                const isDelivered = status === 'DELIVERED';
                const isPendingApproval = status === 'POD_PENDING_APPROVAL';
                const isReturned = status === 'RETURNED';

                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isDelivered
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isPendingApproval
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : isReturned
                            ? 'bg-danger/10 text-danger border border-danger/20'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            isDelivered
                                ? 'bg-emerald-500'
                                : isPendingApproval
                                ? 'bg-purple-600 animate-pulse'
                                : isReturned
                                ? 'bg-danger'
                                : 'bg-amber-500 animate-pulse'
                        }`} />
                        <span>
                            {isDelivered
                                ? 'Delivered'
                                : isPendingApproval
                                ? 'POD Pending Approval'
                                : isReturned
                                ? 'Returned'
                                : 'In Transit'}
                        </span>
                    </div>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => {
                const status = (row.deliveryStatus || row.status || 'IN_TRANSIT').toUpperCase();
                const isDelivered = status === 'DELIVERED';
                const isPendingApproval = status === 'POD_PENDING_APPROVAL';
                const isInTransit = status === 'IN_TRANSIT';

                return (
                    <div className="flex items-center gap-1.5 justify-end">
                        <button
                            type="button"
                            onClick={() => setViewingDispatchData(row)}
                            className="px-2.5 py-1 bg-app-bg hover:bg-card-bg border border-border text-text-muted hover:text-text-main rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="View Gate Pass / Challan & Details"
                        >
                            <Eye size={13} />
                            <span>View</span>
                        </button>

                        {isInTransit && (
                            <button
                                type="button"
                                onClick={() => setUploadPodData(row)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Mark as Delivered — Upload Proof of Delivery (Photo & Receiver)"
                            >
                                <UploadCloud size={12} />
                                <span>Mark as Delivered</span>
                            </button>
                        )}

                        {isPendingApproval && (
                            <button
                                type="button"
                                onClick={() => setViewingDispatchData(row)}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Step 2: Review Proof Photo & Approve Delivery"
                            >
                                <CheckCircle2 size={12} />
                                <span>Review POD / Approve</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ];

    const tabs = [
        {
            key: 'dispatches',
            label: 'Vehicle Dispatches',
            resourcePath: '/dispatches',
            columns: columns,
            availableStatuses: ['IN_TRANSIT', 'POD_PENDING_APPROVAL', 'DELIVERED', 'RETURNED']
        }
    ];

    const headerButton = (
        <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
        >
            <Truck size={16} />
            <span>+ Plan Vehicle Dispatch</span>
        </button>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Fleet Dispatch & Logistics Control"
                description="Vehicle loading, Delivery Challan, Baling Strapping & POD Confirmation"
                tabs={tabs}
                headerActions={headerButton}
                onAddClick={() => setIsDrawerOpen(true)}
                onEditClick={(row) => setViewingDispatchData(row)}
            />

            {/* SlideOverPanel Drawer for "+ Plan Vehicle Dispatch" */}
            <SlideOverPanel
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title="Plan Vehicle Dispatch & Gate Pass"
                subtitle="Select Sales Order or POS Sale, assign transporter carrier, vehicle number & quantity to ship"
            >
                <form onSubmit={handleSubmitDispatch} className="space-y-4 font-sans text-xs">
                    {isLoadingFormOptions ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-primary" />
                            <span>Loading Sales Orders & POS Invoices...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1 flex items-center justify-between">
                                    <span>Select Order / Invoice Reference *</span>
                                    <span className="text-[10px] text-text-muted font-normal">
                                        {dispatchableSources.length} available to dispatch
                                    </span>
                                </label>
                                <select
                                    required
                                    value={selectedSource?.id || ''}
                                    onChange={(e) => handleSelectSource(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    {dispatchableSources.length === 0 ? (
                                        <option value="">No pending Sales Orders or POS Invoices available</option>
                                    ) : (
                                        dispatchableSources.map((src) => (
                                            <option key={`${src.sourceType}_${src.id}`} value={src.id}>
                                                {src.label}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {selectedSource && (
                                <div className="bg-app-bg border border-border p-3 rounded-lg space-y-1.5 shadow-2xs">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-text-muted font-medium">Source Type:</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                            selectedSource.sourceType === 'POS_INVOICE'
                                                ? 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                                                : 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                                        }`}>
                                            {selectedSource.sourceType === 'POS_INVOICE' ? 'POS Counter Sale (Invoice)' : 'Sales Order'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-text-muted font-medium">Customer:</span>
                                        <span className="font-bold text-text-main">{selectedSource.customerName}</span>
                                    </div>
                                    {selectedSource.deliveryAddress && (
                                        <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-text-muted font-medium">Delivery Destination:</span>
                                            <span className="font-medium text-text-muted">{selectedSource.deliveryAddress}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/60">
                                        <span className="text-text-muted font-medium">Remaining to Ship:</span>
                                        <span className="font-mono font-extrabold text-primary">
                                            {selectedSource.remainingQuantity?.toLocaleString()} Bags
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Transporter / Carrier Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. V-Trans India Ltd"
                                        value={formData.transporter}
                                        onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Vehicle Number *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. GJ-05-BX-1000"
                                        value={formData.vehicleNumber}
                                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-mono font-bold text-text-main uppercase focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Driver Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ramesh Kumar"
                                        value={formData.driverName}
                                        onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Driver Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="+91 98765 43210"
                                        value={formData.driverPhone}
                                        onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Dispatch Location Dock *
                                </label>
                                <select
                                    required
                                    value={formData.dispatchLocation}
                                    onChange={(e) => setFormData({ ...formData, dispatchLocation: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    {locations.map((loc) => (
                                        <option key={loc._id} value={loc._id}>
                                            {loc.code ? `${loc.code} - ` : ''}{loc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Dispatch Quantities & Items */}
                            <div className="pt-2 border-t border-border space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Total Bags & Bales to Load
                                </label>

                                {dispatchItems.map((item, idx) => {
                                    const computedBales = Math.ceil(Number(item.dispatchedQuantity || 0) / 300);

                                    return (
                                        <div key={idx} className="bg-card-bg border border-border p-3 rounded-lg space-y-2">
                                            <div className="font-semibold text-xs text-text-main">
                                                {item.finishedGoodName}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 items-center">
                                                <div>
                                                    <div className="flex justify-between items-center text-[10px] text-text-muted mb-0.5">
                                                        <span>Quantity to Load (Bags)</span>
                                                        <span className="font-bold text-primary">
                                                            Max: {item.remainingQuantity}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        required
                                                        min={1}
                                                        max={item.remainingQuantity || item.orderedQuantity || 999999}
                                                        value={item.dispatchedQuantity}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setDispatchItems((prev) =>
                                                                prev.map((it, i) => (i === idx ? { ...it, dispatchedQuantity: val } : it))
                                                            );
                                                        }}
                                                        className="w-full border border-border rounded p-2 bg-app-bg text-xs font-extrabold text-text-main focus:outline-none focus:border-primary font-mono"
                                                    />
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[10px] text-text-muted block">Calculated Bales</span>
                                                    <span className="text-xs font-mono font-extrabold text-primary">
                                                        {computedBales} Bales
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Truck size={16} />
                                    <span>{isSubmitting ? 'Processing Dispatch...' : 'Confirm & Plan Dispatch'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* Modal: View Dispatch & Step 2 POD Approval */}
            <ViewDispatchModal
                isOpen={Boolean(viewingDispatchData)}
                dispatch={viewingDispatchData}
                onClose={() => setViewingDispatchData(null)}
                onOpenUploadPod={(disp) => setUploadPodData(disp)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />

            {/* Modal: Step 1 Upload POD */}
            <UploadPodModal
                isOpen={Boolean(uploadPodData)}
                dispatch={uploadPodData}
                onClose={() => setUploadPodData(null)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
