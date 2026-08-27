import { useState, useEffect } from 'react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import WorkOrderShortageModal from './WorkOrderShortageModal';
import toast from 'react-hot-toast';

const ALL_PIPELINE_STAGES = [
    { key: 'TAPE_EXTRUSION', label: 'Tape Extrusion' },
    { key: 'CIRCULAR_WEAVING', label: 'Circular Weaving' },
    { key: 'EXTRUSION_LAMINATION', label: 'Extrusion Lamination' },
    { key: 'FLEXO_PRINTING', label: 'Flexo Printing' },
    { key: 'CUTTING_SEWING', label: 'Cutting & Sewing' },
    { key: 'STITCHING', label: 'Stitching' },
    { key: 'HANDLE_ATTACHMENT', label: 'Handle Attachment' },
    { key: 'BALING_PACKING', label: 'Baling & Packing' }
];

export default function CreateWorkOrderModal({ isOpen, onClose, onSuccess }) {
    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [machines, setMachines] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

    const [customer, setCustomer] = useState('');
    const [finishedGood, setFinishedGood] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [assignedMachine, setAssignedMachine] = useState('');
    const [selectedStages, setSelectedStages] = useState([
        'FLEXO_PRINTING',
        'CUTTING_SEWING',
        'STITCHING',
        'HANDLE_ATTACHMENT',
        'BALING_PACKING'
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Shortage Modal State
    const [shortageList, setShortageList] = useState([]);
    const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
    const [selectedFgObj, setSelectedFgObj] = useState(null);

    // Fetch dropdown options when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchDropdowns = async () => {
            try {
                setIsLoadingDropdowns(true);
                const [custRes, fgRes, mchRes] = await Promise.all([
                    axiosInstance.get('/customers?isActive=true&limit=100'),
                    axiosInstance.get('/finished-goods?isActive=true&limit=100'),
                    axiosInstance.get('/machines?isActive=true&limit=100')
                ]);

                if (custRes.data?.success) {
                    const list = custRes.data.data || [];
                    setCustomers(list);
                    if (list.length > 0 && !customer) {
                        setCustomer(list[0]._id);
                    }
                }

                if (fgRes.data?.success) {
                    const list = fgRes.data.data || [];
                    setFinishedGoods(list);
                    if (list.length > 0 && !finishedGood) {
                        setFinishedGood(list[0]._id);
                    }
                }

                if (mchRes.data?.success) {
                    setMachines(mchRes.data.data || []);
                }
            } catch (err) {
                console.error('Failed to load dropdown options:', err);
                toast.error('Failed to load customers, products, or machine options.');
            } finally {
                setIsLoadingDropdowns(false);
            }
        };

        fetchDropdowns();
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedMachineObj = machines.find((m) => m._id === assignedMachine);
    const primaryOperator = selectedMachineObj?.currentOperator || (assignedMachine ? 'No Operator Assigned' : '');
    const isFormValid = customer && finishedGood && targetQuantity && Number(targetQuantity) >= 1;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) return;

        const targetQtyNum = Number(targetQuantity);
        const targetFg = finishedGoods.find(fg => fg._id === finishedGood);
        setSelectedFgObj(targetFg);

        try {
            setIsSubmitting(true);

            // Step 1: Pre-flight shortage check using backend BOM & Raw Material stocks
            const [bomRes, rmRes] = await Promise.all([
                axiosInstance.get(`/boms?finishedGood=${finishedGood}`).catch(() => ({ data: { data: [] } })),
                axiosInstance.get('/raw-materials?limit=100').catch(() => ({ data: { data: [] } }))
            ]);

            const boms = bomRes.data?.data || [];
            const rawMaterials = rmRes.data?.data || [];
            const activeBom = boms.find(b => b.isDefault || b.isActive) || boms[0];

            if (activeBom && Array.isArray(activeBom.items) && activeBom.items.length > 0) {
                const calculatedShortages = [];

                for (const item of activeBom.items) {
                    const rmId = typeof item.rawMaterial === 'object' ? item.rawMaterial?._id : item.rawMaterial;
                    const rmDoc = rawMaterials.find(r => r._id === rmId) || (typeof item.rawMaterial === 'object' ? item.rawMaterial : null);

                    if (rmDoc) {
                        const requiredQty = Number(item.quantityPerUnit || 0) * targetQtyNum;
                        const inStockQty = Number(rmDoc.currentStock || 0);

                        if (requiredQty > inStockQty) {
                            const shortageGap = requiredQty - inStockQty;
                            const suppObj = typeof rmDoc.defaultSupplier === 'object' ? rmDoc.defaultSupplier : null;

                            calculatedShortages.push({
                                rawMaterialId: rmDoc._id,
                                rawMaterialName: rmDoc.name,
                                uom: rmDoc.uom?.name || rmDoc.uom?.symbol || 'KG',
                                currentStock: inStockQty,
                                requiredQty: Number(requiredQty.toFixed(2)),
                                shortageQty: Number(shortageGap.toFixed(2)),
                                unitPrice: rmDoc.pricePerUnit || 120,
                                supplierId: suppObj?._id || (typeof rmDoc.defaultSupplier === 'string' ? rmDoc.defaultSupplier : null),
                                supplierName: suppObj?.name || null
                            });
                        }
                    }
                }

                if (calculatedShortages.length > 0) {
                    setShortageList(calculatedShortages);
                    setIsShortageModalOpen(true);
                    setIsSubmitting(false);
                    return; // Block WO creation until shortages resolved
                }
            }

            // Step 2: Proceed with WO creation if no raw material shortage
            const payload = {
                customer,
                finishedGood,
                targetQuantity: targetQtyNum,
                priority: priority || 'MEDIUM',
                assignedMachine: assignedMachine || null,
                selectedStages
            };

            const res = await axiosInstance.post('/work-orders', payload);

            if (res.data?.success) {
                const woNum = res.data.data?.workOrderNumber || 'Work Order';
                toast.success(`Work Order ${woNum} created successfully!`);

                setTargetQuantity('');
                setAssignedMachine('');
                setPriority('MEDIUM');

                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error creating work order:', err);
            toast.error(err.response?.data?.message || 'Failed to create Work Order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const footerButtons = (
        <>
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors cursor-pointer"
            >
                Cancel
            </button>
            <button
                type="submit"
                form="create-work-order-form"
                disabled={!isFormValid || isSubmitting}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
                {isSubmitting ? 'Checking Stock & Launching...' : 'Launch Work Order'}
            </button>
        </>
    );

    return (
        <>
            <SlideOverPanel
                isOpen={isOpen}
                onClose={onClose}
                title="Schedule New Production Work Order"
                subtitle="Assign Product Specs, Machine Line & Production Operator"
                widthClass="w-full max-w-full sm:max-w-lg"
                footer={footerButtons}
            >
                <form id="create-work-order-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Select Customer / Client *
                        </label>
                        <select
                            required
                            value={customer}
                            onChange={(e) => setCustomer(e.target.value)}
                            disabled={isLoadingDropdowns}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                        >
                            <option value="" disabled>
                                {isLoadingDropdowns ? 'Loading Customers...' : '-- Select Customer --'}
                            </option>
                            {customers.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.companyName || c.name} ({c.customerCode || c.code || 'CUST'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Select Finished Bag Specification *
                        </label>
                        <select
                            required
                            value={finishedGood}
                            onChange={(e) => setFinishedGood(e.target.value)}
                            disabled={isLoadingDropdowns}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                        >
                            <option value="" disabled>
                                {isLoadingDropdowns ? 'Loading Specifications...' : '-- Select Finished Good Spec --'}
                            </option>
                            {finishedGoods.map((fg) => (
                                <option key={fg._id} value={fg._id}>
                                    {fg.code || 'FG'} - {fg.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Target Quantity (Bags) *
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="e.g. 20000"
                                value={targetQuantity}
                                onChange={(e) => setTargetQuantity(e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Priority *
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-semibold"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Machine Line Allocation
                            </label>
                            <select
                                value={assignedMachine}
                                onChange={(e) => setAssignedMachine(e.target.value)}
                                disabled={isLoadingDropdowns}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50 font-sans"
                            >
                                <option value="">-- Optional Machine --</option>
                                {machines.map((m) => (
                                    <option key={m._id} value={m._id}>
                                        {m.code || 'MCH'} - {m.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Primary Operator
                            </label>
                            <input
                                type="text"
                                readOnly
                                disabled
                                placeholder="Select a machine first"
                                value={primaryOperator}
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-muted font-medium focus:outline-none cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Production Routing Sequence */}
                    <div className="space-y-2 pt-3 border-t border-border font-sans">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Production Routing Sequence (Uncheck to Skip Stages)
                            </label>
                            <span className="text-[10px] text-primary font-bold">
                                {selectedStages.length} Stages Active
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 bg-app-bg border border-border rounded-lg p-3">
                            {ALL_PIPELINE_STAGES.map((stg) => {
                                const isChecked = selectedStages.includes(stg.key);
                                return (
                                    <label key={stg.key} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-main hover:text-primary transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStages(prev => [...prev, stg.key]);
                                                } else {
                                                    if (selectedStages.length <= 1) {
                                                        toast.error('Work Order must include at least one active stage.');
                                                        return;
                                                    }
                                                    setSelectedStages(prev => prev.filter(k => k !== stg.key));
                                                }
                                            }}
                                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                        />
                                        <span className={isChecked ? 'text-text-main font-semibold' : 'text-text-muted line-through font-normal'}>
                                            {stg.label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </form>
            </SlideOverPanel>

            <WorkOrderShortageModal
                isOpen={isShortageModalOpen}
                shortages={shortageList}
                targetFgName={selectedFgObj?.name || 'Finished Product'}
                onClose={() => setIsShortageModalOpen(false)}
                onPoCreated={() => {
                    toast.success('Draft PO issued. You can adjust Work Order quantity or await stock arrival.');
                }}
            />
        </>
    );
}
