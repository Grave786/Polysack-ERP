import { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, RefreshCw, CheckCircle2, Eye, PackageCheck, AlertCircle, UploadCloud, ShieldCheck, Calendar, X, Download, FileText } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import ViewDispatchModal from '../components/dispatch/ViewDispatchModal';
import UploadPodModal from '../components/dispatch/UploadPodModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function DispatchPage() {
    const [activeTab, setActiveTab] = useState('dispatches');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewingDispatchData, setViewingDispatchData] = useState(null);
    const [uploadPodData, setUploadPodData] = useState(null);

    // Date range filter state (IST-compliant YYYY-MM-DD)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Sources (Sales Orders + POS Invoices) and Locations for drawer dropdowns
    const [dispatchableSources, setDispatchableSources] = useState([]);
    const [orderSearch, setOrderSearch] = useState('');
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
            setOrderSearch('');
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
    const columns = useMemo(() => [
        {
            header: 'DISPATCH #',
            exportValue: (row) => row.dispatchNumber || '',
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
            header: 'DISPATCH DATE',
            exportValue: (row) => {
                const d = row.dispatchDate || row.createdAt;
                return d ? new Date(d).toLocaleDateString('en-IN') : '';
            },
            render: (row) => {
                const d = row.dispatchDate || row.createdAt;
                return (
                    <span className="font-mono font-bold text-text-main text-xs whitespace-nowrap">
                        {d ? new Date(d).toLocaleDateString('en-IN') : '-'}
                    </span>
                );
            },
            sortable: true
        },
        {
            header: 'SOURCE / REFERENCE',
            exportValue: (row) => {
                const isPos = row.sourceType === 'POS_INVOICE' || Boolean(row.invoice && !row.salesOrder);
                return isPos
                    ? (row.invoice?.invoiceNumber || 'POS Invoice')
                    : (row.salesOrder?.soNumber || row.soNumber || '');
            },
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
            exportValue: (row) => {
                const soCust = row.salesOrder?.customer?.companyName || row.salesOrder?.customer?.name;
                const invCust = row.invoice?.customer?.companyName || row.invoice?.customer?.name || row.invoice?.walkInCustomer?.name;
                return soCust || invCust || row.customerName || '';
            },
            render: (row) => {
                const soCust = row.salesOrder?.customer?.companyName || row.salesOrder?.customer?.name;
                const invCust = row.invoice?.customer?.companyName || row.invoice?.customer?.name || row.invoice?.walkInCustomer?.name;
                const customerName = soCust || invCust || row.customerName || '-';

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
            exportValue: (row) => row.vehicleNumber || '',
            render: (row) => (
                <span className="font-mono font-semibold uppercase text-text-main text-xs bg-app-bg px-2 py-0.5 rounded border border-border">
                    {row.vehicleNumber || '-'}
                </span>
            )
        },
        {
            header: 'TRANSPORTER',
            exportValue: (row) => row.transporter || row.carrierName || 'V-Trans India Ltd',
            render: (row) => (
                <span className="font-semibold text-text-main text-xs">
                    {row.transporter || row.carrierName || 'V-Trans India Ltd'}
                </span>
            )
        },
        {
            header: 'BAGS SHIPPED',
            exportValue: (row) => {
                const itemsList = row.items || [];
                return itemsList.reduce((acc, i) => acc + Number(i.dispatchedQuantity || i.quantity || 0), 0);
            },
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
            exportValue: (row) => {
                const status = (row.deliveryStatus || row.status || 'IN_TRANSIT').toUpperCase();
                if (status === 'DELIVERED') return 'Delivered';
                if (status === 'POD_PENDING_APPROVAL') return 'POD Pending Approval';
                if (status === 'RETURNED') return 'Returned';
                return 'In Transit';
            },
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
    ], []);

    // ─── Delivery Register line-item columns ─────────────────────────────────
    const deliveryRegisterColumns = useMemo(() => [
        {
            header: 'DISPATCH #',
            exportValue: (row) => row.dispatchNumber || '',
            render: (row) => (
                <span className="font-mono font-bold text-primary uppercase text-xs">
                    {row.dispatchNumber || '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'DISPATCH DATE',
            exportValue: (row) => row.dispatchDate ? new Date(row.dispatchDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '',
            render: (row) => (
                <span className="font-mono text-xs text-text-main whitespace-nowrap">
                    {row.dispatchDate ? new Date(row.dispatchDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'SOURCE / REF #',
            exportValue: (row) => `${row.referenceNumber || ''} (${row.sourceType === 'POS_INVOICE' ? 'POS Counter Sale' : 'Sales Order'})`,
            render: (row) => {
                const isPos = row.sourceType === 'POS_INVOICE';
                return (
                    <div className="flex flex-col">
                        <span className={`font-mono font-extrabold uppercase text-xs ${isPos ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}`}>
                            {row.referenceNumber || '-'}
                        </span>
                        <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded w-fit mt-0.5 border ${
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
            header: 'CUSTOMER NAME & GSTIN',
            exportValue: (row) => `${row.customerName || ''} | GSTIN: ${row.customerGstin || '-'} | Phone: ${row.customerPhone || '-'}`,
            render: (row) => (
                <div className="space-y-0.5">
                    <div className="font-bold text-xs text-text-main">{row.customerName || '-'}</div>
                    <div className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                        <span>GSTIN: {row.customerGstin || '-'}</span>
                        {row.customerPhone && row.customerPhone !== '-' && <span>• 📞 {row.customerPhone}</span>}
                    </div>
                </div>
            ),
            sortable: true
        },
        {
            header: 'DESTINATION / CITY',
            exportValue: (row) => row.customerAddress !== '-' ? `${row.customerAddress}, ${row.customerCity}` : (row.customerCity || '-'),
            render: (row) => (
                <div className="text-[11px] max-w-[170px] space-y-0.5">
                    <div className="font-semibold text-text-main truncate" title={row.customerCity || '-'}>
                        {row.customerCity || '-'}
                    </div>
                    {row.customerAddress && row.customerAddress !== '-' && (
                        <div className="text-[10px] text-text-muted truncate" title={row.customerAddress}>
                            {row.customerAddress}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'PRODUCT / FINISHED GOOD',
            exportValue: (row) => `${row.productName || ''} (${row.productCode || '-'})`,
            render: (row) => (
                <div className="space-y-0.5">
                    <div className="font-bold text-xs text-text-main">{row.productName || '-'}</div>
                    {row.productCode && row.productCode !== '-' && (
                        <div className="text-[10px] font-mono text-text-muted">{row.productCode}</div>
                    )}
                </div>
            ),
            sortable: true
        },
        {
            header: 'SPECS (GSM / SIZE / SHAPE)',
            exportValue: (row) => `${row.fabricGsm || '-'} | ${row.size || '-'} | ${row.bagShape || '-'}`,
            render: (row) => (
                <div className="text-[10.5px] font-mono text-text-muted space-y-0.5">
                    <div className="font-semibold text-text-main">{row.fabricGsm !== '-' ? row.fabricGsm : 'Standard GSM'} {row.bagShape !== '-' ? `• ${row.bagShape}` : ''}</div>
                    <div>{row.size !== '-' ? row.size : '-'}</div>
                </div>
            )
        },
        {
            header: 'BATCH #',
            exportValue: (row) => row.batchNumber || '-',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted font-medium">
                    {row.batchNumber || '-'}
                </span>
            )
        },
        {
            header: 'QTY SHIPPED',
            exportValue: (row) => {
                const unitName = (typeof row.unit === 'string' && !/^[0-9a-fA-F]{24}$/.test(row.unit.trim()) && !/^[0-9a-fA-F]{24}_.+/.test(row.unit.trim())) ? row.unit : 'Bags';
                return `${Number(row.dispatchedQuantity || 0).toLocaleString('en-IN')} ${unitName}`;
            },
            render: (row) => {
                const bags = Number(row.dispatchedQuantity || 0);
                const bales = bags > 0 ? Math.ceil(bags / 300) : 0;
                const unitName = (typeof row.unit === 'string' && !/^[0-9a-fA-F]{24}$/.test(row.unit.trim()) && !/^[0-9a-fA-F]{24}_.+/.test(row.unit.trim())) ? row.unit : 'Bags';
                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">
                            {bags > 0 ? `${bags.toLocaleString('en-IN')} ${unitName}` : '-'}
                        </div>
                        {bags > 0 && (
                            <div className="text-[10px] text-text-muted font-mono font-medium">
                                (~{bales} Bales)
                            </div>
                        )}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'TRANSPORTER & VEHICLE',
            exportValue: (row) => `${row.transporter || ''} [${row.vehicleNumber || '-'}]`,
            render: (row) => (
                <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-text-main">{row.transporter || '-'}</div>
                    <span className="font-mono text-[10.5px] font-bold uppercase text-text-muted bg-app-bg px-1.5 py-0.5 rounded border border-border inline-block">
                        {row.vehicleNumber || '-'}
                    </span>
                </div>
            ),
            sortable: true
        },
        {
            header: 'DRIVER & CONTACT',
            exportValue: (row) => `${row.driverName || '-'} (${row.driverPhone || '-'})`,
            render: (row) => (
                <div className="text-[11px] space-y-0.5">
                    <div className="font-semibold text-text-main">{row.driverName || '-'}</div>
                    <div className="font-mono text-[10px] text-text-muted">{row.driverPhone && row.driverPhone !== '-' ? `📞 ${row.driverPhone}` : '-'}</div>
                </div>
            )
        },
        {
            header: 'DELIVERY STATUS',
            exportValue: (row) => {
                const status = (row.deliveryStatus || 'IN_TRANSIT').toUpperCase();
                if (status === 'DELIVERED') return 'Delivered';
                if (status === 'POD_PENDING_APPROVAL') return 'POD Pending Approval';
                if (status === 'RETURNED') return 'Returned';
                return 'In Transit';
            },
            render: (row) => {
                const status = (row.deliveryStatus || 'IN_TRANSIT').toUpperCase();
                const isDelivered = status === 'DELIVERED';
                const isPendingApproval = status === 'POD_PENDING_APPROVAL';
                const isReturned = status === 'RETURNED';

                return (
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
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
            },
            sortable: true
        },
        {
            header: 'POD RECEIVER & DATE',
            exportValue: (row) => {
                const receiver = row.podReceiverName || '-';
                const date = row.podConfirmedDate ? new Date(row.podConfirmedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-';
                return `Recd By: ${receiver} on ${date}`;
            },
            render: (row) => (
                <div className="text-[11px] space-y-0.5">
                    <div className="font-semibold text-text-main truncate max-w-[130px]" title={row.podReceiverName || '-'}>
                        {row.podReceiverName && row.podReceiverName !== '-' ? row.podReceiverName : '-'}
                    </div>
                    {row.podConfirmedDate && (
                        <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            {new Date(row.podConfirmedDate).toLocaleDateString('en-GB').replace(/\//g, '-')}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'REMARKS',
            exportValue: (row) => row.remarks || '-',
            render: (row) => (
                <span className="text-[11px] text-text-muted truncate max-w-[140px] block" title={row.remarks || '-'}>
                    {row.remarks || '-'}
                </span>
            )
        }
    ], []);

    // Stabilize extra filter params for API fetching & CSV export
    const extraFilterParams = useMemo(() => {
        const p = {};
        if (startDate && startDate.trim()) p.startDate = startDate.trim();
        if (endDate && endDate.trim()) p.endDate = endDate.trim();
        return p;
    }, [startDate, endDate]);

    // FROM/TO Date filter inputs
    const dateFilterControls = (
        <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                <label className="text-[10px] font-bold text-text-muted uppercase">From:</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                />
            </div>
            <div className="flex items-center gap-1.5 bg-card-bg px-2.5 py-1 border border-border rounded-lg text-xs shadow-2xs">
                <label className="text-[10px] font-bold text-text-muted uppercase">To:</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-text-main focus:outline-none cursor-pointer"
                />
            </div>
            {(startDate || endDate) && (
                <button
                    type="button"
                    onClick={() => {
                        setStartDate('');
                        setEndDate('');
                    }}
                    className="px-2 py-1 text-[11px] text-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-semibold cursor-pointer"
                    title="Clear Date Filter"
                >
                    Clear
                </button>
            )}
        </div>
    );

    // Delivery Register Export Handlers (CSV + PDF)
    const handleExportDeliveryRegisterCsv = async () => {
        try {
            toast.loading('Generating Delivery Register CSV export...', { id: 'del-csv-export' });
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await axiosInstance.get(`/dispatches/delivery-register?${params.toString()}`);
            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const list = res.data.data;
                const headers = [
                    'DISPATCH_NUMBER',
                    'DISPATCH_DATE',
                    'SOURCE_TYPE',
                    'REFERENCE_NUMBER',
                    'ORDER_DATE',
                    'DELIVERY_DUE_DATE',
                    'CUSTOMER_NAME',
                    'CUSTOMER_CODE',
                    'CUSTOMER_GSTIN',
                    'CUSTOMER_PHONE',
                    'DESTINATION_ADDRESS',
                    'DESTINATION_CITY',
                    'SOURCE_LOCATION',
                    'PRODUCT_NAME',
                    'PRODUCT_CODE',
                    'BAG_SHAPE',
                    'FABRIC_GSM',
                    'SIZE_DIMENSIONS',
                    'BATCH_NUMBER',
                    'DISPATCHED_QTY_BAGS',
                    'UNIT',
                    'TRANSPORTER',
                    'VEHICLE_NUMBER',
                    'DRIVER_NAME',
                    'DRIVER_PHONE',
                    'DELIVERY_STATUS',
                    'POD_RECEIVER_NAME',
                    'POD_RECEIVER_PHONE',
                    'POD_CONFIRMED_DATE',
                    'DISPATCHED_BY',
                    'REMARKS'
                ];

                const csvRows = [headers.join(',')];
                list.forEach((r) => {
                    const row = [
                        `"${(r.dispatchNumber || '').replace(/"/g, '""')}"`,
                        `"${r.dispatchDate ? new Date(r.dispatchDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${(r.sourceType === 'POS_INVOICE' ? 'POS Counter Sale' : 'Sales Order').replace(/"/g, '""')}"`,
                        `"${(r.referenceNumber || '').replace(/"/g, '""')}"`,
                        `"${r.orderDate ? new Date(r.orderDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${r.deliveryDueDate ? new Date(r.deliveryDueDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${(r.customerName || '').replace(/"/g, '""')}"`,
                        `"${(r.customerCode || '').replace(/"/g, '""')}"`,
                        `"${(r.customerGstin || '').replace(/"/g, '""')}"`,
                        `"${(r.customerPhone || '').replace(/"/g, '""')}"`,
                        `"${(r.customerAddress || '').replace(/"/g, '""')}"`,
                        `"${(r.customerCity || '').replace(/"/g, '""')}"`,
                        `"${(r.sourceLocation || '').replace(/"/g, '""')}"`,
                        `"${(r.productName || '').replace(/"/g, '""')}"`,
                        `"${(r.productCode || '').replace(/"/g, '""')}"`,
                        `"${(r.bagShape || '').replace(/"/g, '""')}"`,
                        `"${(r.fabricGsm || '').replace(/"/g, '""')}"`,
                        `"${(r.size || '').replace(/"/g, '""')}"`,
                        `"${(r.batchNumber || '').replace(/"/g, '""')}"`,
                        `"${Number(r.dispatchedQuantity || 0).toLocaleString('en-IN')}"`,
                        `"${(r.unit || 'Bags').replace(/"/g, '""')}"`,
                        `"${(r.transporter || '').replace(/"/g, '""')}"`,
                        `"${(r.vehicleNumber || '').replace(/"/g, '""')}"`,
                        `"${(r.driverName || '').replace(/"/g, '""')}"`,
                        `"${(r.driverPhone || '').replace(/"/g, '""')}"`,
                        `"${(r.deliveryStatus || '').replace(/"/g, '""')}"`,
                        `"${(r.podReceiverName || '').replace(/"/g, '""')}"`,
                        `"${(r.podReceiverPhone || '').replace(/"/g, '""')}"`,
                        `"${r.podConfirmedDate ? new Date(r.podConfirmedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : ''}"`,
                        `"${(r.dispatchedBy || '').replace(/"/g, '""')}"`,
                        `"${(r.remarks || '').replace(/"/g, '""')}"`
                    ];
                    csvRows.push(row.join(','));
                });

                const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Delivery_Register_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(`Exported ${list.length} Delivery line items to CSV!`, { id: 'del-csv-export' });
            } else {
                toast.error('No Delivery Register data found to export', { id: 'del-csv-export' });
            }
        } catch (err) {
            console.error('Error exporting Delivery Register CSV:', err);
            toast.error(err.response?.data?.message || 'Failed to export Delivery Register CSV', { id: 'del-csv-export' });
        }
    };

    const handleExportDeliveryRegisterPdf = async () => {
        try {
            toast.loading('Generating Delivery Register PDF report...', { id: 'del-pdf-export' });
            const { generatePdfReport } = await import('../utils/pdfExportUtils');
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await axiosInstance.get(`/dispatches/delivery-register?${params.toString()}`);
            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const list = res.data.data;
                const totalBags = list.reduce((sum, r) => sum + Number(r.dispatchedQuantity || 0), 0);
                const deliveredCount = list.filter((r) => r.deliveryStatus === 'DELIVERED').length;
                const inTransitCount = list.filter((r) => r.deliveryStatus === 'IN_TRANSIT').length;

                const summaryCards = [
                    { label: 'Total Dispatch Line Items', value: list.length.toLocaleString('en-IN'), notes: 'Granular dispatch items' },
                    { label: 'Total Bags Dispatched', value: `${totalBags.toLocaleString('en-IN')} Bags`, notes: `Approx ${(Math.ceil(totalBags / 300)).toLocaleString('en-IN')} Bales` },
                    { label: 'Delivered / Closed', value: deliveredCount.toLocaleString('en-IN'), notes: 'POD verified & completed' },
                    { label: 'Active In-Transit', value: inTransitCount.toLocaleString('en-IN'), notes: 'Vehicles currently on route' }
                ];

                const headers = ['Dispatch #', 'Date', 'Ref / SO #', 'Customer', 'Product / Specs', 'Qty (Bags)', 'Transporter & Vehicle', 'Status', 'POD Confirmed'];
                const rows = list.map((r) => [
                    r.dispatchNumber || '-',
                    r.dispatchDate ? new Date(r.dispatchDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-',
                    r.referenceNumber || '-',
                    r.customerName || '-',
                    `${r.productName || '-'}${r.fabricGsm !== '-' ? ' (' + r.fabricGsm + ')' : ''}`,
                    `${Number(r.dispatchedQuantity || 0).toLocaleString('en-IN')} ${r.unit || 'Bags'}`,
                    `${r.transporter || '-'}\n${r.vehicleNumber || '-'}`,
                    (r.deliveryStatus || 'IN_TRANSIT').replace(/_/g, ' '),
                    r.podConfirmedDate ? `${r.podReceiverName || 'Received'} on ${new Date(r.podConfirmedDate).toLocaleDateString('en-GB').replace(/\//g, '-')}` : 'Pending'
                ]);

                generatePdfReport({
                    title: 'Detailed Delivery & Dispatch Register',
                    subtitle: `Outward Logistics, Transporter & Delivery Register • Period: ${startDate ? new Date(startDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'All'} to ${endDate ? new Date(endDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Today'}`,
                    generatedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
                    filename: `Delivery_Register_${Date.now()}.pdf`,
                    summaryCards,
                    sections: [
                        {
                            title: 'OUTWARD FLEET DISPATCH & CUSTOMER DELIVERY REGISTER',
                            subtitle: 'One row per dispatched product line item with vehicle, transporter, and POD proof details',
                            headers,
                            rows
                        }
                    ]
                });
                toast.success('Generated Delivery Register PDF report!', { id: 'del-pdf-export' });
            } else {
                toast.error('No Delivery Register data found to export', { id: 'del-pdf-export' });
            }
        } catch (err) {
            console.error('Error generating Delivery Register PDF:', err);
            toast.error('Failed to generate Delivery Register PDF report', { id: 'del-pdf-export' });
        }
    };

    const tabs = useMemo(() => [
        {
            key: 'dispatches',
            label: 'Vehicle Dispatches',
            resourcePath: '/dispatches',
            columns: columns,
            availableStatuses: ['IN_TRANSIT', 'POD_PENDING_APPROVAL', 'DELIVERED', 'RETURNED']
        },
        {
            key: 'delivery-register',
            label: 'Delivery Register (Detailed)',
            resourcePath: '/dispatches/delivery-register',
            columns: deliveryRegisterColumns,
            availableStatuses: ['IN_TRANSIT', 'POD_PENDING_APPROVAL', 'DELIVERED', 'RETURNED'],
            isDeletable: false,
            isEditable: false
        }
    ], [columns, deliveryRegisterColumns]);

    const filteredSources = dispatchableSources.filter((src) => {
        if (!orderSearch.trim()) return true;
        const q = orderSearch.toLowerCase();
        return (
            (src.label && src.label.toLowerCase().includes(q)) ||
            (src.customerName && src.customerName.toLowerCase().includes(q)) ||
            (src.referenceNumber && src.referenceNumber.toLowerCase().includes(q))
        );
    });

    const headerActions = (
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {activeTab === 'delivery-register' ? (
                <>
                    <button
                        type="button"
                        onClick={handleExportDeliveryRegisterCsv}
                        className="flex items-center gap-1.5 px-3 py-2 bg-card-bg hover:bg-app-bg text-text-main border border-border font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                        title="Export item-wise Delivery Register in CSV format"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExportDeliveryRegisterPdf}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                        title="Export item-wise Delivery Register in PDF format"
                    >
                        <FileText size={14} />
                        <span>Export PDF</span>
                    </button>
                </>
            ) : null}
            <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
            >
                <Truck size={16} />
                <span>+ Plan Vehicle Dispatch</span>
            </button>
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Fleet Dispatch & Logistics Control"
                description="Vehicle loading, Delivery Challan, Baling Strapping & POD Confirmation"
                tabs={tabs}
                activeTabKey={activeTab}
                onTabChange={setActiveTab}
                headerActions={headerActions}
                filterSlot={dateFilterControls}
                extraFilterParams={extraFilterParams}
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
                                        {filteredSources.length} of {dispatchableSources.length} available to dispatch
                                    </span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="🔍 Search SO#, INV# or Customer Name..." 
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    className="w-full mb-2 border border-border rounded-md p-2 text-xs bg-card-bg text-text-main focus:outline-none focus:border-primary"
                                />
                                <select
                                    required
                                    value={selectedSource?.id || ''}
                                    onChange={(e) => handleSelectSource(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer font-sans"
                                >
                                    {filteredSources.length === 0 ? (
                                        <option value="">
                                            {dispatchableSources.length === 0
                                                ? 'No pending Sales Orders or POS Invoices available'
                                                : 'No matching orders found'}
                                        </option>
                                    ) : (
                                        filteredSources.map((src) => (
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
                                                        step="0.001"
                                                        min={0.001}
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
