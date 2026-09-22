import { useState, useEffect } from 'react';
import SlideOverPanel from '../shared/SlideOverPanel';
import axiosInstance from '../../api/axiosInstance';
import WorkOrderShortageModal from './WorkOrderShortageModal';
import InlineLookupSelect from '../shared/InlineLookupSelect';
import { getTodayLocalDateString } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import {
    Layers,
    Info,
    FileSpreadsheet,
    FileText,
    UploadCloud,
    Trash2,
    X,
    Paperclip
} from 'lucide-react';

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
    // Dropdown master lists
    const [customers, setCustomers] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [machines, setMachines] = useState([]);
    const [activeStartingStage, setActiveStartingStage] = useState('FLEXO_PRINTING');
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

    // Core Work Order Form State
    const [customer, setCustomer] = useState('');
    const [finishedGood, setFinishedGood] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [assignedMachine, setAssignedMachine] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Job Order Details Form State
    const [orderDate, setOrderDate] = useState(getTodayLocalDateString());
    const [productCategory, setProductCategory] = useState('Print');
    const [jobDescriptionPrintColours, setJobDescriptionPrintColours] = useState('One Colour');
    const [jobDescriptionPrintSide, setJobDescriptionPrintSide] = useState('Single Side');
    const [customPrintSide, setCustomPrintSide] = useState('');
    const [materialQualityFabric, setMaterialQualityFabric] = useState('');
    const [fabricLaminationType, setFabricLaminationType] = useState('');
    const [materialColour, setMaterialColour] = useState('');
    const [printingColour, setPrintingColour] = useState('');
    const [fabricGrammage, setFabricGrammage] = useState('');
    const [bagWeightGms, setBagWeightGms] = useState('');
    const [fabricAverage, setFabricAverage] = useState('');
    const [fabricWidthInch, setFabricWidthInch] = useState('');
    const [fabricLengthInch, setFabricLengthInch] = useState('');
    const [customerContactNumber, setCustomerContactNumber] = useState('');
    const [contactPersonName, setContactPersonName] = useState('');
    const [contactPersonDesignation, setContactPersonDesignation] = useState('');
    const [totalOrderQuantity, setTotalOrderQuantity] = useState('');
    const [totalOrderQuantityUnit, setTotalOrderQuantityUnit] = useState('Pcs');
    const [orderConfirmed, setOrderConfirmed] = useState(false);
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [purchaseOrderFiles, setPurchaseOrderFiles] = useState([]);

    // Raw Material Attributes (shared masters: Quality Fabric, Lamination, Colours, Grammage)
    const [rmAttributes, setRmAttributes] = useState({});

    // Inline Attribute Modal State for on-the-fly Add/Edit
    const [attributeModal, setAttributeModal] = useState({
        isOpen: false,
        mode: 'ADD',
        attributeType: '',
        attributeLabel: '',
        customTarget: null,
        itemId: null,
        inputValue: '',
        prevName: '',
        isSaving: false
    });

    // Shortage Modal State
    const [shortageList, setShortageList] = useState([]);
    const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
    const [selectedFgObj, setSelectedFgObj] = useState(null);

    // Reset Form Fields
    const resetForm = () => {
        setTargetQuantity('');
        setAssignedMachine('');
        setPriority('MEDIUM');
        setOrderDate(getTodayLocalDateString());
        setProductCategory('Print');
        setJobDescriptionPrintColours('One Colour');
        setJobDescriptionPrintSide('Single Side');
        setCustomPrintSide('');
        setMaterialQualityFabric('');
        setFabricLaminationType('');
        setMaterialColour('');
        setPrintingColour('');
        setFabricGrammage('');
        setBagWeightGms('');
        setFabricAverage('');
        setFabricWidthInch('');
        setFabricLengthInch('');
        setCustomerContactNumber('');
        setContactPersonName('');
        setContactPersonDesignation('');
        setTotalOrderQuantity('');
        setTotalOrderQuantityUnit('Pcs');
        setOrderConfirmed(false);
        setExpectedDeliveryDate('');
        setPurchaseOrderFiles([]);
    };

    // Fetch dropdown options & tenant production settings when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchDropdowns = async () => {
            try {
                setIsLoadingDropdowns(true);
                const [custRes, fgRes, mchRes, profileRes, attrRes] = await Promise.all([
                    axiosInstance.get('/customers?isActive=true&limit=100'),
                    axiosInstance.get('/finished-goods?isActive=true&limit=100'),
                    axiosInstance.get('/machines?isActive=true&limit=100'),
                    axiosInstance.get('/admin/company-profile').catch(() => null),
                    axiosInstance.get('/raw-material-attributes').catch(() => null)
                ]);

                if (custRes.data?.success) {
                    const list = custRes.data.data || [];
                    setCustomers(list);
                    if (list.length > 0 && !customer) {
                        setCustomer(list[0]._id);
                        if (list[0].contactPerson && !contactPersonName) {
                            setContactPersonName(list[0].contactPerson);
                        }
                        if (list[0].phone && !customerContactNumber) {
                            setCustomerContactNumber(list[0].phone);
                        }
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

                if (attrRes?.data?.success && attrRes.data?.data) {
                    setRmAttributes(attrRes.data.data);
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
    // Collect which required fields are still missing (used for inline feedback)
    const missingFields = [];
    if (!customer) missingFields.push('Customer / Client');
    if (!finishedGood) missingFields.push('Finished Bag Specification');
    if (!targetQuantity || Number(targetQuantity) < 1) missingFields.push('Target Production Quantity (must be ≥ 1)');
    const isFormValid = missingFields.length === 0;

    const startingIndex = ALL_STAGE_KEYS.indexOf(activeStartingStage);
    const resolvedStartingIndex = startingIndex === -1 ? 3 : startingIndex;
    const activeCount = ALL_STAGE_KEYS.length - resolvedStartingIndex;
    const skippedCount = resolvedStartingIndex;

    // Handle Customer Selection with Contact Details Auto-Fill
    const handleCustomerChange = (selectedCustId) => {
        setCustomer(selectedCustId);
        const selectedCust = customers.find((c) => c._id === selectedCustId);
        if (selectedCust) {
            if (selectedCust.contactPerson) {
                setContactPersonName(selectedCust.contactPerson);
            }
            if (selectedCust.phone) {
                setCustomerContactNumber(selectedCust.phone);
            }
        }
    };

    // Expected Delivery Date Validation (must be today or later)
    const handleDeliveryDateChange = (e) => {
        const val = e.target.value;
        const todayStr = getTodayLocalDateString();
        if (val && val < todayStr) {
            setExpectedDeliveryDate(todayStr);
            toast.error("Expected delivery date cannot be in the past — reset to today's date.");
        } else {
            setExpectedDeliveryDate(val);
        }
    };

    // File Upload Handler (PDF/Image, up to 5 files, max 10MB each)
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        if (purchaseOrderFiles.length + files.length > 5) {
            toast.error('Maximum 5 Purchase Order files allowed.');
            return;
        }

        files.forEach((file) => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`"${file.name}" exceeds the 10MB limit.`);
                return;
            }

            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            if (!isImage && !isPdf) {
                toast.error(`"${file.name}" is not an image or PDF file.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                setPurchaseOrderFiles((prev) => {
                    if (prev.length >= 5) return prev;
                    return [
                        ...prev,
                        {
                            name: file.name,
                            size: file.size,
                            fileType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
                            data: reader.result
                        }
                    ];
                });
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
    };

    const handleRemoveFile = (indexToRemove) => {
        setPurchaseOrderFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // Inline Attribute Handlers for Shared Masters
    const handleOpenAddAttributeModal = (type, label, customTarget = null) => {
        setAttributeModal({
            isOpen: true,
            mode: 'ADD',
            attributeType: type,
            attributeLabel: label,
            customTarget: customTarget || type,
            itemId: null,
            inputValue: '',
            prevName: '',
            isSaving: false
        });
    };

    const handleOpenEditAttributeModal = (type, label, option, customTarget = null) => {
        setAttributeModal({
            isOpen: true,
            mode: 'EDIT',
            attributeType: type,
            attributeLabel: label,
            customTarget: customTarget || type,
            itemId: option._id,
            inputValue: option.name,
            prevName: option.name,
            isSaving: false
        });
    };

    const handleSaveAttributeModal = async (e) => {
        if (e) e.preventDefault();
        const trimmed = (attributeModal.inputValue || '').trim();
        if (!trimmed) {
            toast.error(`Please enter an option name for ${attributeModal.attributeLabel}`);
            return;
        }

        try {
            setAttributeModal((prev) => ({ ...prev, isSaving: true }));
            if (attributeModal.mode === 'ADD') {
                const res = await axiosInstance.post('/raw-material-attributes', {
                    attributeType: attributeModal.attributeType,
                    name: trimmed
                });
                if (res.data?.success && res.data.data) {
                    const newDoc = res.data.data;
                    toast.success(`'${newDoc.name}' created!`);
                    setRmAttributes((prev) => ({
                        ...prev,
                        [attributeModal.attributeType]: [...(prev[attributeModal.attributeType] || []), newDoc]
                    }));

                    if (attributeModal.customTarget === 'materialQualityFabric') setMaterialQualityFabric(newDoc.name);
                    else if (attributeModal.customTarget === 'fabricLaminationType' || attributeModal.attributeType === 'laminationType') setFabricLaminationType(newDoc.name);
                    else if (attributeModal.customTarget === 'fabricGrammage') setFabricGrammage(newDoc.name);
                    else if (attributeModal.customTarget === 'printingColour') setPrintingColour(newDoc.name);
                    else if (attributeModal.customTarget === 'materialColour') setMaterialColour(newDoc.name);

                    setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', customTarget: null, itemId: null, inputValue: '', prevName: '', isSaving: false });
                }
            } else if (attributeModal.mode === 'EDIT' && attributeModal.itemId) {
                const res = await axiosInstance.put(`/raw-material-attributes/${attributeModal.itemId}`, {
                    name: trimmed
                });
                if (res.data?.success && res.data.data) {
                    const updatedDoc = res.data.data;
                    toast.success(`'${updatedDoc.name}' updated!`);
                    setRmAttributes((prev) => ({
                        ...prev,
                        [attributeModal.attributeType]: (prev[attributeModal.attributeType] || []).map((item) =>
                            item._id === updatedDoc._id ? updatedDoc : item
                        )
                    }));

                    if (materialQualityFabric === attributeModal.prevName) setMaterialQualityFabric(updatedDoc.name);
                    if (fabricLaminationType === attributeModal.prevName) setFabricLaminationType(updatedDoc.name);
                    if (fabricGrammage === attributeModal.prevName) setFabricGrammage(updatedDoc.name);
                    if (materialColour === attributeModal.prevName) setMaterialColour(updatedDoc.name);
                    if (printingColour === attributeModal.prevName) setPrintingColour(updatedDoc.name);

                    setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', customTarget: null, itemId: null, inputValue: '', prevName: '', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save attribute error:', err);
            toast.error(err.response?.data?.message || 'Failed to save option');
            setAttributeModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    const handleDeleteAttributeInline = async (type, label, option, customTarget = null) => {
        if (!option) return;
        if (!window.confirm(`Are you sure you want to delete '${option.name}' from ${label}?`)) return;

        try {
            const res = await axiosInstance.delete(`/raw-material-attributes/${option._id}`);
            if (res.data?.success) {
                toast.success(`'${option.name}' deleted!`);
                setRmAttributes((prev) => ({
                    ...prev,
                    [type]: (prev[type] || []).filter((item) => item._id !== option._id)
                }));
                if (materialQualityFabric === option.name) setMaterialQualityFabric('');
                if (fabricLaminationType === option.name) setFabricLaminationType('');
                if (fabricGrammage === option.name) setFabricGrammage('');
                if (customTarget === 'printingColour' || printingColour === option.name) setPrintingColour('');
                if (customTarget === 'materialColour' || materialColour === option.name) setMaterialColour('');
            }
        } catch (err) {
            console.error('Delete attribute error:', err);
            toast.error(err.response?.data?.message || 'Failed to delete option');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            toast.error(`Please fill in: ${missingFields.join(', ')}`, { duration: 4000 });
            return;
        }

        const targetQtyNum = Number(targetQuantity);
        const targetFg = finishedGoods.find((fg) => fg._id === finishedGood);
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
            const activeBom = boms.find((b) => b.isDefault || b.isActive) || boms[0];

            if (activeBom && Array.isArray(activeBom.items) && activeBom.items.length > 0) {
                const calculatedShortages = [];

                for (const item of activeBom.items) {
                    const rmId = typeof item.rawMaterial === 'object' ? item.rawMaterial?._id : item.rawMaterial;
                    const rmDoc = rawMaterials.find((r) => r._id === rmId) || (typeof item.rawMaterial === 'object' ? item.rawMaterial : null);

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

            // Step 2: Proceed with WO creation with Job Order Details
            const payload = {
                customer,
                finishedGood,
                targetQuantity: targetQtyNum,
                priority: priority || 'MEDIUM',
                assignedMachine: assignedMachine || null,
                jobOrderDetails: {
                    orderDate: orderDate || getTodayLocalDateString(),
                    productCategory,
                    jobDescriptionPrintColours: productCategory === 'Print' ? jobDescriptionPrintColours : 'No Colour or Plain',
                    jobDescriptionPrintSide:
                        jobDescriptionPrintSide === 'Other'
                            ? customPrintSide
                                ? `Other: ${customPrintSide}`
                                : 'Other'
                            : jobDescriptionPrintSide,
                    materialQualityFabric,
                    fabricLaminationType,
                    materialColour,
                    printingColour,
                    fabricGrammage,
                    bagWeightGms: bagWeightGms !== '' ? Number(bagWeightGms) : null,
                    fabricAverage,
                    fabricSizeInInch: {
                        width: fabricWidthInch !== '' ? Number(fabricWidthInch) : null,
                        length: fabricLengthInch !== '' ? Number(fabricLengthInch) : null
                    },
                    customerContactNumber,
                    contactPersonName,
                    contactPersonDesignation,
                    totalOrderQuantity: totalOrderQuantity !== '' ? Number(totalOrderQuantity) : null,
                    totalOrderQuantityUnit,
                    orderConfirmed: Boolean(orderConfirmed),
                    expectedDeliveryDate: orderConfirmed && expectedDeliveryDate ? expectedDeliveryDate : null,
                    purchaseOrderFiles
                }
            };

            const res = await axiosInstance.post('/work-orders', payload);

            if (res.data?.success) {
                const woNum = res.data.data?.workOrderNumber || 'Work Order';
                toast.success(`Work Order ${woNum} created successfully!`);

                resetForm();
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
                onClick={() => {
                    resetForm();
                    onClose();
                }}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors cursor-pointer"
            >
                Cancel
            </button>
            <div className="flex flex-col items-end gap-1">
                {!isFormValid && missingFields.length > 0 && (
                    <p className="text-[10px] text-danger font-semibold text-right">
                        Required: {missingFields.join(' · ')}
                    </p>
                )}
                <button
                    type="submit"
                    form="create-work-order-form"
                    disabled={isSubmitting}
                    onClick={() => {
                        if (!isFormValid) {
                            toast.error(`Please fill in: ${missingFields.join(', ')}`, { duration: 4000 });
                        }
                    }}
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                    {isSubmitting ? 'Checking Stock & Launching...' : 'Launch Work Order'}
                </button>
            </div>
        </>
    );

    return (
        <>
            <SlideOverPanel
                isOpen={isOpen}
                onClose={() => {
                    resetForm();
                    onClose();
                }}
                title="Schedule New Production Work Order"
                subtitle="Assign Product Specs, Machine Line & Production Operator"
                widthClass="w-full max-w-full sm:max-w-xl md:max-w-2xl"
                footer={footerButtons}
            >
                <form id="create-work-order-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-sans pb-4">
                    {/* CORE REQUIRED WO FIELDS (Untouched in position and behavior) */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                            Select Customer / Client *
                        </label>
                        <select
                            required
                            value={customer}
                            onChange={(e) => handleCustomerChange(e.target.value)}
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
                                Target Production Quantity (Bags) *
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

                    {/* ========================================================================= */}
                    {/* NEW: JOB ORDER / JOB CARD DETAILS SECTION */}
                    {/* ========================================================================= */}
                    <div className="pt-4 border-t border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <FileSpreadsheet size={16} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                                        Job Order / Job Card Details
                                    </h3>
                                    <p className="text-[10.5px] text-text-muted">
                                        Printing specifications, fabric qualities & customer order metadata
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-text-muted border border-border">
                                Optional Job Specs
                            </span>
                        </div>

                        {/* Order Date & Product Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main mb-1">
                                    Order Date
                                </label>
                                <input
                                    type="date"
                                    value={orderDate}
                                    onChange={(e) => setOrderDate(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main mb-1">
                                    Product Category
                                </label>
                                <select
                                    value={productCategory}
                                    onChange={(e) => setProductCategory(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-medium"
                                >
                                    <option value="Print">Print</option>
                                    <option value="Plain">Plain</option>
                                </select>
                            </div>
                        </div>

                        {/* Print Configurations (Shown only if Product Category = Print) */}
                        {productCategory === 'Print' && (
                            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl space-y-3 animate-in fade-in duration-200">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                                    Printing Job Configuration
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main mb-1">
                                            Job Description (Print Colours)
                                        </label>
                                        <select
                                            value={jobDescriptionPrintColours}
                                            onChange={(e) => setJobDescriptionPrintColours(e.target.value)}
                                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-medium"
                                        >
                                            <option value="One Colour">One Colour</option>
                                            <option value="Two Colour">Two Colour</option>
                                            <option value="Three Colour">Three Colour</option>
                                            <option value="Four Colour">Four Colour</option>
                                            <option value="Five Colour">Five Colour</option>
                                            <option value="Six Colour">Six Colour</option>
                                            <option value="No Colour or Plain">No Colour or Plain</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main mb-1">
                                            Job Description 2 (Print Side)
                                        </label>
                                        <select
                                            value={jobDescriptionPrintSide}
                                            onChange={(e) => setJobDescriptionPrintSide(e.target.value)}
                                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-medium"
                                        >
                                            <option value="Single Side">Single Side</option>
                                            <option value="Double Side">Double Side</option>
                                            <option value="Only Plain">Only Plain</option>
                                            <option value="Other">Other (Custom)</option>
                                        </select>
                                        {jobDescriptionPrintSide === 'Other' && (
                                            <input
                                                type="text"
                                                placeholder="Specify custom print side..."
                                                value={customPrintSide}
                                                onChange={(e) => setCustomPrintSide(e.target.value)}
                                                className="mt-1.5 w-full border border-blue-300 dark:border-blue-700 rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans animate-in fade-in"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Material Quality - Fabric & Fabric Lamination Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Material Quality — Fabric"
                                value={materialQualityFabric}
                                onChange={(val) => setMaterialQualityFabric(val)}
                                options={rmAttributes.materialQualityFabric || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialQualityFabric', 'Material Quality-Fabric')}
                            />
                            <InlineLookupSelect
                                label="Fabric Lamination Type"
                                value={fabricLaminationType}
                                onChange={(val) => setFabricLaminationType(val)}
                                options={rmAttributes.laminationType || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('laminationType', 'Material Quality-Fabric (Lamination Type)')}
                            />
                        </div>

                        {/* Material Colour & Printing Colour (Using shared Colour master) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Material Colour (Base)"
                                value={materialColour}
                                onChange={(val) => setMaterialColour(val)}
                                options={rmAttributes.materialColour || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialColour', 'Material Colour', 'materialColour')}
                            />
                            <InlineLookupSelect
                                label="Printing Colour (Ink)"
                                value={printingColour}
                                onChange={(val) => setPrintingColour(val)}
                                options={rmAttributes.materialColour || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialColour', 'Material Colour', 'printingColour')}
                            />
                        </div>

                        {/* Fabric Grammage, Bag Weight (Gms) & Fabric Average */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Fabric Grammage"
                                value={fabricGrammage}
                                onChange={(val) => setFabricGrammage(val)}
                                options={rmAttributes.fabricGrammage || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('fabricGrammage', 'Fabric Grammage')}
                            />
                            <div className="flex flex-col h-full w-full">
                                <div className="flex items-start w-full mb-1 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug">
                                        Bag Weight (Gms)
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    placeholder="e.g. 65"
                                    value={bagWeightGms}
                                    onChange={(e) => setBagWeightGms(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono mt-auto"
                                />
                            </div>
                            <div className="flex flex-col h-full w-full">
                                <div className="flex items-start w-full mb-1 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug">
                                        Fabric Average
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. 52.4"
                                    value={fabricAverage}
                                    onChange={(e) => setFabricAverage(e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans mt-auto"
                                />
                            </div>
                        </div>

                        {/* Fabric Size in Inch (Width × Length) */}
                        <div className="p-3 bg-app-bg/60 border border-border rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-main">
                                    Fabric Size in Inch (Width × Length)
                                </label>
                                <span className="text-[10px] font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                                    Job Specific (Inches)
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                        Width (Inch)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="e.g. 22"
                                        value={fabricWidthInch}
                                        onChange={(e) => setFabricWidthInch(e.target.value)}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                        Length (Inch)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="e.g. 36"
                                        value={fabricLengthInch}
                                        onChange={(e) => setFabricLengthInch(e.target.value)}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Customer Contact Number, Person Name & Designation */}
                        <div className="space-y-1.5">
                            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-main">
                                Customer Contact & Authorization
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                        Contact Person Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rajesh Kumar"
                                        value={contactPersonName}
                                        onChange={(e) => setContactPersonName(e.target.value)}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                        Customer Contact Number
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="e.g. +91 98765 43210"
                                        value={customerContactNumber}
                                        onChange={(e) => setCustomerContactNumber(e.target.value)}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                        Contact Person Designation
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Purchase Manager"
                                        value={contactPersonDesignation}
                                        onChange={(e) => setContactPersonDesignation(e.target.value)}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Commercial Total Order Quantity (Kgs / Pcs / Bags) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main mb-1">
                                    Total Order Quantity (Kgs / Pcs)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        placeholder="e.g. 5000"
                                        value={totalOrderQuantity}
                                        onChange={(e) => setTotalOrderQuantity(e.target.value)}
                                        className="flex-1 border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-bold"
                                    />
                                    <select
                                        value={totalOrderQuantityUnit}
                                        onChange={(e) => setTotalOrderQuantityUnit(e.target.value)}
                                        className="w-24 border border-border rounded-md px-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer font-bold"
                                    >
                                        <option value="Pcs">Pcs</option>
                                        <option value="Kgs">Kgs</option>
                                        <option value="Bags">Bags</option>
                                    </select>
                                </div>
                            </div>

                            {/* Order Confirmed Toggle */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-main">
                                        Order Confirmed
                                    </label>
                                    <span className={`text-[10px] font-bold ${orderConfirmed ? 'text-emerald-700 dark:text-emerald-400' : 'text-text-muted'}`}>
                                        {orderConfirmed ? 'Confirmed' : 'Unconfirmed'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOrderConfirmed(false)}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${!orderConfirmed
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                                            : 'bg-card-bg text-text-muted border-border hover:bg-app-bg'
                                            }`}
                                    >
                                        No
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOrderConfirmed(true);
                                            if (!expectedDeliveryDate) setExpectedDeliveryDate(getTodayLocalDateString());
                                        }}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${orderConfirmed
                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                            : 'bg-card-bg text-text-muted border-border hover:bg-app-bg'
                                            }`}
                                    >
                                        Yes
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Expected Date of Delivery (Revealed only if Order Confirmed = Yes) */}
                        {orderConfirmed && (
                            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
                                    Expected Date of Delivery
                                </label>
                                <input
                                    type="date"
                                    min={getTodayLocalDateString()}
                                    value={expectedDeliveryDate}
                                    onChange={handleDeliveryDateChange}
                                    className="w-full border border-emerald-300 dark:border-emerald-700 rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-emerald-600 font-mono"
                                />
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                    Validated for today or future delivery dates.
                                </p>
                            </div>
                        )}

                        {/* Purchase Order from Customer (Attachment) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text-main">
                                    Purchase Order from Customer (PO Attachment)
                                </label>
                                <span className="text-[10px] text-text-muted font-medium">
                                    {purchaseOrderFiles.length}/5 files &middot; Max 10MB each (PDF/Image)
                                </span>
                            </div>

                            {purchaseOrderFiles.length < 5 && (
                                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border hover:border-primary/60 rounded-xl bg-app-bg/50 hover:bg-primary/5 transition-all cursor-pointer group">
                                    <UploadCloud size={24} className="text-text-muted group-hover:text-primary transition-colors mb-1" />
                                    <span className="text-xs font-bold text-text-main group-hover:text-primary transition-colors">
                                        Click to browse or drag PO files here
                                    </span>
                                    <span className="text-[10.5px] text-text-muted mt-0.5">
                                        Supports PDF, PNG, JPG, WEBP (up to 5 files, 10MB each)
                                    </span>
                                    <input
                                        type="file"
                                        multiple
                                        accept="application/pdf,image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            )}

                            {/* Uploaded Files List */}
                            {purchaseOrderFiles.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                    {purchaseOrderFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2.5 bg-card-bg border border-border rounded-lg shadow-2xs text-xs font-sans"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {file.fileType?.includes('pdf') ? (
                                                    <FileText size={16} className="text-rose-600 shrink-0" />
                                                ) : (
                                                    <Paperclip size={16} className="text-primary shrink-0" />
                                                )}
                                                <span className="truncate font-medium text-text-main text-[11px]" title={file.name}>
                                                    {file.name}
                                                </span>
                                                <span className="text-[10px] text-text-muted font-mono shrink-0">
                                                    ({Math.round(file.size / 1024)} KB)
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(idx)}
                                                className="p-1 text-text-muted hover:text-danger rounded hover:bg-app-bg transition-colors cursor-pointer shrink-0 ml-2"
                                                title="Remove file"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </SlideOverPanel>

            {/* Shortage Modal */}
            <WorkOrderShortageModal
                isOpen={isShortageModalOpen}
                shortages={shortageList}
                targetFgName={selectedFgObj?.name || 'Finished Product'}
                onClose={() => setIsShortageModalOpen(false)}
                onPoCreated={() => {
                    toast.success('Draft PO issued. You can adjust Work Order quantity or await stock arrival.');
                }}
            />

            {/* Generic Raw Material Attribute Inline Management Modal */}
            {attributeModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
                    <div
                        className="fixed inset-0"
                        onClick={() =>
                            setAttributeModal({
                                isOpen: false,
                                mode: 'ADD',
                                attributeType: '',
                                attributeLabel: '',
                                customTarget: null,
                                itemId: null,
                                inputValue: '',
                                prevName: '',
                                isSaving: false
                            })
                        }
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-5 border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {attributeModal.mode === 'ADD'
                                    ? `Add New ${attributeModal.attributeLabel}`
                                    : `Edit ${attributeModal.attributeLabel}`}
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    setAttributeModal({
                                        isOpen: false,
                                        mode: 'ADD',
                                        attributeType: '',
                                        attributeLabel: '',
                                        customTarget: null,
                                        itemId: null,
                                        inputValue: '',
                                        prevName: '',
                                        isSaving: false
                                    })
                                }
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAttributeModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    {attributeModal.attributeLabel} Option Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Enter new option"
                                    value={attributeModal.inputValue}
                                    onChange={(e) =>
                                        setAttributeModal((prev) => ({ ...prev, inputValue: e.target.value }))
                                    }
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAttributeModal({
                                            isOpen: false,
                                            mode: 'ADD',
                                            attributeType: '',
                                            attributeLabel: '',
                                            customTarget: null,
                                            itemId: null,
                                            inputValue: '',
                                            prevName: '',
                                            isSaving: false
                                        })
                                    }
                                    className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={attributeModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {attributeModal.isSaving ? 'Saving...' : 'Save Option'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
