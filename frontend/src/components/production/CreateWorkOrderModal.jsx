import { useState, useEffect } from 'react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import WorkOrderShortageModal from './WorkOrderShortageModal';
import toast from 'react-hot-toast';
import { Layers, Info } from 'lucide-react';

const STAGE_LABELS = {
    'TAPE_EXTRUSION': 'Stage 1: Tape Extrusion',
    'CIRCULAR_WEAVING': 'Stage 2: Circular Weaving',
    'EXTRUSION_LAMINATION': 'Stage 3: Extrusion Lamination',
    'FLEXO_PRINTING': 'Stage 4: Flexo Printing',
    'CUTTING_SEWING': 'Stage 5: Cutting & Sewing',
    'STITCHING': 'Stage 6: Stitching',
    'HANDLE_ATTACHMENT': 'Stage 7: Handle Attachment',
    'BALING_PACKING': 'Stage 8: Baling & Packing'
};

const ALL_STAGE_KEYS = [
    'TAPE_EXTRUSION',
    'CIRCULAR_WEAVING',
    'EXTRUSION_LAMINATION',
    'FLEXO_PRINTING',
    'CUTTING_SEWING',
    'STITCHING',
    'HANDLE_ATTACHMENT',
    'BALING_PACKING'
];

export default function CreateWorkOrderModal({ isOpen, onClose, onSuccess }) {
    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [machines, setMachines] = useState([]);
    const [activeStartingStage, setActiveStartingStage] = useState('FLEXO_PRINTING');
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

    const [customer, setCustomer] = useState('');
    const [finishedGood, setFinishedGood] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [assignedMachine, setAssignedMachine] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Shortage Modal State
    const [shortageList, setShortageList] = useState([]);
    const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
    const [selectedFgObj, setSelectedFgObj] = useState(null);

    // Fetch dropdown options & tenant production settings when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchDropdowns = async () => {
            try {
                setIsLoadingDropdowns(true);
                const [custRes, fgRes, mchRes, profileRes] = await Promise.all([
                    axiosInstance.get('/customers?isActive=true&limit=100'),
                    axiosInstance.get('/finished-goods?isActive=true&limit=100'),
                    axiosInstance.get('/machines?isActive=true&limit=100'),
                    axiosInstance.get('/admin/company-profile').catch(() => null)
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

                if (profileRes?.data?.success && profileRes.data?.data?.productionSettings?.activeStartingStage) {
                    setActiveStartingStage(profileRes.data.data.productionSettings.activeStartingStage);
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

    const startingIndex = ALL_STAGE_KEYS.indexOf(activeStartingStage);
    const resolvedStartingIndex = startingIndex === -1 ? 3 : startingIndex;
    const activeCount = ALL_STAGE_KEYS.length - resolvedStartingIndex;
    const skippedCount = resolvedStartingIndex;

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

            // Step 2: Proceed with WO creation (pipeline routing is automatically resolved by backend from Company Settings)
            const payload = {
                customer,
                finishedGood,
                targetQuantity: targetQtyNum,
                priority: priority || 'MEDIUM',
                assignedMachine: assignedMachine || null
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

                    {/* Read-Only Routing Sequence Banner governed solely by Company Settings */}
                    <div className="bg-app-bg border border-border/80 rounded-xl p-3.5 space-y-2 font-sans">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                                <Layers size={14} className="text-primary" />
                                <span>Facility Production Routing</span>
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {activeCount} Stages Active
                            </span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                            Work Order will automatically start at{' '}
                            <strong className="text-text-main font-bold">
                                {STAGE_LABELS[activeStartingStage] || activeStartingStage}
                            </strong>
                            {skippedCount > 0
                                ? ` (Stages 1–${skippedCount} skipped per Company Settings)`
                                : ' (Full 8-stage sequence active)'}.
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted pt-0.5">
                            <Info size={12} className="shrink-0 text-text-muted/70" />
                            <span>Configured in Company Settings &middot; Governs all tenant Work Orders</span>
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
