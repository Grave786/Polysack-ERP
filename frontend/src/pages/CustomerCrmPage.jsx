import { useState, useEffect, useRef, useCallback } from 'react';
import {
    PhoneCall, AlertTriangle, Plus, RefreshCw, ClipboardList,
    CheckCircle2, XCircle, Eye, Pencil, Trash2, AlertCircle,
    Upload, X as XIcon, FileText, Package
} from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import DetailViewModal from '../components/shared/DetailViewModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

// ── Attribute type keys matching rawMaterialAttributes.constants.js ──────────
const ATTR = {
    qualityFabric: 'materialQualityFabric',
    lamination: 'laminationType',
    colour: 'materialColour',
    grammage: 'fabricGrammage'
};

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY_ENQUIRY = {
    customer: '',
    enquiryDate: TODAY,
    productCategory: 'Print',
    printSides: 'BOTH',
    frontColours: 1,
    backColours: 1,
    jobDescriptionPrintColours: 'Front: 1-Color, Back: 1-Color',
    jobDescriptionPrintSide: 'Double Side',
    jobDescriptionPrintSideOther: '',
    materialQualityFabric: '',
    fabricLaminationType: '',
    materialColour: '',
    printingColour: '',
    fabricGrammage: '',
    bagWeightGms: '',
    fabricAverage: '',
    fabricWidthInch: '',
    fabricLengthInch: '',
    totalOrderQuantity: '',
    orderConfirmed: false,
    expectedDeliveryDate: '',
    contactPerson: '',
    contactNumber: '',
    contactDesignation: '',
    description: '',
    remarks: '',
    poAttachments: []
};

// ── Helper: Small inline "Add New Option" row for master dropdowns ────────────
function InlineAddOption({ attrType, onAdded }) {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (adding && inputRef.current) inputRef.current.focus();
    }, [adding]);

    const handleSave = async () => {
        const trimmed = val.trim();
        if (!trimmed) return;
        try {
            setSaving(true);
            const res = await axiosInstance.post('/raw-material-attributes', {
                attributeType: attrType,
                name: trimmed
            });
            if (res.data?.success) {
                toast.success(`'${trimmed}' added`);
                onAdded(res.data.data);
                setVal('');
                setAdding(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add option');
        } finally {
            setSaving(false);
        }
    };

    if (!adding) {
        return (
            <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1 hover:underline cursor-pointer"
            >
                <Plus size={11} /> Add New Option
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1.5 mt-1">
            <input
                ref={inputRef}
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } if (e.key === 'Escape') setAdding(false); }}
                placeholder="New option name…"
                className="flex-1 border border-border rounded p-1.5 text-[11px] bg-card-bg text-text-main focus:outline-none focus:border-primary"
            />
            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-2 py-1 bg-primary text-sidebar-bg rounded text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
                {saving ? '…' : 'Save'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="p-1 text-text-muted hover:text-text-main cursor-pointer">
                <XIcon size={13} />
            </button>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerCrmPage() {
    const [activeTab, setActiveTab] = useState('enquiries');
    const [isInteractionDrawerOpen, setIsInteractionDrawerOpen] = useState(false);
    const [isComplaintDrawerOpen, setIsComplaintDrawerOpen] = useState(false);
    const [isEnquiryDrawerOpen, setIsEnquiryDrawerOpen] = useState(false);
    const [editingEnquiry, setEditingEnquiry] = useState(null); // null = create, object = edit
    const [refreshKey, setRefreshKey] = useState(0);

    // Custom delete confirmation modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // View-detail modal
    const [viewingEnquiry, setViewingEnquiry] = useState(null);

    // Shared dropdown data
    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Shared RawMaterialAttribute lists
    const [attrFabricQuality, setAttrFabricQuality] = useState([]);
    const [attrLamination, setAttrLamination] = useState([]);
    const [attrColour, setAttrColour] = useState([]);
    const [attrGrammage, setAttrGrammage] = useState([]);
    const [isLoadingAttrs, setIsLoadingAttrs] = useState(false);

    // Tab counts
    const [interactionCount, setInteractionCount] = useState(0);
    const [complaintCount, setComplaintCount] = useState(0);
    const [enquiryCount, setEnquiryCount] = useState(0);

    // Interaction form
    const [interactionForm, setInteractionForm] = useState({
        customer: '', interactionType: 'CALL', subject: '',
        date: TODAY, assignedExecutive: '', status: 'OPEN', notes: '', nextFollowUpDate: ''
    });

    // Complaint form
    const [complaintForm, setComplaintForm] = useState({
        customer: '', complaintType: 'QUALITY_DEFECT', description: '',
        date: TODAY, assignedExecutive: '', status: 'OPEN', resolutionNotes: ''
    });

    // Enquiry form
    const [enquiryForm, setEnquiryForm] = useState({ ...EMPTY_ENQUIRY });
    const [isEnquiryDescManuallyEdited, setIsEnquiryDescManuallyEdited] = useState(false);

    // Auto-generate descriptive summary for Order Enquiry
    const generateEnquiryDescription = useCallback(() => {
        const parts = [];
        const custObj = customers.find((c) => String(c._id) === String(enquiryForm.customer));
        if (custObj) {
            parts.push(`Client: ${custObj.companyName || custObj.name || custObj.code}`);
        }
        if (enquiryForm.productCategory) {
            parts.push(`Category: ${enquiryForm.productCategory}`);
        }
        const fabricSpecs = [];
        if (enquiryForm.materialQualityFabric) fabricSpecs.push(enquiryForm.materialQualityFabric);
        if (enquiryForm.materialColour) fabricSpecs.push(enquiryForm.materialColour);
        if (enquiryForm.fabricGrammage) fabricSpecs.push(`${enquiryForm.fabricGrammage} GSM`);
        if (enquiryForm.fabricLaminationType) fabricSpecs.push(enquiryForm.fabricLaminationType);
        if (enquiryForm.fabricWidthInch && enquiryForm.fabricLengthInch) {
            fabricSpecs.push(`${enquiryForm.fabricWidthInch}" x ${enquiryForm.fabricLengthInch}"`);
        }
        if (fabricSpecs.length > 0) {
            parts.push(`Fabric: ${fabricSpecs.join(', ')}`);
        }
        if (enquiryForm.productCategory === 'Plain') {
            parts.push('Print: Plain / Unprinted');
        } else if (enquiryForm.printSides === 'BOTH') {
            parts.push(`Print: Front & Back (F: ${enquiryForm.frontColours || 1}-Col, B: ${enquiryForm.backColours || 1}-Col${enquiryForm.printingColour ? ` ${enquiryForm.printingColour}` : ''})`);
        } else if (enquiryForm.printSides === 'FRONT_ONLY') {
            parts.push(`Print: Front Only (${enquiryForm.frontColours || 1}-Col${enquiryForm.printingColour ? ` ${enquiryForm.printingColour}` : ''})`);
        } else if (enquiryForm.printSides === 'BACK_ONLY') {
            parts.push(`Print: Back Only (${enquiryForm.backColours || 1}-Col${enquiryForm.printingColour ? ` ${enquiryForm.printingColour}` : ''})`);
        }
        if (enquiryForm.totalOrderQuantity) {
            parts.push(`Qty: ${Number(enquiryForm.totalOrderQuantity).toLocaleString('en-IN')} Bags`);
        }
        return parts.join(' | ');
    }, [enquiryForm, customers]);

    // Auto-generate description whenever key enquiry specs change unless user manually typed
    useEffect(() => {
        if (!isEnquiryDescManuallyEdited && isEnquiryDrawerOpen) {
            const autoText = generateEnquiryDescription();
            if (autoText) {
                setEnquiryForm((prev) => {
                    if (prev.description === autoText) return prev;
                    return { ...prev, description: autoText };
                });
            }
        }
    }, [
        enquiryForm.customer, enquiryForm.productCategory, enquiryForm.materialQualityFabric,
        enquiryForm.materialColour, enquiryForm.printingColour, enquiryForm.fabricGrammage,
        enquiryForm.fabricLaminationType, enquiryForm.fabricWidthInch, enquiryForm.fabricLengthInch,
        enquiryForm.printSides, enquiryForm.frontColours, enquiryForm.backColours,
        enquiryForm.totalOrderQuantity, isEnquiryDescManuallyEdited, isEnquiryDrawerOpen,
        generateEnquiryDescription
    ]);

    // ── Fetch customers + users when any drawer opens ──────────────────────────
    useEffect(() => {
        if (isInteractionDrawerOpen || isComplaintDrawerOpen || isEnquiryDrawerOpen) {
            setIsLoadingDropdowns(true);
            Promise.all([
                axiosInstance.get('/customers?isActive=true&status=ACTIVE_CUSTOMER&limit=200'),
                axiosInstance.get('/users?limit=100')
            ])
                .then(([custRes, userRes]) => {
                    if (custRes.data?.success && Array.isArray(custRes.data.data)) {
                        const custs = custRes.data.data;
                        setCustomers(custs);
                        if (custs.length > 0 && !editingEnquiry) {
                            setInteractionForm((p) => ({ ...p, customer: p.customer || custs[0]._id }));
                            setComplaintForm((p) => ({ ...p, customer: p.customer || custs[0]._id }));
                            setEnquiryForm((p) => ({ ...p, customer: p.customer || custs[0]._id }));
                        }
                    }
                    if (userRes.data?.success && Array.isArray(userRes.data.data)) {
                        const usrList = userRes.data.data;
                        setUsers(usrList);
                        if (usrList.length > 0) {
                            setInteractionForm((p) => ({ ...p, assignedExecutive: p.assignedExecutive || usrList[0]._id }));
                            setComplaintForm((p) => ({ ...p, assignedExecutive: p.assignedExecutive || usrList[0]._id }));
                        }
                    }
                })
                .catch(() => toast.error('Failed to load customers or sales executive catalog'))
                .finally(() => setIsLoadingDropdowns(false));
        }
    }, [isInteractionDrawerOpen, isComplaintDrawerOpen, isEnquiryDrawerOpen]);

    // ── Fetch shared material attributes when enquiry drawer opens ─────────────
    useEffect(() => {
        if (!isEnquiryDrawerOpen) return;
        setIsLoadingAttrs(true);
        axiosInstance.get('/raw-material-attributes')
            .then((res) => {
                if (res.data?.success) {
                    const grouped = res.data.data || {};
                    setAttrFabricQuality(grouped[ATTR.qualityFabric] || []);
                    setAttrLamination(grouped[ATTR.lamination] || []);
                    setAttrColour(grouped[ATTR.colour] || []);
                    setAttrGrammage(grouped[ATTR.grammage] || []);
                }
            })
            .catch(() => toast.error('Failed to load material attribute masters'))
            .finally(() => setIsLoadingAttrs(false));
    }, [isEnquiryDrawerOpen]);

    // ── Auto-fill contact fields when customer changes ─────────────────────────
    const handleEnquiryCustomerChange = useCallback((custId) => {
        const cust = customers.find((c) => c._id === custId);
        setEnquiryForm((prev) => ({
            ...prev,
            customer: custId,
            contactPerson: prev.contactPerson || cust?.contactPerson || '',
            contactNumber: prev.contactNumber || cust?.phone || '',
            contactDesignation: prev.contactDesignation || ''
        }));
    }, [customers]);

    // ── File upload handler ────────────────────────────────────────────────────
    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files || []);
        const current = enquiryForm.poAttachments || [];
        const remaining = 5 - current.length;
        if (remaining <= 0) {
            toast.error('Maximum 5 attachments allowed');
            return;
        }
        const toProcess = files.slice(0, remaining);
        const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
        const readers = toProcess.map((file) => new Promise((resolve) => {
            if (file.size > MAX_SIZE) {
                toast.error(`${file.name} exceeds 10 MB limit`);
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => resolve({
                name: file.name,
                data: ev.target.result,
                size: file.size,
                mimeType: file.type
            });
            reader.readAsDataURL(file);
        }));
        Promise.all(readers).then((results) => {
            const valid = results.filter(Boolean);
            setEnquiryForm((prev) => ({
                ...prev,
                poAttachments: [...(prev.poAttachments || []), ...valid]
            }));
        });
        e.target.value = '';
    };

    const removeAttachment = (idx) => {
        setEnquiryForm((prev) => ({
            ...prev,
            poAttachments: prev.poAttachments.filter((_, i) => i !== idx)
        }));
    };

    // ── Submit Interaction ────────────────────────────────────────────────────
    const handleSubmitInteraction = async (e) => {
        e.preventDefault();
        if (!interactionForm.customer || !interactionForm.subject.trim()) {
            toast.error('Please select a Customer and enter a Subject');
            return;
        }
        try {
            setIsSubmitting(true);
            const res = await axiosInstance.post('/crm/interactions', {
                customer: interactionForm.customer,
                interactionType: interactionForm.interactionType,
                subject: interactionForm.subject.trim(),
                date: interactionForm.date || new Date(),
                assignedExecutive: interactionForm.assignedExecutive || undefined,
                status: interactionForm.status,
                notes: interactionForm.notes.trim(),
                nextFollowUpDate: interactionForm.nextFollowUpDate || undefined
            });
            if (res.data?.success) {
                toast.success('Customer interaction logged successfully!');
                setIsInteractionDrawerOpen(false);
                setInteractionForm({ customer: customers[0]?._id || '', interactionType: 'CALL', subject: '', date: TODAY, assignedExecutive: users[0]?._id || '', status: 'OPEN', notes: '', nextFollowUpDate: '' });
                setRefreshKey((p) => p + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to log customer interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Submit Complaint ──────────────────────────────────────────────────────
    const handleSubmitComplaint = async (e) => {
        e.preventDefault();
        if (!complaintForm.customer || !complaintForm.description.trim()) {
            toast.error('Please select a Customer and provide a Description');
            return;
        }
        try {
            setIsSubmitting(true);
            const res = await axiosInstance.post('/crm/complaints', {
                customer: complaintForm.customer,
                complaintType: complaintForm.complaintType,
                description: complaintForm.description.trim(),
                date: complaintForm.date || new Date(),
                assignedExecutive: complaintForm.assignedExecutive || undefined,
                status: complaintForm.status,
                resolutionNotes: complaintForm.resolutionNotes.trim()
            });
            if (res.data?.success) {
                toast.success(`Complaint ticket '${res.data.data?.ticketNumber || 'COMP-TICKET'}' filed successfully!`);
                setIsComplaintDrawerOpen(false);
                setComplaintForm({ customer: customers[0]?._id || '', complaintType: 'QUALITY_DEFECT', description: '', date: TODAY, assignedExecutive: users[0]?._id || '', status: 'OPEN', resolutionNotes: '' });
                setRefreshKey((p) => p + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to file complaint ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Submit / Update Enquiry ───────────────────────────────────────────────
    const handleSubmitEnquiry = async (e) => {
        e.preventDefault();
        if (!enquiryForm.customer) {
            toast.error('Please select a Customer');
            return;
        }
        if (!enquiryForm.productCategory) {
            toast.error('Please select a Product Category');
            return;
        }
        if (enquiryForm.orderConfirmed && !enquiryForm.expectedDeliveryDate) {
            toast.error('Expected Delivery Date is required when Order is Confirmed');
            return;
        }

        const payload = {
            customer: enquiryForm.customer,
            enquiryDate: enquiryForm.enquiryDate || TODAY,
            productCategory: enquiryForm.productCategory,
            printSpec: {
                printSides: enquiryForm.productCategory === 'Plain' ? 'NONE' : enquiryForm.printSides,
                frontColours: enquiryForm.productCategory === 'Plain' ? 0 : ((enquiryForm.printSides === 'FRONT_ONLY' || enquiryForm.printSides === 'BOTH') ? (Number(enquiryForm.frontColours) || 1) : 0),
                backColours: enquiryForm.productCategory === 'Plain' ? 0 : ((enquiryForm.printSides === 'BACK_ONLY' || enquiryForm.printSides === 'BOTH') ? (Number(enquiryForm.backColours) || 1) : 0)
            },
            printSides: enquiryForm.productCategory === 'Plain' ? 'NONE' : enquiryForm.printSides,
            frontColours: enquiryForm.productCategory === 'Plain' ? 0 : ((enquiryForm.printSides === 'FRONT_ONLY' || enquiryForm.printSides === 'BOTH') ? (Number(enquiryForm.frontColours) || 1) : 0),
            backColours: enquiryForm.productCategory === 'Plain' ? 0 : ((enquiryForm.printSides === 'BACK_ONLY' || enquiryForm.printSides === 'BOTH') ? (Number(enquiryForm.backColours) || 1) : 0),
            jobDescriptionPrintColours: enquiryForm.productCategory === 'Plain'
                ? 'No Colour or Plain'
                : (enquiryForm.printSides === 'BOTH'
                    ? `Front: ${enquiryForm.frontColours || 1}-Color, Back: ${enquiryForm.backColours || 1}-Color`
                    : (enquiryForm.printSides === 'FRONT_ONLY' ? `Front: ${enquiryForm.frontColours || 1}-Color` : `Back: ${enquiryForm.backColours || 1}-Color`)),
            jobDescriptionPrintSide: enquiryForm.productCategory === 'Plain'
                ? 'Only Plain'
                : (enquiryForm.printSides === 'BOTH' ? 'Double Side' : 'Single Side'),
            jobDescriptionPrintSideOther: '',
            materialQualityFabric: enquiryForm.materialQualityFabric,
            fabricLaminationType: enquiryForm.fabricLaminationType,
            materialColour: enquiryForm.materialColour,
            printingColour: enquiryForm.printingColour,
            fabricGrammage: enquiryForm.fabricGrammage,
            bagWeightGms: enquiryForm.bagWeightGms !== '' ? Number(enquiryForm.bagWeightGms) : null,
            fabricAverage: enquiryForm.fabricAverage.trim(),
            fabricWidthInch: enquiryForm.fabricWidthInch !== '' ? Number(enquiryForm.fabricWidthInch) : null,
            fabricLengthInch: enquiryForm.fabricLengthInch !== '' ? Number(enquiryForm.fabricLengthInch) : null,
            totalOrderQuantity: enquiryForm.totalOrderQuantity !== '' ? Number(enquiryForm.totalOrderQuantity) : null,
            orderConfirmed: enquiryForm.orderConfirmed,
            expectedDeliveryDate: enquiryForm.orderConfirmed ? enquiryForm.expectedDeliveryDate : '',
            contactPerson: enquiryForm.contactPerson.trim(),
            contactNumber: enquiryForm.contactNumber.trim(),
            contactDesignation: enquiryForm.contactDesignation.trim(),
            description: enquiryForm.description ? enquiryForm.description.trim() : '',
            remarks: enquiryForm.description ? enquiryForm.description.trim() : '',
            poAttachments: enquiryForm.poAttachments || []
        };

        try {
            setIsSubmitting(true);
            let res;
            if (editingEnquiry) {
                res = await axiosInstance.put(`/crm/enquiries/${editingEnquiry._id}`, payload);
            } else {
                res = await axiosInstance.post('/crm/enquiries', payload);
            }
            if (res.data?.success) {
                toast.success(editingEnquiry ? 'Order enquiry updated!' : 'Order enquiry logged!');
                setIsEnquiryDrawerOpen(false);
                setEditingEnquiry(null);
                setEnquiryForm({ ...EMPTY_ENQUIRY, customer: customers[0]?._id || '' });
                setIsEnquiryDescManuallyEdited(false);
                setRefreshKey((p) => p + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save order enquiry');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Delete Enquiry — opens custom modal ───────────────────────────────────
    const handleDeleteEnquiry = (row) => {
        setRecordToDelete(row);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;
        try {
            await axiosInstance.delete(`/crm/enquiries/${recordToDelete._id}`);
            toast.success('Order enquiry deleted');
            setRefreshKey((p) => p + 1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete enquiry');
        } finally {
            setDeleteModalOpen(false);
            setRecordToDelete(null);
        }
    };

    // ── Open Edit Drawer ──────────────────────────────────────────────────────
    const handleEditEnquiry = (row) => {
        setEditingEnquiry(row);
        const existingDesc = row.description || row.remarks || '';
        setEnquiryForm({
            customer: typeof row.customer === 'object' ? row.customer._id : row.customer,
            enquiryDate: row.enquiryDate ? row.enquiryDate.split('T')[0] : TODAY,
            productCategory: row.productCategory || 'Print',
            printSides: row.printSides || row.printSpec?.printSides || 'BOTH',
            frontColours: row.frontColours !== undefined ? row.frontColours : (row.printSpec?.frontColours || 1),
            backColours: row.backColours !== undefined ? row.backColours : (row.printSpec?.backColours || 1),
            jobDescriptionPrintColours: row.jobDescriptionPrintColours || '',
            jobDescriptionPrintSide: row.jobDescriptionPrintSide || '',
            jobDescriptionPrintSideOther: row.jobDescriptionPrintSideOther || '',
            materialQualityFabric: row.materialQualityFabric || '',
            fabricLaminationType: row.fabricLaminationType || '',
            materialColour: row.materialColour || '',
            printingColour: row.printingColour || '',
            fabricGrammage: row.fabricGrammage || '',
            bagWeightGms: row.bagWeightGms ?? '',
            fabricAverage: row.fabricAverage || '',
            fabricWidthInch: row.fabricWidthInch ?? '',
            fabricLengthInch: row.fabricLengthInch ?? '',
            totalOrderQuantity: row.totalOrderQuantity ?? '',
            orderConfirmed: row.orderConfirmed || false,
            expectedDeliveryDate: row.expectedDeliveryDate ? row.expectedDeliveryDate.split('T')[0] : '',
            contactPerson: row.contactPerson || '',
            contactNumber: row.contactNumber || '',
            contactDesignation: row.contactDesignation || '',
            description: existingDesc,
            remarks: existingDesc,
            poAttachments: row.poAttachments || []
        });
        setIsEnquiryDescManuallyEdited(Boolean(existingDesc));
        setIsEnquiryDrawerOpen(true);
    };

    // ── Column definitions ────────────────────────────────────────────────────
    const followUpColumns = [
        {
            header: 'CUSTOMER',
            render: (row) => {
                const c = typeof row.customer === 'object' ? row.customer : null;
                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{c?.companyName || row.customerName || 'Retail Client'}</div>
                        {c?.code && <div className="text-[10px] font-mono text-text-muted">{c.code}</div>}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'DATE',
            render: (row) => {
                const d = row.date || row.createdAt;
                return <span className="font-mono text-xs text-text-main">{d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>;
            },
            sortable: true
        },
        {
            header: 'INTERACTION TYPE',
            render: (row) => {
                const type = row.interactionType || 'Phone Call';
                let s = 'bg-amber-50 text-amber-800 border-amber-200';
                if (type.includes('Email')) s = 'bg-blue-50 text-blue-800 border-blue-200';
                if (type.includes('Meeting') || type.includes('In-Person')) s = 'bg-purple-50 text-purple-800 border-purple-200';
                if (type.includes('Visit') || type.includes('Escalation')) s = 'bg-rose-50 text-rose-800 border-rose-200';
                return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${s}`}>{type}</span>;
            }
        },
        {
            header: 'SUBJECT',
            render: (row) => <span className="font-semibold text-text-main text-xs truncate max-w-xs block" title={row.subject}>{row.subject || '-'}</span>
        },
        {
            header: 'ASSIGNED EXECUTIVE',
            render: (row) => {
                const ex = typeof row.assignedExecutive === 'object' ? row.assignedExecutive : null;
                return <span className="font-semibold text-text-main text-xs">{ex?.name || row.assignedTo || 'Unassigned'}</span>;
            }
        },
        {
            header: 'STATUS',
            render: (row) => {
                const st = (row.status || 'OPEN').toUpperCase();
                let dot = 'bg-amber-500', badge = 'bg-amber-50 text-amber-800 border-amber-200', label = 'Open';
                if (st === 'IN_PROGRESS') { dot = 'bg-blue-500'; badge = 'bg-blue-50 text-blue-800 border-blue-200'; label = 'In Progress'; }
                if (st === 'RESOLVED' || st === 'CLOSED') { dot = 'bg-emerald-500'; badge = 'bg-emerald-50 text-emerald-800 border-emerald-200'; label = 'Resolved'; }
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /><span>{label}</span>
                    </div>
                );
            }
        }
    ];

    const complaintColumns = [
        { header: 'TICKET #', render: (row) => <span className="font-mono font-bold uppercase text-text-main text-xs">{row.ticketNumber || 'COMP-001'}</span>, sortable: true },
        { header: 'CUSTOMER', render: (row) => { const c = typeof row.customer === 'object' ? row.customer : null; return <span className="font-extrabold text-text-main text-xs">{c?.companyName || '-'}</span>; } },
        { header: 'COMPLAINT TYPE', render: (row) => <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">{row.complaintType || 'Quality Defect'}</span> },
        { header: 'DESCRIPTION', render: (row) => <span className="text-xs text-text-muted max-w-xs block truncate" title={row.description}>{row.description || '-'}</span> },
        { header: 'ASSIGNED EXECUTIVE', render: (row) => { const ex = typeof row.assignedExecutive === 'object' ? row.assignedExecutive : null; return <span className="font-semibold text-text-main text-xs">{ex?.name || 'Quality Lead'}</span>; } },
        {
            header: 'STATUS',
            render: (row) => {
                const st = (row.status || 'OPEN').toUpperCase();
                const ok = st === 'RESOLVED' || st === 'CLOSED';
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} /><span>{ok ? 'Resolved' : 'Open Ticket'}</span>
                    </div>
                );
            }
        }
    ];

    const enquiryColumns = [
        {
            header: 'CUSTOMER',
            render: (row) => {
                const c = typeof row.customer === 'object' ? row.customer : null;
                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{c?.companyName || '-'}</div>
                        {c?.code && <div className="text-[10px] font-mono text-text-muted">{c.code}</div>}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'CUSTOMER REQUIREMENT',
            title: 'CUSTOMER REQUIREMENT',
            render: (row) => {
                const desc = row.description || row.remarks || '-';
                return (
                    <div className="text-xs text-gray-800 whitespace-normal break-words line-clamp-3 min-w-[250px]" title={desc}>
                        {desc}
                    </div>
                );
            }
        },
        {
            header: 'ENQUIRY DATE',
            render: (row) => {
                const d = row.enquiryDate || row.createdAt;
                return <span className="font-mono text-xs text-text-main">{d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>;
            },
            sortable: true
        },
        {
            header: 'CATEGORY',
            render: (row) => {
                const cat = row.productCategory || '-';
                const isPrint = cat === 'Print';
                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${isPrint ? 'bg-violet-50 text-violet-800 border-violet-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {cat}
                    </span>
                );
            }
        },
        {
            header: 'FABRIC / LAMINATION',
            render: (row) => (
                <div className="text-xs leading-tight">
                    <div className="font-semibold text-text-main">{row.materialQualityFabric || '-'}</div>
                    {row.fabricLaminationType && <div className="text-[10px] text-text-muted">{row.fabricLaminationType}</div>}
                </div>
            )
        },
        {
            header: 'TOTAL QTY',
            render: (row) => (
                <span className="font-mono font-bold text-text-main text-xs">
                    {row.totalOrderQuantity != null ? row.totalOrderQuantity.toLocaleString('en-IN') : '-'}
                </span>
            )
        },
        {
            header: 'CONFIRMED',
            render: (row) => row.orderConfirmed
                ? (
                    <div className="flex flex-col items-start gap-0.5">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={10} /> Yes
                        </div>
                        {row.expectedDeliveryDate && (
                            <span className="text-[10px] font-mono text-text-muted">
                                {new Date(row.expectedDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <XCircle size={10} /> Pending
                    </div>
                )
        },
        {
            header: 'ACTIONS',
            render: (row) => (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="View Details"
                        onClick={() => setViewingEnquiry(row)}
                        className="p-1.5 text-text-muted hover:text-sky-600 rounded-md hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                        <Eye size={13} />
                    </button>
                    <button
                        type="button"
                        title="Edit"
                        onClick={() => handleEditEnquiry(row)}
                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDeleteEnquiry(row)}
                        className="p-1.5 text-text-muted hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )
        }
    ];

    // ── Tab definitions — Order Enquiries is first/default ───────────────────
    const tabs = [
        { key: 'enquiries', label: `Order Enquiries (${enquiryCount})`, resourcePath: '/crm/enquiries', columns: enquiryColumns },
        { key: 'follow-ups', label: `Follow-up Logs (${interactionCount})`, resourcePath: '/crm/interactions', columns: followUpColumns },
        { key: 'complaints', label: `Quality & Delivery Complaints (${complaintCount})`, resourcePath: '/crm/complaints', columns: complaintColumns }
    ];

    // ── Header action button ──────────────────────────────────────────────────
    const headerButton = (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
            {activeTab === 'complaints' ? (
                <button
                    type="button"
                    onClick={() => setIsComplaintDrawerOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <AlertTriangle size={15} /><span>+ File Complaint Ticket</span>
                </button>
            ) : activeTab === 'enquiries' ? (
                <button
                    type="button"
                    onClick={() => { setEditingEnquiry(null); setEnquiryForm({ ...EMPTY_ENQUIRY }); setIsEnquiryDrawerOpen(true); }}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <ClipboardList size={15} /><span>+ Log Order Enquiry</span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsInteractionDrawerOpen(true)}
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer"
                >
                    <PhoneCall size={15} /><span>+ Log Customer Interaction</span>
                </button>
            )}
        </div>
    );

    // ── Shared label style ─────────────────────────────────────────────────────
    const lbl = 'block text-xs font-bold uppercase tracking-wider text-text-main mb-1';
    const inp = 'w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans';
    const sel = `${inp} cursor-pointer`;

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Customer CRM & Complaint Management"
                description="Sales Follow-ups, Order Enquiries, Key Buyer History & Defect Escalation Handling"
                tabs={tabs}
                activeTabKey={activeTab}
                onTabChange={(key) => setActiveTab(key)}
                headerActions={headerButton}
            />

            {/* ─── Drawer 1: Log Customer Interaction ────────────────────────── */}
            <SlideOverPanel
                isOpen={isInteractionDrawerOpen}
                onClose={() => setIsInteractionDrawerOpen(false)}
                title="Log Customer Interaction & Follow-up"
                subtitle="Record phone call, meeting notes, sales follow-up and assign sales representative"
            >
                <form onSubmit={handleSubmitInteraction} className="space-y-4 font-sans text-xs">
                    {isLoadingDropdowns ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-amber-500" /><span>Loading customers & sales team list...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className={lbl}>Select Customer Master *</label>
                                <select required value={interactionForm.customer} onChange={(e) => setInteractionForm({ ...interactionForm, customer: e.target.value })} className={sel}>
                                    {customers.map((c) => <option key={c._id} value={c._id}>{c.code || 'CUST'} - {c.companyName || c.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Interaction Type *</label>
                                    <select required value={interactionForm.interactionType} onChange={(e) => setInteractionForm({ ...interactionForm, interactionType: e.target.value })} className={sel}>
                                        <option value="CALL">Phone Call</option>
                                        <option value="EMAIL">Email Communication</option>
                                        <option value="MEETING">In-Person Meeting</option>
                                        <option value="VISIT">Factory Visit</option>
                                        <option value="FOLLOW_UP">Follow Up</option>
                                        <option value="OTHER">Other / Escalation</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Interaction Date *</label>
                                    <input type="date" required value={interactionForm.date} onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })} className={inp} />
                                </div>
                            </div>

                            <div>
                                <label className={lbl}>Subject / Key Agenda *</label>
                                <input type="text" required placeholder="e.g. Monthly order commitment & pricing discussion" value={interactionForm.subject} onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })} className={inp} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Assigned Sales Executive</label>
                                    <select value={interactionForm.assignedExecutive} onChange={(e) => setInteractionForm({ ...interactionForm, assignedExecutive: e.target.value })} className={sel}>
                                        {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role?.name || u.role || 'Executive'})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Status *</label>
                                    <select required value={interactionForm.status} onChange={(e) => setInteractionForm({ ...interactionForm, status: e.target.value })} className={sel}>
                                        <option value="OPEN">Open (Requires Follow-up)</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="RESOLVED">Resolved / Complete</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={lbl}>Notes & Detailed Minutes of Meeting</label>
                                <textarea rows={4} placeholder="Enter detailed discussion points, customer feedback, quantity commitments..." value={interactionForm.notes} onChange={(e) => setInteractionForm({ ...interactionForm, notes: e.target.value })} className={inp} />
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button type="button" onClick={() => setIsInteractionDrawerOpen(false)} className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                    <PhoneCall size={15} /><span>{isSubmitting ? 'Saving...' : 'Save Interaction Log'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* ─── Drawer 2: File Complaint Ticket ───────────────────────────── */}
            <SlideOverPanel
                isOpen={isComplaintDrawerOpen}
                onClose={() => setIsComplaintDrawerOpen(false)}
                title="File Quality & Delivery Complaint"
                subtitle="Escalate customer defect complaints, bag bursting, or delivery delay tickets"
            >
                <form onSubmit={handleSubmitComplaint} className="space-y-4 font-sans text-xs">
                    {isLoadingDropdowns ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-rose-500" /><span>Loading options...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className={lbl}>Customer Master *</label>
                                <select required value={complaintForm.customer} onChange={(e) => setComplaintForm({ ...complaintForm, customer: e.target.value })} className={sel}>
                                    {customers.map((c) => <option key={c._id} value={c._id}>{c.code || 'CUST'} - {c.companyName || c.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Complaint Type *</label>
                                    <select required value={complaintForm.complaintType} onChange={(e) => setComplaintForm({ ...complaintForm, complaintType: e.target.value })} className={sel}>
                                        <option value="QUALITY_DEFECT">Bag Burst / Stitching Defect</option>
                                        <option value="DELIVERY_DELAY">Delivery Delay / Logistics</option>
                                        <option value="QUANTITY_MISMATCH">Shortage / Quantity Mismatch</option>
                                        <option value="PACKAGING_DAMAGE">Bale Damage / Wet Bags</option>
                                        <option value="PRICE_DISCREPANCY">Invoice / Rate Discrepancy</option>
                                        <option value="OTHER">Other Issue</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Incident Date *</label>
                                    <input type="date" required value={complaintForm.date} onChange={(e) => setComplaintForm({ ...complaintForm, date: e.target.value })} className={inp} />
                                </div>
                            </div>

                            <div>
                                <label className={lbl}>Complaint Description *</label>
                                <textarea required rows={4} placeholder="Describe defect in detail (e.g. 50 bags burst during automated filling at customer site...)" value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} className={inp} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Assign Executive / Quality Lead</label>
                                    <select value={complaintForm.assignedExecutive} onChange={(e) => setComplaintForm({ ...complaintForm, assignedExecutive: e.target.value })} className={sel}>
                                        {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role?.name || u.role || 'Executive'})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Initial Ticket Status *</label>
                                    <select required value={complaintForm.status} onChange={(e) => setComplaintForm({ ...complaintForm, status: e.target.value })} className={sel}>
                                        <option value="OPEN">Open Ticket</option>
                                        <option value="INVESTIGATING">Under Investigation</option>
                                        <option value="RESOLVED">Resolved / CAPA Issued</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button type="button" onClick={() => setIsComplaintDrawerOpen(false)} className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                    <AlertTriangle size={15} /><span>{isSubmitting ? 'Filing Ticket...' : 'File Complaint Ticket'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* ─── Drawer 3: Log / Edit Order Enquiry ────────────────────────── */}
            <SlideOverPanel
                isOpen={isEnquiryDrawerOpen}
                onClose={() => { setIsEnquiryDrawerOpen(false); setEditingEnquiry(null); }}
                title={editingEnquiry ? 'Edit Order Enquiry' : 'Log New Order Enquiry'}
                subtitle="Capture customer job-order specifications — tied to Customer Master"
                widthClass="w-full max-w-full sm:max-w-2xl"
            >
                <form onSubmit={handleSubmitEnquiry} className="space-y-5 font-sans text-xs">
                    {(isLoadingDropdowns || isLoadingAttrs) ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-primary" /><span>Loading masters...</span>
                        </div>
                    ) : (
                        <>
                            {/* ── Section: Customer & Date ──────────────────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Customer & Enquiry Info</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className={lbl}>Customer *</label>
                                        <select
                                            required
                                            value={enquiryForm.customer}
                                            onChange={(e) => handleEnquiryCustomerChange(e.target.value)}
                                            className={sel}
                                        >
                                            <option value="">— Select Customer —</option>
                                            {customers.map((c) => (
                                                <option key={c._id} value={c._id}>{c.code || 'CUST'} — {c.companyName || c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lbl}>Enquiry Date</label>
                                        <input type="date" value={enquiryForm.enquiryDate} onChange={(e) => setEnquiryForm((p) => ({ ...p, enquiryDate: e.target.value }))} className={inp} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className={lbl}>Contact Person</label>
                                        <input type="text" placeholder="Auto-filled or override" value={enquiryForm.contactPerson} onChange={(e) => setEnquiryForm((p) => ({ ...p, contactPerson: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Contact Number</label>
                                        <input type="text" placeholder="+91 98765 43210" value={enquiryForm.contactNumber} onChange={(e) => setEnquiryForm((p) => ({ ...p, contactNumber: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Designation</label>
                                        <input type="text" placeholder="e.g. Purchase Manager" value={enquiryForm.contactDesignation} onChange={(e) => setEnquiryForm((p) => ({ ...p, contactDesignation: e.target.value }))} className={inp} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Section: Product Specification ──────────────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Product Specification</p>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className={lbl}>Product Category *</label>
                                            <select required value={enquiryForm.productCategory} onChange={(e) => setEnquiryForm((p) => ({ ...p, productCategory: e.target.value }))} className={sel}>
                                                <option value="Print">Print</option>
                                                <option value="Plain">Plain</option>
                                            </select>
                                        </div>

                                        {enquiryForm.productCategory === 'Print' && (
                                            <div>
                                                <label className={lbl}>Print Sides *</label>
                                                <select
                                                    value={enquiryForm.printSides || 'BOTH'}
                                                    onChange={(e) => setEnquiryForm((p) => ({ ...p, printSides: e.target.value }))}
                                                    className={sel}
                                                >
                                                    <option value="BOTH">Both Sides (Front & Back)</option>
                                                    <option value="FRONT_ONLY">Front Only</option>
                                                    <option value="BACK_ONLY">Back Only</option>
                                                    <option value="NONE">None (Plain)</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {enquiryForm.productCategory === 'Print' && (enquiryForm.printSides === 'FRONT_ONLY' || enquiryForm.printSides === 'BACK_ONLY' || enquiryForm.printSides === 'BOTH') && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-card-bg border border-border rounded-lg">
                                            {(enquiryForm.printSides === 'FRONT_ONLY' || enquiryForm.printSides === 'BOTH') && (
                                                <div>
                                                    <label className={lbl}>Front Colours (Qty) *</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="8"
                                                        value={enquiryForm.frontColours}
                                                        onChange={(e) => setEnquiryForm((p) => ({ ...p, frontColours: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                                        className={inp}
                                                    />
                                                </div>
                                            )}

                                            {(enquiryForm.printSides === 'BACK_ONLY' || enquiryForm.printSides === 'BOTH') && (
                                                <div>
                                                    <label className={lbl}>Back Colours (Qty) *</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="8"
                                                        value={enquiryForm.backColours}
                                                        onChange={(e) => setEnquiryForm((p) => ({ ...p, backColours: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                                        className={inp}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Section: Material Masters ──────────────────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Material Masters</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                    {/* Material Quality Fabric */}
                                    <div>
                                        <label className={lbl}>Material Quality — Fabric</label>
                                        <select value={enquiryForm.materialQualityFabric} onChange={(e) => setEnquiryForm((p) => ({ ...p, materialQualityFabric: e.target.value }))} className={sel}>
                                            <option value="">— Select —</option>
                                            {attrFabricQuality.map((a) => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                        <InlineAddOption attrType={ATTR.qualityFabric} onAdded={(item) => setAttrFabricQuality((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))} />
                                    </div>

                                    {/* Lamination Type */}
                                    <div>
                                        <label className={lbl}>Fabric Lamination Type</label>
                                        <select value={enquiryForm.fabricLaminationType} onChange={(e) => setEnquiryForm((p) => ({ ...p, fabricLaminationType: e.target.value }))} className={sel}>
                                            <option value="">— Select —</option>
                                            {attrLamination.map((a) => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                        <InlineAddOption attrType={ATTR.lamination} onAdded={(item) => setAttrLamination((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))} />
                                    </div>

                                    {/* Material Colour */}
                                    <div>
                                        <label className={lbl}>Material Colour</label>
                                        <select value={enquiryForm.materialColour} onChange={(e) => setEnquiryForm((p) => ({ ...p, materialColour: e.target.value }))} className={sel}>
                                            <option value="">— Select —</option>
                                            {attrColour.map((a) => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                        <InlineAddOption attrType={ATTR.colour} onAdded={(item) => setAttrColour((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))} />
                                    </div>

                                    {/* Printing Colour */}
                                    <div>
                                        <label className={lbl}>Printing Colour</label>
                                        <select value={enquiryForm.printingColour} onChange={(e) => setEnquiryForm((p) => ({ ...p, printingColour: e.target.value }))} className={sel}>
                                            <option value="">— Select —</option>
                                            {attrColour.map((a) => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Fabric Grammage */}
                                    <div>
                                        <label className={lbl}>Fabric Grammage</label>
                                        <select value={enquiryForm.fabricGrammage} onChange={(e) => setEnquiryForm((p) => ({ ...p, fabricGrammage: e.target.value }))} className={sel}>
                                            <option value="">— Select —</option>
                                            {attrGrammage.map((a) => <option key={a._id} value={a.name}>{a.name}</option>)}
                                        </select>
                                        <InlineAddOption attrType={ATTR.grammage} onAdded={(item) => setAttrGrammage((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Section: Physical Specs ──────────────────────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Physical Specifications</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className={lbl}>Bag Weight (Gms)</label>
                                        <input type="number" min="0" step="0.01" placeholder="0.00" value={enquiryForm.bagWeightGms} onChange={(e) => setEnquiryForm((p) => ({ ...p, bagWeightGms: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Fabric Average</label>
                                        <input type="text" placeholder="e.g. 65" value={enquiryForm.fabricAverage} onChange={(e) => setEnquiryForm((p) => ({ ...p, fabricAverage: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Width (Inch)</label>
                                        <input type="number" min="0" step="0.5" placeholder="e.g. 14" value={enquiryForm.fabricWidthInch} onChange={(e) => setEnquiryForm((p) => ({ ...p, fabricWidthInch: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Length (Inch)</label>
                                        <input type="number" min="0" step="0.5" placeholder="e.g. 24" value={enquiryForm.fabricLengthInch} onChange={(e) => setEnquiryForm((p) => ({ ...p, fabricLengthInch: e.target.value }))} className={inp} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Section: Order Quantity & Confirmation ──────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Order Quantity & Confirmation</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className={lbl}>Total Order Quantity (Kgs / Pcs)</label>
                                        <input type="number" min="0" placeholder="e.g. 10000" value={enquiryForm.totalOrderQuantity} onChange={(e) => setEnquiryForm((p) => ({ ...p, totalOrderQuantity: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Order Confirmed?</label>
                                        <div className="flex items-center gap-4 mt-2.5">
                                            {[{ val: true, label: 'Yes — Confirmed' }, { val: false, label: 'No — Pending' }].map(({ val, label }) => (
                                                <label key={String(val)} className="flex items-center gap-1.5 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="orderConfirmed"
                                                        checked={enquiryForm.orderConfirmed === val}
                                                        onChange={() => setEnquiryForm((p) => ({ ...p, orderConfirmed: val, expectedDeliveryDate: val ? p.expectedDeliveryDate : '' }))}
                                                        className="accent-primary"
                                                    />
                                                    <span className="font-semibold text-text-main">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {enquiryForm.orderConfirmed && (
                                    <div className="max-w-xs">
                                        <label className={lbl}>Expected Delivery Date *</label>
                                        <input
                                            type="date"
                                            required
                                            min={TODAY}
                                            value={enquiryForm.expectedDeliveryDate}
                                            onChange={(e) => setEnquiryForm((p) => ({ ...p, expectedDeliveryDate: e.target.value }))}
                                            className={inp}
                                        />
                                        <p className="text-[10px] text-text-muted mt-1">Must be today or a future date</p>
                                    </div>
                                )}
                            </div>

                            {/* ── Section: Description / Notes (Auto-Generated & Editable) ── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
                                        Description / Notes (Auto-Generated & Editable)
                                    </label>
                                    {isEnquiryDescManuallyEdited && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEnquiryDescManuallyEdited(false);
                                                const autoText = generateEnquiryDescription();
                                                setEnquiryForm((p) => ({ ...p, description: autoText, remarks: autoText }));
                                            }}
                                            className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                                        >
                                            Reset to Auto-Generated
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    rows={3}
                                    placeholder="Auto-generated descriptive notes based on selected specs..."
                                    value={enquiryForm.description || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setIsEnquiryDescManuallyEdited(true);
                                        setEnquiryForm((p) => ({ ...p, description: val, remarks: val }));
                                    }}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                                <p className="text-[10px] text-text-muted">
                                    {isEnquiryDescManuallyEdited ? 'Customized manually.' : 'Auto-generating from customer, category, fabric specs, print details, and quantity.'}
                                </p>
                            </div>

                            {/* ── Section: PO Attachments ───────────────────────────────── */}
                            <div className="p-4 bg-app-bg rounded-lg border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Purchase Order Attachments</p>
                                    <span className="text-[10px] text-text-muted font-mono">{enquiryForm.poAttachments?.length || 0} / 5 files</span>
                                </div>

                                {/* Existing Attachments */}
                                {(enquiryForm.poAttachments?.length > 0) && (
                                    <div className="space-y-1.5">
                                        {enquiryForm.poAttachments.map((f, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-card-bg border border-border rounded-lg">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText size={14} className="text-primary shrink-0" />
                                                    <span className="text-[11px] font-medium text-text-main truncate">{f.name}</span>
                                                    {f.size > 0 && <span className="text-[10px] font-mono text-text-muted shrink-0">{(f.size / 1024).toFixed(0)} KB</span>}
                                                </div>
                                                <button type="button" onClick={() => removeAttachment(idx)} className="p-1 text-text-muted hover:text-rose-600 rounded cursor-pointer shrink-0">
                                                    <XIcon size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload Button */}
                                {(enquiryForm.poAttachments?.length || 0) < 5 && (
                                    <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors group">
                                        <Upload size={16} className="text-text-muted group-hover:text-primary transition-colors" />
                                        <div>
                                            <p className="text-xs font-semibold text-text-muted group-hover:text-text-main">Click to upload PO files</p>
                                            <p className="text-[10px] text-text-muted">Max 5 files · 10 MB each · PDF, Images, Docs</p>
                                        </div>
                                        <input type="file" multiple accept="*/*" className="sr-only" onChange={handleFileUpload} />
                                    </label>
                                )}
                            </div>

                            {/* ── Form Footer ───────────────────────────────────────────── */}
                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button type="button" onClick={() => { setIsEnquiryDrawerOpen(false); setEditingEnquiry(null); }} className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                    <Package size={15} />
                                    <span>{isSubmitting ? 'Saving...' : (editingEnquiry ? 'Update Enquiry' : 'Save Enquiry')}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* ─── Custom Delete Confirmation Modal ──────────────────────────── */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="relative z-10 bg-card-bg border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 font-sans animate-in zoom-in-95 duration-150">
                        {/* Icon + Title */}
                        <div className="flex flex-col items-center text-center gap-3 mb-5">
                            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                                <AlertCircle size={24} className="text-rose-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-text-main">Delete Order Enquiry?</h3>
                                <p className="text-xs text-text-muted mt-1">
                                    This will permanently remove the enquiry for{' '}
                                    <span className="font-bold text-text-main">
                                        {recordToDelete?.customer?.companyName || 'this customer'}
                                    </span>
                                    . This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setDeleteModalOpen(false); setRecordToDelete(null); }}
                                className="flex-1 px-4 py-2.5 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-colors shadow-md cursor-pointer"
                            >
                                Delete Enquiry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Detail View Modal (Order Enquiry read-only) ───────────────── */}
            <DetailViewModal
                isOpen={Boolean(viewingEnquiry)}
                onClose={() => setViewingEnquiry(null)}
                record={viewingEnquiry}
                tabKey="enquiries"
                tabLabel="Order Enquiry"
            />
        </>
    );
}
