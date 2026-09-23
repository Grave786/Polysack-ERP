import { useState, useEffect, useCallback } from 'react';
import { X, ClipboardList, IndianRupee, Paperclip, Trash2 } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    invoiceAttachments: [],
    customer: '',
    materialDescription: '',
    materialQualityFabric: '',
    fabricGrammage: '',
    materialQualityBags: '',
    laminationType: '',
    fabricColour: '',
    qualityThreadYarn: '',
    threadColour: '',
    fabricAverage: '',
    bagWidth: '',
    bagLength: '',
    bagDimensionUnit: 'cm',
    bagWeight: '',
    totalQuantityKg: '',
    totalQuantityPcs: '',
    basicPrice: '',
    gstPercent: '',
    freight: '',
    advancePaid: '',
    vehicleNumber: '',
    transporterName: '',
    materialReceiptAttachments: [],
    printOrPlain: 'PLAIN'
};

// Helper: convert file to base64
const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

// Render an attribute dropdown with + Add New button
function AttributeSelect({ label, field, value, options, onChange, onAddNew }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">{label}</label>
                <button type="button" onClick={onAddNew} className="text-xs text-primary hover:underline font-bold cursor-pointer shrink-0">+ Add New</button>
            </div>
            <select
                value={value || ''}
                onChange={(e) => onChange(field, e.target.value)}
                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
            >
                <option value="">-- Select {label} --</option>
                {options.map((opt) => (
                    <option key={opt._id} value={opt.name}>{opt.name}</option>
                ))}
            </select>
        </div>
    );
}

// File Uploader section
function FileUploader({ label, attachments, onChange }) {
    const handleFiles = async (files) => {
        const remaining = MAX_FILES - attachments.length;
        if (remaining <= 0) {
            toast.error(`Maximum ${MAX_FILES} files allowed`);
            return;
        }
        const toProcess = Array.from(files).slice(0, remaining);
        const results = [];
        for (const file of toProcess) {
            if (file.size > MAX_FILE_BYTES) {
                toast.error(`${file.name} exceeds 10 MB limit`);
                continue;
            }
            try {
                const b64 = await fileToBase64(file);
                results.push({ fileName: file.name, fileData: b64, fileType: file.type });
            } catch {
                toast.error(`Failed to read ${file.name}`);
            }
        }
        onChange([...attachments, ...results].slice(0, MAX_FILES));
    };

    const removeFile = (idx) => {
        onChange(attachments.filter((_, i) => i !== idx));
    };

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">{label}</label>
            <div
                className="w-full border-2 border-dashed border-border rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById(`file-input-${label.replace(/\s+/g, '-')}`).click()}
            >
                <input
                    id={`file-input-${label.replace(/\s+/g, '-')}`}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <Paperclip className="mx-auto text-text-muted mb-1" size={16} />
                <p className="text-xs text-text-muted">Click to attach files (max {MAX_FILES}, 10MB each)</p>
            </div>
            {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {attachments.map((f, i) => (
                        <li key={i} className="flex items-center justify-between bg-app-bg rounded-md px-2.5 py-1.5 text-xs">
                            <span className="truncate text-text-main font-medium flex-1 mr-2">{f.fileName}</span>
                            <button type="button" onClick={() => removeFile(i)} className="text-danger hover:text-danger/80 shrink-0 cursor-pointer">
                                <Trash2 size={13} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function CreateMaterialReceiptPanel({ isOpen, onClose, onSuccess }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Customers list
    const [customers, setCustomers] = useState([]);

    // RM Attributes master lists
    const [attrs, setAttrs] = useState({
        materialDescription: [],
        materialQualityFabric: [],
        fabricGrammage: [],
        materialQualityBags: [],
        laminationType: [],
        materialColour: [],
        qualityThreadYarn: [],
        threadColour: []
    });

    // Inline "Add New Attribute" modal state
    const [attrModal, setAttrModal] = useState({ open: false, type: '', label: '', value: '' });

    // Calculated total
    const calcTotal = useCallback(() => {
        const bp = Number(form.basicPrice) || 0;
        const gst = Number(form.gstPercent) || 0;
        const fr = Number(form.freight) || 0;
        const adv = Number(form.advancePaid) || 0;
        return bp + (bp * gst / 100) + fr - adv;
    }, [form.basicPrice, form.gstPercent, form.freight, form.advancePaid]);

    // Fetch data when panel opens
    useEffect(() => {
        if (!isOpen) return;
        setForm(EMPTY_FORM);

        axiosInstance.get('/customers?isActive=true&limit=200').then((res) => {
            if (res.data?.success && Array.isArray(res.data.data)) {
                setCustomers(res.data.data);
            }
        }).catch(() => { });

        axiosInstance.get('/raw-material-attributes').then((res) => {
            if (res.data?.success && res.data.data) {
                setAttrs((prev) => ({ ...prev, ...res.data.data }));
            }
        }).catch(() => { });
    }, [isOpen]);

    const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleAttrAddNew = (type, label) => {
        setAttrModal({ open: true, type, label, value: '' });
    };

    const handleAttrModalSave = async () => {
        const trimmed = attrModal.value.trim();
        if (!trimmed) return;
        try {
            toast.loading('Creating option...', { id: 'mr-attr-save' });
            const res = await axiosInstance.post('/raw-material-attributes', {
                attributeType: attrModal.type,
                name: trimmed
            });
            if (res.data?.success && res.data.data) {
                const newOpt = res.data.data;
                toast.success(`'${newOpt.name}' created!`, { id: 'mr-attr-save' });
                setAttrs((prev) => ({
                    ...prev,
                    [attrModal.type]: [...(prev[attrModal.type] || []), newOpt]
                }));
                set(attrModal.type, newOpt.name);
                setAttrModal({ open: false, type: '', label: '', value: '' });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create option', { id: 'mr-attr-save' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.customer) {
            toast.error('Please select a Customer / Company');
            return;
        }

        try {
            setIsSubmitting(true);
            toast.loading('Saving Material Receipt...', { id: 'mr-save' });

            const payload = {
                ...form,
                totalInvoiceAmount: calcTotal()
            };

            // Coerce numeric fields
            ['bagWidth', 'bagLength', 'bagWeight', 'totalQuantityKg', 'totalQuantityPcs',
                'basicPrice', 'gstPercent', 'freight', 'advancePaid'].forEach((f) => {
                    if (payload[f] !== '' && payload[f] !== null && payload[f] !== undefined) {
                        payload[f] = Number(payload[f]);
                    } else {
                        payload[f] = null;
                    }
                });

            const res = await axiosInstance.post('/material-receipts', payload);
            if (res.data?.success) {
                toast.success(`Receipt ${res.data.data?.receiptNumber} logged successfully!`, { id: 'mr-save' });
                onSuccess?.();
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save Material Receipt', { id: 'mr-save' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const totalAmount = calcTotal();

    const inputCls = "w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans";
    const labelCls = "block text-xs font-bold uppercase tracking-wider text-text-main mb-1";
    const sectionCls = "border border-border rounded-lg p-4 space-y-3 bg-app-bg/30";
    const sectionTitleCls = "text-xs font-extrabold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5";

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-full sm:w-[650px] md:w-[680px] lg:w-[720px] max-w-full bg-card-bg shadow-2xl z-50 flex flex-col border-l border-border font-sans animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="bg-sidebar-bg text-sidebar-text-active p-5 flex justify-between items-center border-b border-sidebar-hover shrink-0">
                    <div>
                        <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                            <ClipboardList size={18} />
                            Log Job-Work Material Receipt
                        </h2>
                        <p className="text-xs text-sidebar-text mt-0.5">Audit-only record — cannot be modified after creation.</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-sidebar-text hover:text-sidebar-text-active rounded-lg hover:bg-sidebar-hover transition-all cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">

                        {/* Section 1: Basic Info */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>📋 Receipt Information</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Date *</label>
                                    <input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Invoice Number</label>
                                    <input type="text" placeholder="e.g. INV-2026-001" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} className={inputCls} />
                                </div>
                            </div>

                            <FileUploader
                                label="Invoice Attachments (max 3)"
                                attachments={form.invoiceAttachments}
                                onChange={(v) => set('invoiceAttachments', v)}
                            />
                        </div>

                        {/* Section 2: Customer */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>🏢 Company / Customer</p>
                            <div>
                                <label className={labelCls}>Customer *</label>
                                <select required value={form.customer} onChange={(e) => set('customer', e.target.value)} className={`${inputCls} cursor-pointer`}>
                                    <option value="">-- Select Customer --</option>
                                    {customers.map((c) => (
                                        <option key={c._id} value={c._id}>
                                            {c.customerCode || c.code || 'CUST'} - {c.companyName || c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Section 3: Material Classification */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>🧵 Material Description & Quality</p>
                            <div className="grid grid-cols-2 gap-3">
                                <AttributeSelect label="Material Description" field="materialDescription" value={form.materialDescription}
                                    options={attrs.materialDescription} onChange={set}
                                    onAddNew={() => handleAttrAddNew('materialDescription', 'Material Description')} />

                                <AttributeSelect label="Material Quality (Fabric)" field="materialQualityFabric" value={form.materialQualityFabric}
                                    options={attrs.materialQualityFabric} onChange={set}
                                    onAddNew={() => handleAttrAddNew('materialQualityFabric', 'Material Quality (Fabric)')} />

                                <AttributeSelect label="Fabric Grammage (GSM)" field="fabricGrammage" value={form.fabricGrammage}
                                    options={attrs.fabricGrammage} onChange={set}
                                    onAddNew={() => handleAttrAddNew('fabricGrammage', 'Fabric Grammage')} />

                                <AttributeSelect label="Material Quality (Bags)" field="materialQualityBags" value={form.materialQualityBags}
                                    options={attrs.materialQualityBags} onChange={set}
                                    onAddNew={() => handleAttrAddNew('materialQualityBags', 'Material Quality (Bags)')} />

                                <AttributeSelect label="Lamination Type" field="laminationType" value={form.laminationType}
                                    options={attrs.laminationType} onChange={set}
                                    onAddNew={() => handleAttrAddNew('laminationType', 'Lamination Type')} />

                                <AttributeSelect label="Fabric Colour" field="fabricColour" value={form.fabricColour}
                                    options={attrs.materialColour} onChange={set}
                                    onAddNew={() => handleAttrAddNew('materialColour', 'Fabric Colour')} />

                                <AttributeSelect label="Quality Thread / Yarn" field="qualityThreadYarn" value={form.qualityThreadYarn}
                                    options={attrs.qualityThreadYarn} onChange={set}
                                    onAddNew={() => handleAttrAddNew('qualityThreadYarn', 'Quality Thread / Yarn')} />

                                <AttributeSelect label="Thread Colour" field="threadColour" value={form.threadColour}
                                    options={attrs.threadColour} onChange={set}
                                    onAddNew={() => handleAttrAddNew('threadColour', 'Thread Colour')} />
                            </div>

                            <div>
                                <label className={labelCls}>Fabric Average</label>
                                <input type="text" placeholder="e.g. 3.5 Grams" value={form.fabricAverage} onChange={(e) => set('fabricAverage', e.target.value)} className={inputCls} />
                            </div>
                        </div>

                        {/* Section 4: Bag Size & Weight */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>📐 Bag Size & Weight</p>

                            {/* Dimension Unit Toggle */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-text-muted font-medium">Dimension Unit:</span>
                                {['cm', 'inch'].map((u) => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => set('bagDimensionUnit', u)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${form.bagDimensionUnit === u ? 'bg-primary text-sidebar-bg shadow-xs' : 'bg-border text-text-muted hover:bg-primary/10'}`}
                                    >{u}</button>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className={labelCls}>Width ({form.bagDimensionUnit})</label>
                                    <input type="number" placeholder="e.g. 45" value={form.bagWidth} onChange={(e) => set('bagWidth', e.target.value)} className={inputCls} min="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>Length ({form.bagDimensionUnit})</label>
                                    <input type="number" placeholder="e.g. 75" value={form.bagLength} onChange={(e) => set('bagLength', e.target.value)} className={inputCls} min="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>Bag Weight (g)</label>
                                    <input type="number" placeholder="e.g. 95" value={form.bagWeight} onChange={(e) => set('bagWeight', e.target.value)} className={inputCls} min="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Total Quantity (Kg)</label>
                                    <input type="number" placeholder="e.g. 5000" value={form.totalQuantityKg} onChange={(e) => set('totalQuantityKg', e.target.value)} className={inputCls} min="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>Total Quantity (Pcs)</label>
                                    <input type="number" placeholder="e.g. 50000" value={form.totalQuantityPcs} onChange={(e) => set('totalQuantityPcs', e.target.value)} className={inputCls} min="0" />
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Invoice Financials */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>
                                <IndianRupee size={13} />
                                Invoice Financials
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Basic Price (₹)</label>
                                    <input type="number" placeholder="e.g. 85000" value={form.basicPrice} onChange={(e) => set('basicPrice', e.target.value)} className={inputCls} min="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>GST %</label>
                                    <input type="number" placeholder="e.g. 18" value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} className={inputCls} min="0" max="100" />
                                </div>
                                <div>
                                    <label className={labelCls}>Freight (₹)</label>
                                    <input type="number" placeholder="e.g. 2500" value={form.freight} onChange={(e) => set('freight', e.target.value)} className={inputCls} min="0" />
                                </div>
                                <div>
                                    <label className={labelCls}>Advance Paid (₹)</label>
                                    <input type="number" placeholder="e.g. 10000" value={form.advancePaid} onChange={(e) => set('advancePaid', e.target.value)} className={inputCls} min="0" />
                                </div>
                            </div>

                            {/* Auto-calculated Total */}
                            <div className="rounded-lg bg-primary/8 border border-primary/20 p-3 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-primary/80">Total Invoice Amount</span>
                                <span className="text-lg font-extrabold text-primary">
                                    ₹{isNaN(totalAmount) ? '0.00' : totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <p className="text-[10px] text-text-muted">Formula: Basic Price + (Basic Price × GST%) + Freight − Advance Paid</p>
                        </div>

                        {/* Section 6: Transport */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>🚚 Transport Details</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Vehicle Number</label>
                                    <input type="text" placeholder="e.g. GJ-01-AB-1234" value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Transporter Name</label>
                                    <input type="text" placeholder="e.g. Reliable Cargo Co." value={form.transporterName} onChange={(e) => set('transporterName', e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Section 7: Print/Plain + Receipt Attachments */}
                        <div className={sectionCls}>
                            <p className={sectionTitleCls}>📎 Additional Details</p>

                            <div>
                                <label className={labelCls}>Print or Plain</label>
                                <div className="flex gap-2">
                                    {['PLAIN', 'PRINT'].map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => set('printOrPlain', v)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${form.printOrPlain === v ? 'bg-primary text-sidebar-bg border-primary shadow-xs' : 'bg-card-bg text-text-muted border-border hover:border-primary/50'}`}
                                        >{v}</button>
                                    ))}
                                </div>
                            </div>

                            <FileUploader
                                label="Material Receipt Copy Attachments (max 3)"
                                attachments={form.materialReceiptAttachments}
                                onChange={(v) => set('materialReceiptAttachments', v)}
                            />
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-card-bg flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} className="bg-card-bg border border-border hover:bg-app-bg text-text-main font-semibold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary-hover text-sidebar-bg font-bold px-5 py-2 rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                            <ClipboardList size={14} />
                            {isSubmitting ? 'Saving...' : 'Log Material Receipt'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Inline Attribute Add Modal */}
            {attrModal.open && (
                <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-sm p-6 border border-border space-y-4 font-sans">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main">Add New: {attrModal.label}</h3>
                            <button type="button" onClick={() => setAttrModal({ open: false, type: '', label: '', value: '' })} className="text-text-muted hover:text-text-main cursor-pointer"><X size={16} /></button>
                        </div>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Enter option name"
                            value={attrModal.value}
                            onChange={(e) => setAttrModal((prev) => ({ ...prev, value: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAttrModalSave(); } }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button type="button" onClick={() => setAttrModal({ open: false, type: '', label: '', value: '' })} className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-app-bg transition-colors cursor-pointer">Cancel</button>
                            <button type="button" onClick={handleAttrModalSave} className="px-4 py-2 bg-primary text-sidebar-bg font-bold rounded-md text-xs hover:bg-primary-hover transition-colors cursor-pointer">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
