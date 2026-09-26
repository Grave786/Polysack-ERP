import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    PhoneCall, AlertTriangle, Plus, RefreshCw, ClipboardList,
    CheckCircle2, XCircle, Eye, Pencil, Trash2, AlertCircle,
    Upload, X as XIcon, FileText, Package, ShoppingCart, Clock
} from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import DetailViewModal from '../components/shared/DetailViewModal';
import CreateSalesOrderModal from '../components/sales/CreateSalesOrderModal';
import CreateCustomerModal from '../components/shared/CreateCustomerModal';
import LogFollowUpModal from '../components/crm/LogFollowUpModal';
import CreateComplaintModal from '../components/crm/CreateComplaintModal';
import LogInteractionModal from '../components/crm/LogInteractionModal';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// ── Attribute type keys matching rawMaterialAttributes.constants.js ──────────
const ATTR = {
    qualityFabric: 'materialQualityFabric',
    lamination: 'laminationType',
    colour: 'materialColour',
    grammage: 'fabricGrammage'
};

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY_ENQUIRY = {
    customerType: 'Existing',
    customer: '',
    customerRef: '',
    newCustomerDetails: {
        name: '',
        company: '',
        phone: '',
        email: ''
    },
    status: 'Open',
    followUps: [],
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
    orderQuantity: '',
    quantityUnit: 'Kg',
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
    const rawUser = useAuthStore((state) => state.user);
    const userRole = rawUser?.role?.name || rawUser?.roleName || (typeof rawUser?.role === 'string' ? rawUser.role : '');
    const user = useMemo(() => (rawUser ? { ...rawUser, role: userRole } : null), [rawUser, userRole]);

    const [activeTab, setActiveTab] = useState('enquiries');
    const [isInteractionDrawerOpen, setIsInteractionDrawerOpen] = useState(false);
    const [editingInteraction, setEditingInteraction] = useState(null); // null = create, object = edit
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    const [selectedInteraction, setSelectedInteraction] = useState(null);
    const [isComplaintDrawerOpen, setIsComplaintDrawerOpen] = useState(false);
    const [editingComplaint, setEditingComplaint] = useState(null); // null = create, object = edit
    const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [isEnquiryDrawerOpen, setIsEnquiryDrawerOpen] = useState(false);
    const [editingEnquiry, setEditingEnquiry] = useState(null); // null = create, object = edit
    const [refreshKey, setRefreshKey] = useState(0);

    // Custom delete confirmation modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // View-detail modal
    const [viewingEnquiry, setViewingEnquiry] = useState(null);

    // Fetch full order enquiry details when opening view modal to ensure latest followUps
    useEffect(() => {
        if (viewingEnquiry?._id && !viewingEnquiry.followUps) {
            axiosInstance.get(`/crm/enquiries/${viewingEnquiry._id}`)
                .then((res) => {
                    if (res.data?.data) {
                        setViewingEnquiry(res.data.data);
                    }
                })
                .catch(() => {});
        }
    }, [viewingEnquiry?._id]);

    // Shared dropdown data
    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch customers on mount
    useEffect(() => {
        axiosInstance.get('/customers?isActive=true&limit=200')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setCustomers(res.data.data);
                }
            })
            .catch((err) => console.error('Failed to load customers on mount:', err));
    }, []);

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
        customer: '', customerId: '', interactionType: 'CALL', subject: '',
        date: TODAY, interactionDate: TODAY, assignedExecutive: '', status: 'OPEN', notes: '', nextFollowUpDate: ''
    });

    // Pre-fill interaction form when editing
    useEffect(() => {
        if (editingInteraction) {
            const custId = editingInteraction.customer?._id || editingInteraction.customer || editingInteraction.customerId || '';
            const execId = editingInteraction.assignedExecutive?._id || editingInteraction.assignedExecutive || '';
            setInteractionForm({
                customer: custId,
                customerId: custId,
                interactionType: editingInteraction.interactionType || 'CALL',
                interactionDate: editingInteraction.date ? new Date(editingInteraction.date).toISOString().split('T')[0] : (editingInteraction.interactionDate ? new Date(editingInteraction.interactionDate).toISOString().split('T')[0] : TODAY),
                date: editingInteraction.date ? new Date(editingInteraction.date).toISOString().split('T')[0] : TODAY,
                subject: editingInteraction.subject || '',
                assignedExecutive: execId,
                status: editingInteraction.status || 'OPEN',
                notes: editingInteraction.notes || '',
                nextFollowUpDate: editingInteraction.nextFollowUpDate ? new Date(editingInteraction.nextFollowUpDate).toISOString().split('T')[0] : ''
            });
        } else {
            setInteractionForm({
                customer: customers[0]?._id || '',
                customerId: customers[0]?._id || '',
                interactionType: 'CALL',
                subject: '',
                date: TODAY,
                interactionDate: TODAY,
                assignedExecutive: users[0]?._id || '',
                status: 'OPEN',
                notes: '',
                nextFollowUpDate: ''
            });
        }
    }, [editingInteraction, customers, users]);

    // Complaint form
    const [complaintForm, setComplaintForm] = useState({
        customer: '', customerId: '', complaintType: 'QUALITY_DEFECT', description: '',
        date: TODAY, incidentDate: TODAY, assignedExecutive: '', status: 'OPEN', resolutionNotes: ''
    });

    // Pre-fill complaint form when editing
    useEffect(() => {
        if (editingComplaint) {
            const custId = editingComplaint.customer?._id || editingComplaint.customer || editingComplaint.customerId || '';
            const execId = editingComplaint.assignedExecutive?._id || editingComplaint.assignedExecutive || '';
            setComplaintForm({
                customer: custId,
                customerId: custId,
                complaintType: editingComplaint.complaintType || 'QUALITY_DEFECT',
                date: editingComplaint.date ? new Date(editingComplaint.date).toISOString().split('T')[0] : (editingComplaint.incidentDate ? new Date(editingComplaint.incidentDate).toISOString().split('T')[0] : TODAY),
                incidentDate: editingComplaint.incidentDate ? new Date(editingComplaint.incidentDate).toISOString().split('T')[0] : (editingComplaint.date ? new Date(editingComplaint.date).toISOString().split('T')[0] : TODAY),
                description: editingComplaint.description || '',
                assignedExecutive: execId,
                status: editingComplaint.status || 'OPEN',
                resolutionNotes: editingComplaint.resolutionNotes || ''
            });
        } else {
            setComplaintForm({
                customer: customers[0]?._id || '',
                customerId: customers[0]?._id || '',
                complaintType: 'QUALITY_DEFECT',
                description: '',
                date: TODAY,
                incidentDate: TODAY,
                assignedExecutive: users[0]?._id || '',
                status: 'OPEN',
                resolutionNotes: ''
            });
        }
    }, [editingComplaint, customers, users]);

    // Enquiry form
    const [enquiryForm, setEnquiryForm] = useState({ ...EMPTY_ENQUIRY });
    const [isEnquiryDescManuallyEdited, setIsEnquiryDescManuallyEdited] = useState(false);

    // ── Sales Order Conversion State ──────────────────────────────────────────
    const [isSalesOrderModalOpen, setIsSalesOrderModalOpen] = useState(false);
    const [salesOrderInitialData, setSalesOrderInitialData] = useState(null);
    const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
    const [customerModalInitialData, setCustomerModalInitialData] = useState(null);
    const [pendingNslForConversion, setPendingNslForConversion] = useState(null);
    const [convertingNslId, setConvertingNslId] = useState(null);

    // ── Follow-up Modal State ────────────────────────────────────────────────
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
    const [selectedNslForFollowUp, setSelectedNslForFollowUp] = useState(null);

    // ── Conversion Workflow: Generate Sales Order from NSL ─────────────────────
    const buildSalesOrderPayloadFromNsl = useCallback((nslRecord, customerId) => {
        const specSummary = [
            nslRecord.nslNumber ? `NSL Ref: ${nslRecord.nslNumber}` : '',
            nslRecord.productCategory ? `Category: ${nslRecord.productCategory}` : '',
            nslRecord.materialQualityFabric ? `Fabric: ${nslRecord.materialQualityFabric}` : '',
            nslRecord.fabricGrammage ? `${nslRecord.fabricGrammage} GSM` : '',
            nslRecord.fabricWidthInch && nslRecord.fabricLengthInch ? `Size: ${nslRecord.fabricWidthInch}"x${nslRecord.fabricLengthInch}"` : '',
            nslRecord.fabricLaminationType ? `Lamination: ${nslRecord.fabricLaminationType}` : '',
            nslRecord.printSides && nslRecord.printSides !== 'NONE' ? `Print: ${nslRecord.printSides}` : '',
            nslRecord.description || nslRecord.remarks || ''
        ].filter(Boolean).join(' | ');

        return {
            nslId: nslRecord._id,
            customer: customerId,
            customerId: customerId,
            notes: specSummary,
            totalOrderQuantity: nslRecord.totalOrderQuantity || '',
            deliveryDue: nslRecord.expectedDeliveryDate || undefined,
            items: nslRecord.totalOrderQuantity ? [{
                finishedGood: '',
                quantity: String(nslRecord.totalOrderQuantity),
                unit: 'Pcs',
                ratePerUnit: '',
                subtotal: 0
            }] : [{ finishedGood: '', quantity: '', unit: 'Pcs', ratePerUnit: '', subtotal: 0 }]
        };
    }, []);

    const handleGenerateSalesOrder = useCallback((nslRecord) => {
        setConvertingNslId(nslRecord._id);
        const isExisting = nslRecord.customerType === 'Existing' || Boolean(nslRecord.customerRef || nslRecord.customer);

        if (isExisting) {
            const custId = nslRecord.customerRef?._id || nslRecord.customerRef || (typeof nslRecord.customer === 'object' ? nslRecord.customer?._id : nslRecord.customer);
            setSalesOrderInitialData(buildSalesOrderPayloadFromNsl(nslRecord, custId));
            setIsSalesOrderModalOpen(true);
        } else {
            // New Prospect: Open CreateCustomerModal with prospect details pre-filled
            setPendingNslForConversion(nslRecord);
            setCustomerModalInitialData({
                companyName: nslRecord.newCustomerDetails?.company || '',
                contactPerson: nslRecord.newCustomerDetails?.name || nslRecord.contactPerson || '',
                phone: nslRecord.newCustomerDetails?.phone || nslRecord.contactNumber || '',
                email: nslRecord.newCustomerDetails?.email || ''
            });
            setIsCreateCustomerModalOpen(true);
        }
    }, [buildSalesOrderPayloadFromNsl]);

    const handleGenerateSO = useCallback(async (row) => {
        if (convertingNslId === row._id) return;
        setConvertingNslId(row._id);
        if (row.soApprovalStatus === 'Pending Approval' && user?.role === 'Tenant Admin') {
            try {
                await axiosInstance.patch(`/crm/enquiries/${row._id}/so-approval-status`, { status: 'Approved' });
                setRefreshKey((k) => k + 1);
            } catch (err) {
                console.error('Failed to auto-approve SO status:', err);
            }
        }
        handleGenerateSalesOrder(row);
    }, [user?.role, handleGenerateSalesOrder, convertingNslId]);

    const requestSOApproval = useCallback(async (id) => {
        try {
            const res = await axiosInstance.patch(`/crm/enquiries/${id}/so-approval-status`, { status: 'Pending Approval' });
            if (res.data?.success) {
                toast.success('SO approval requested successfully');
                setRefreshKey((k) => k + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to request SO approval');
        }
    }, []);

    // Transition from New Customer saved -> Open CreateSalesOrderModal
    const handleCustomerCreated = useCallback((newCustomer, explicitId) => {
        setIsCreateCustomerModalOpen(false);
        const newCustId = explicitId || newCustomer?._id || newCustomer?.id;
        if (newCustId && pendingNslForConversion) {
            setConvertingNslId(pendingNslForConversion._id);
            setSalesOrderInitialData(buildSalesOrderPayloadFromNsl(pendingNslForConversion, newCustId));
            setPendingNslForConversion(null);
            setIsSalesOrderModalOpen(true);
            toast.success('Customer ready! Opening Sales Order configuration.');
        }
    }, [pendingNslForConversion, buildSalesOrderPayloadFromNsl]);

    // Auto-generate descriptive summary for Order Enquiry / NSL
    const generateEnquiryDescription = useCallback(() => {
        const parts = [];
        if (enquiryForm.customerType === 'New') {
            const prospectName = enquiryForm.newCustomerDetails?.company || enquiryForm.newCustomerDetails?.name;
            if (prospectName) {
                parts.push(`Prospect: ${prospectName}`);
            }
        } else {
            const custObj = customers.find((c) => String(c._id) === String(enquiryForm.customer || enquiryForm.customerRef));
            if (custObj) {
                parts.push(`Client: ${custObj.companyName || custObj.name || custObj.code}`);
            }
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
        enquiryForm.customerType, enquiryForm.customer, enquiryForm.customerRef,
        enquiryForm.newCustomerDetails?.company, enquiryForm.newCustomerDetails?.name,
        enquiryForm.productCategory, enquiryForm.materialQualityFabric,
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
        const targetCust = interactionForm.customer || interactionForm.customerId;
        if (!targetCust || !interactionForm.subject.trim()) {
            toast.error('Please select a Customer and enter a Subject');
            return;
        }
        try {
            setIsSubmitting(true);
            const payload = {
                customer: targetCust,
                interactionType: interactionForm.interactionType,
                subject: interactionForm.subject.trim(),
                date: interactionForm.date || interactionForm.interactionDate || new Date(),
                assignedExecutive: interactionForm.assignedExecutive || undefined,
                status: interactionForm.status,
                notes: interactionForm.notes.trim(),
                nextFollowUpDate: interactionForm.nextFollowUpDate || undefined
            };

            let res;
            if (editingInteraction) {
                res = await axiosInstance.put(`/crm/interactions/${editingInteraction._id}`, payload);
            } else {
                res = await axiosInstance.post('/crm/interactions', payload);
            }

            if (res.data?.success) {
                toast.success(editingInteraction ? 'Customer interaction updated!' : 'Customer interaction logged successfully!');
                setIsInteractionDrawerOpen(false);
                setEditingInteraction(null);
                setInteractionForm({ customer: customers[0]?._id || '', customerId: customers[0]?._id || '', interactionType: 'CALL', subject: '', date: TODAY, interactionDate: TODAY, assignedExecutive: users[0]?._id || '', status: 'OPEN', notes: '', nextFollowUpDate: '' });
                setRefreshKey((p) => p + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save customer interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditInteraction = (record) => {
        setSelectedInteraction(record);
        setIsInteractionModalOpen(true);
    };

    const handleDeleteInteraction = async (record) => {
        if (!record?._id) return;
        try {
            await axiosInstance.delete(`/crm/interactions/${record._id}`);
            toast.success('Interaction deleted successfully');
            setRefreshKey((p) => p + 1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete interaction');
        }
    };

    // ── Submit Complaint ──────────────────────────────────────────────────────
    const handleSubmitComplaint = async (e) => {
        e.preventDefault();
        const targetCust = complaintForm.customer || complaintForm.customerId;
        if (!targetCust || !complaintForm.description.trim()) {
            toast.error('Please select a Customer and provide a Description');
            return;
        }
        try {
            setIsSubmitting(true);
            const payload = {
                customer: targetCust,
                customerId: targetCust,
                complaintType: complaintForm.complaintType,
                description: complaintForm.description.trim(),
                date: complaintForm.date || complaintForm.incidentDate || new Date(),
                incidentDate: complaintForm.date || complaintForm.incidentDate || new Date(),
                assignedExecutive: complaintForm.assignedExecutive || undefined,
                status: complaintForm.status,
                resolutionNotes: complaintForm.resolutionNotes ? complaintForm.resolutionNotes.trim() : ''
            };

            let res;
            if (editingComplaint) {
                res = await axiosInstance.put(`/crm/complaints/${editingComplaint._id}`, payload);
            } else {
                res = await axiosInstance.post('/crm/complaints', payload);
            }

            if (res.data?.success) {
                toast.success(editingComplaint ? 'Complaint ticket updated!' : `Complaint ticket '${res.data.data?.ticketNumber || 'COMP-TICKET'}' filed successfully!`);
                setIsComplaintDrawerOpen(false);
                setEditingComplaint(null);
                setComplaintForm({ customer: customers[0]?._id || '', customerId: customers[0]?._id || '', complaintType: 'QUALITY_DEFECT', description: '', date: TODAY, incidentDate: TODAY, assignedExecutive: users[0]?._id || '', status: 'OPEN', resolutionNotes: '' });
                setRefreshKey((p) => p + 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save complaint ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditComplaint = (record) => {
        setSelectedComplaint(record);
        setIsComplaintModalOpen(true);
    };

    const handleDeleteComplaint = async (record) => {
        if (!record?._id) return;
        try {
            await axiosInstance.delete(`/crm/complaints/${record._id}`);
            toast.success('Complaint ticket deleted successfully');
            setRefreshKey((p) => p + 1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete complaint');
        }
    };

    // ── Submit / Update Enquiry ───────────────────────────────────────────────
    const handleSubmitEnquiry = async (e) => {
        e.preventDefault();
        if (enquiryForm.customerType === 'Existing' && !enquiryForm.customer && !enquiryForm.customerRef) {
            toast.error('Please select a Customer');
            return;
        }
        if (enquiryForm.customerType === 'New' && !enquiryForm.newCustomerDetails?.company?.trim()) {
            toast.error('Please enter Prospect / Company Name');
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

        const effectiveCustomer = enquiryForm.customerType === 'Existing'
            ? (enquiryForm.customer || enquiryForm.customerRef || null)
            : null;

        const payload = {
            customerType: enquiryForm.customerType || 'Existing',
            customerRef: effectiveCustomer,
            customer: effectiveCustomer,
            newCustomerDetails: enquiryForm.customerType === 'New' ? {
                name: (enquiryForm.newCustomerDetails?.name || enquiryForm.contactPerson || '').trim(),
                company: (enquiryForm.newCustomerDetails?.company || '').trim(),
                phone: (enquiryForm.newCustomerDetails?.phone || enquiryForm.contactNumber || '').trim(),
                email: (enquiryForm.newCustomerDetails?.email || '').trim()
            } : undefined,
            status: enquiryForm.status || 'Open',
            followUps: enquiryForm.followUps || [],
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
            totalOrderQuantity: enquiryForm.totalOrderQuantity !== '' ? Number(enquiryForm.totalOrderQuantity) : (enquiryForm.orderQuantity !== '' ? Number(enquiryForm.orderQuantity) : null),
            orderQuantity: enquiryForm.orderQuantity !== '' ? Number(enquiryForm.orderQuantity) : (enquiryForm.totalOrderQuantity !== '' ? Number(enquiryForm.totalOrderQuantity) : null),
            quantityUnit: enquiryForm.quantityUnit || 'Kg',
            orderConfirmed: enquiryForm.orderConfirmed,
            expectedDeliveryDate: enquiryForm.orderConfirmed ? enquiryForm.expectedDeliveryDate : '',
            contactPerson: (enquiryForm.customerType === 'New' ? (enquiryForm.newCustomerDetails?.name || enquiryForm.contactPerson) : enquiryForm.contactPerson).trim(),
            contactNumber: (enquiryForm.customerType === 'New' ? (enquiryForm.newCustomerDetails?.phone || enquiryForm.contactNumber) : enquiryForm.contactNumber).trim(),
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
                toast.success(editingEnquiry ? 'Sales lead updated!' : 'Sales lead logged!');
                setIsEnquiryDrawerOpen(false);
                setEditingEnquiry(null);
                setEnquiryForm({
                    ...EMPTY_ENQUIRY,
                    customer: customers[0]?._id || '',
                    customerRef: customers[0]?._id || ''
                });
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
        const cType = row.customerType || (row.customer || row.customerRef ? 'Existing' : 'New');
        const custId = row.customerRef?._id || row.customerRef || (typeof row.customer === 'object' ? row.customer._id : row.customer) || '';
        setEnquiryForm({
            customerType: cType,
            customerRef: custId,
            customer: custId,
            newCustomerDetails: {
                name: row.newCustomerDetails?.name || row.contactPerson || '',
                company: row.newCustomerDetails?.company || '',
                phone: row.newCustomerDetails?.phone || row.contactNumber || '',
                email: row.newCustomerDetails?.email || ''
            },
            status: row.status || 'Open',
            followUps: row.followUps || [],
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
            totalOrderQuantity: row.totalOrderQuantity ?? row.orderQuantity ?? '',
            orderQuantity: row.orderQuantity ?? row.totalOrderQuantity ?? '',
            quantityUnit: row.quantityUnit || 'Kg',
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
        },
        {
            header: 'ACTIONS',
            render: (row) => (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        title="Edit Interaction"
                        onClick={() => {
                            setSelectedInteraction(row);
                            setIsInteractionModalOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        title="Delete Interaction"
                        onClick={() => handleDeleteInteraction(row)}
                        className="p-1.5 text-text-muted hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )
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
                const raw = row.status || 'Open Ticket';
                const st = raw.toUpperCase();
                const ok = st.includes('RESOLVED') || st.includes('CLOSED');
                const investigating = st.includes('INVESTIGAT');
                const badgeClass = ok 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : (investigating ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200');
                const dotClass = ok ? 'bg-emerald-500' : (investigating ? 'bg-amber-500' : 'bg-rose-500 animate-pulse');
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} /><span>{raw}</span>
                    </div>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        title="Edit Complaint"
                        onClick={() => {
                            setSelectedComplaint(row);
                            setIsComplaintModalOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        type="button"
                        title="Delete Complaint"
                        onClick={() => handleDeleteComplaint(row)}
                        className="p-1.5 text-text-muted hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )
        }
    ];

    const enquiryColumns = [
        {
            header: 'CUSTOMER',
            render: (row) => {
                const isNew = !row.customerRef || !row.customer || row.customerType === 'New';
                const c = typeof row.customer === 'object' ? row.customer : (typeof row.customerRef === 'object' ? row.customerRef : null);
                const displayName = isNew
                    ? (row.newCustomerDetails?.company || row.newCustomerDetails?.name || 'New Prospect')
                    : (c?.companyName || c?.name || '-');

                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{displayName}</div>
                        {row.nslNumber ? (
                            <div className="text-[10px] font-mono text-primary font-bold">{row.nslNumber}</div>
                        ) : (
                            c?.code && <div className="text-[10px] font-mono text-text-muted">{c.code}</div>
                        )}
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
            header: 'STATUS',
            render: (row) => {
                const isConfirmed = row.status === 'Confirmed' || row.orderConfirmed;
                if (isConfirmed) {
                    return (
                        <div className="flex flex-col items-start gap-0.5">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={10} /> Confirmed
                            </div>
                            {row.expectedDeliveryDate && (
                                <span className="text-[10px] font-mono text-text-muted">
                                    {new Date(row.expectedDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    );
                }
                if (row.status === 'Lost') {
                    return (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle size={10} /> Lost
                        </div>
                    );
                }
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock size={10} /> {row.status || 'Open'}
                    </div>
                );
            }
        },
        {
            header: 'ACTIONS',
            render: (row) => {
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* If enquiry status is Converted, SO Created, Closed - Won, or Confirmed */}
                        {['Converted', 'SO Created', 'Closed - Won', 'Confirmed'].includes(row.status) ? (
                            <button 
                                disabled 
                                className="flex items-center gap-1 bg-gray-400 text-white px-2 py-1 rounded text-[10px] font-bold uppercase cursor-not-allowed"
                            >
                                SO Generated
                            </button>
                        ) : row.soApprovalStatus === 'Approved' || user?.role === 'Tenant Admin' ? (
                            <button 
                                onClick={() => handleGenerateSO(row)} 
                                disabled={convertingNslId === row._id}
                                className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                                {row.soApprovalStatus === 'Pending Approval' && user?.role === 'Tenant Admin' ? 'Approve & Gen SO' : 'Generate SO'}
                            </button>
                        ) : row.soApprovalStatus === 'Pending Approval' ? (
                            <button disabled className="flex items-center gap-1 bg-gray-400 text-white px-2 py-1 rounded text-[10px] font-bold uppercase cursor-not-allowed">
                                Approval Pending
                            </button>
                        ) : (
                            <button 
                                onClick={() => requestSOApproval(row._id)} 
                                className="flex items-center gap-1 bg-yellow-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-yellow-600 transition-colors"
                            >
                                Request SO Approval
                            </button>
                        )}
                        {!['Converted', 'SO Created', 'Closed - Won', 'Confirmed'].includes(row.status) && (
                            <button
                                type="button"
                                title="Log Follow-up"
                                onClick={() => {
                                    setSelectedNslForFollowUp(row);
                                    setIsFollowUpModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                            >
                                <PhoneCall size={12} />
                                <span>Log Follow-up</span>
                            </button>
                        )}
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
                );
            }
        }
    ];

    // ── Tab definitions — Order Enquiries is first/default ───────────────────
    const tabs = useMemo(() => [
        { key: 'enquiries', label: 'Order Enquiries', resourcePath: '/crm/enquiries', columns: enquiryColumns, availableStatuses: ['Open', 'Confirmed', 'Lost'], defaultStatus: 'All Statuses' },
        { 
            key: 'follow-ups', 
            label: 'Follow-up Logs', 
            resourcePath: '/crm/interactions', 
            columns: followUpColumns,
            availableStatuses: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
            defaultStatus: 'All Statuses'
        },
        { key: 'complaints', label: 'Quality & Delivery Complaints', resourcePath: '/crm/complaints', columns: complaintColumns, availableStatuses: ['Open Ticket', 'Under Investigation', 'Resolved / CAPA Issued', 'Closed'], defaultStatus: 'All Statuses' }
    ], []);

    // ── Header action button ──────────────────────────────────────────────────
    const headerButton = (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
            {activeTab === 'complaints' ? (
                <button
                    type="button"
                    onClick={() => { setSelectedComplaint(null); setEditingComplaint(null); setIsComplaintModalOpen(true); }}
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
                    <ClipboardList size={15} /><span>+ New Sales Lead (NSL)</span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => { setSelectedInteraction(null); setEditingInteraction(null); setIsInteractionModalOpen(true); }}
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
                onClose={() => { setIsInteractionDrawerOpen(false); setEditingInteraction(null); }}
                title={editingInteraction ? "Edit Customer Interaction & Follow-up" : "Log Customer Interaction & Follow-up"}
                subtitle={editingInteraction ? "Modify existing communication log, notes or status" : "Record phone call, meeting notes, sales follow-up and assign sales representative"}
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
                                <select required value={interactionForm.customer || interactionForm.customerId} onChange={(e) => setInteractionForm({ ...interactionForm, customer: e.target.value, customerId: e.target.value })} className={sel}>
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
                                <button type="button" onClick={() => { setIsInteractionDrawerOpen(false); setEditingInteraction(null); }} className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                    <PhoneCall size={15} /><span>{isSubmitting ? 'Saving...' : (editingInteraction ? 'Update Interaction' : 'Save Interaction Log')}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* ─── Drawer 2: File Complaint Ticket ───────────────────────────── */}
            <SlideOverPanel
                isOpen={isComplaintDrawerOpen}
                onClose={() => { setIsComplaintDrawerOpen(false); setEditingComplaint(null); }}
                title={editingComplaint ? "Edit Quality & Delivery Complaint" : "File Quality & Delivery Complaint"}
                subtitle={editingComplaint ? "Modify complaint ticket details, incident date or assigned executive" : "Escalate customer defect complaints, bag bursting, or delivery delay tickets"}
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
                                <select required value={complaintForm.customer || complaintForm.customerId} onChange={(e) => setComplaintForm({ ...complaintForm, customer: e.target.value, customerId: e.target.value })} className={sel}>
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
                                <button type="button" onClick={() => { setIsComplaintDrawerOpen(false); setEditingComplaint(null); }} className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                    <AlertTriangle size={15} /><span>{isSubmitting ? 'Saving...' : (editingComplaint ? 'Update Ticket' : 'File Complaint Ticket')}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* ─── Drawer 3: Log / Edit Order Enquiry / NSL ─────────────────── */}
            <SlideOverPanel
                isOpen={isEnquiryDrawerOpen}
                onClose={() => { setIsEnquiryDrawerOpen(false); setEditingEnquiry(null); }}
                title={editingEnquiry ? 'Edit Sales Lead (NSL)' : 'New Sales Lead (NSL)'}
                subtitle="Capture prospect details, specifications, and follow-ups."
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
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">Customer & Enquiry Info</p>

                                    {/* Toggle: Existing Customer vs New Prospect */}
                                    <div className="flex items-center gap-3 bg-card-bg border border-border px-3 py-1 rounded-lg shadow-2xs">
                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-text-main">
                                            <input
                                                type="radio"
                                                name="customerType"
                                                value="Existing"
                                                checked={enquiryForm.customerType === 'Existing'}
                                                onChange={() => setEnquiryForm((p) => ({ ...p, customerType: 'Existing' }))}
                                                className="accent-primary cursor-pointer"
                                            />
                                            <span>Existing Customer</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-text-main">
                                            <input
                                                type="radio"
                                                name="customerType"
                                                value="New"
                                                checked={enquiryForm.customerType === 'New'}
                                                onChange={() => setEnquiryForm((p) => ({ ...p, customerType: 'New', customer: '', customerRef: '' }))}
                                                className="accent-primary cursor-pointer"
                                            />
                                            <span>New Prospect</span>
                                        </label>
                                    </div>
                                </div>

                                {enquiryForm.customerType === 'Existing' ? (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className={lbl}>Customer *</label>
                                                <select
                                                    required
                                                    value={enquiryForm.customer || enquiryForm.customerRef || ''}
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
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className={lbl}>Prospect / Company Name *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. Acme Polymers Ltd"
                                                    value={enquiryForm.newCustomerDetails?.company || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEnquiryForm((p) => ({
                                                            ...p,
                                                            newCustomerDetails: { ...(p.newCustomerDetails || {}), company: val }
                                                        }));
                                                    }}
                                                    className={inp}
                                                />
                                            </div>
                                            <div>
                                                <label className={lbl}>Enquiry Date</label>
                                                <input type="date" value={enquiryForm.enquiryDate} onChange={(e) => setEnquiryForm((p) => ({ ...p, enquiryDate: e.target.value }))} className={inp} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className={lbl}>Contact Person *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. Rajesh Kumar"
                                                    value={enquiryForm.newCustomerDetails?.name || enquiryForm.contactPerson || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEnquiryForm((p) => ({
                                                            ...p,
                                                            contactPerson: val,
                                                            newCustomerDetails: { ...(p.newCustomerDetails || {}), name: val }
                                                        }));
                                                    }}
                                                    className={inp}
                                                />
                                            </div>
                                            <div>
                                                <label className={lbl}>Contact Number *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="+91 98765 43210"
                                                    value={enquiryForm.newCustomerDetails?.phone || enquiryForm.contactNumber || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEnquiryForm((p) => ({
                                                            ...p,
                                                            contactNumber: val,
                                                            newCustomerDetails: { ...(p.newCustomerDetails || {}), phone: val }
                                                        }));
                                                    }}
                                                    className={inp}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
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
                                                        onChange={(e) => {
                                                            const newQty = parseInt(e.target.value, 10) || 0;
                                                            const currentColors = enquiryForm.frontColorsList || [];
                                                            const updatedColors = Array.from({ length: newQty }, (_, i) => currentColors[i] || '');
                                                            setEnquiryForm((p) => ({
                                                                ...p,
                                                                frontColours: newQty,
                                                                frontColorsQty: newQty,
                                                                frontColorsList: updatedColors
                                                            }));
                                                        }}
                                                        className={inp}
                                                    />
                                                </div>
                                            )}

                                            {enquiryForm.frontColorsList?.length > 0 && (
                                                <div className="col-span-full flex flex-col gap-2 mt-1">
                                                    {enquiryForm.frontColorsList.map((color, index) => (
                                                        <input
                                                            key={`front-${index}`}
                                                            type="text"
                                                            placeholder={`Front Colour ${index + 1} (e.g. Red)`}
                                                            value={color}
                                                            onChange={(e) => {
                                                                const newColors = [...enquiryForm.frontColorsList];
                                                                newColors[index] = e.target.value;
                                                                setEnquiryForm((p) => ({ ...p, frontColorsList: newColors }));
                                                            }}
                                                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                                        />
                                                    ))}
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
                                                        onChange={(e) => {
                                                            const newQty = parseInt(e.target.value, 10) || 0;
                                                            const currentColors = enquiryForm.backColorsList || [];
                                                            const updatedColors = Array.from({ length: newQty }, (_, i) => currentColors[i] || '');
                                                            setEnquiryForm((p) => ({
                                                                ...p,
                                                                backColours: newQty,
                                                                backColorsQty: newQty,
                                                                backColorsList: updatedColors
                                                            }));
                                                        }}
                                                        className={inp}
                                                    />
                                                </div>
                                            )}

                                            {enquiryForm.backColorsList?.length > 0 && (
                                                <div className="col-span-full flex flex-col gap-2 mt-1">
                                                    {enquiryForm.backColorsList.map((color, index) => (
                                                        <input
                                                            key={`back-${index}`}
                                                            type="text"
                                                            placeholder={`Back Colour ${index + 1} (e.g. Blue)`}
                                                            value={color}
                                                            onChange={(e) => {
                                                                const newColors = [...enquiryForm.backColorsList];
                                                                newColors[index] = e.target.value;
                                                                setEnquiryForm((p) => ({ ...p, backColorsList: newColors }));
                                                            }}
                                                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                                        />
                                                    ))}
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
                                        <label className={lbl}>TOTAL ORDER QUANTITY *</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number" 
                                                placeholder="e.g. 10000" 
                                                value={enquiryForm.orderQuantity || ''} 
                                                onChange={(e) => setEnquiryForm((p) => ({ ...p, orderQuantity: e.target.value }))} 
                                                className="flex-1 border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary" 
                                            />
                                            <select 
                                                value={enquiryForm.quantityUnit || 'Kg'} 
                                                onChange={(e) => setEnquiryForm((p) => ({ ...p, quantityUnit: e.target.value }))} 
                                                className="w-24 shrink-0 border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                            >
                                                <option value="Kg">Kg</option>
                                                <option value="Pcs">Pcs</option>
                                                <option value="Bag">Bag</option>
                                                <option value="Roll">Roll</option>
                                            </select>
                                        </div>
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

            {/* ─── Create Customer Modal (New Prospect conversion) ───────────── */}
            <CreateCustomerModal
                isOpen={isCreateCustomerModalOpen}
                onClose={() => {
                    setIsCreateCustomerModalOpen(false);
                    setPendingNslForConversion(null);
                }}
                onSuccess={handleCustomerCreated}
                initialData={customerModalInitialData}
            />

            {/* ─── Create Sales Order Modal (NSL conversion) ─────────────────── */}
            <CreateSalesOrderModal
                isOpen={isSalesOrderModalOpen}
                onClose={() => {
                    setIsSalesOrderModalOpen(false);
                    setSalesOrderInitialData(null);
                    setConvertingNslId(null);
                }}
                onSuccess={async () => {
                    const targetNslId = convertingNslId || salesOrderInitialData?.nslId;
                    if (targetNslId) {
                        try {
                            await axiosInstance.put(`/crm/enquiries/${targetNslId}`, {
                                status: 'Converted',
                                orderConfirmed: true
                            });
                        } catch (err) {
                            console.error('Failed to auto-update enquiry status:', err);
                        }
                    }
                    setIsSalesOrderModalOpen(false);
                    setSalesOrderInitialData(null);
                    setConvertingNslId(null);
                    setRefreshKey((p) => p + 1);
                    toast.success('Sales Order generated successfully from NSL!');
                }}
                initialData={salesOrderInitialData}
            />

            {/* ─── Log Follow-up Modal ────────────────────────────────────────── */}
            <LogFollowUpModal
                isOpen={isFollowUpModalOpen}
                onClose={() => {
                    setIsFollowUpModalOpen(false);
                    setSelectedNslForFollowUp(null);
                }}
                nslData={selectedNslForFollowUp}
                onSuccess={() => {
                    setRefreshKey((p) => p + 1);
                }}
            />

            {/* ─── File / Edit Complaint Modal ─────────────────────────────── */}
            <CreateComplaintModal
                isOpen={isComplaintModalOpen}
                onClose={() => {
                    setIsComplaintModalOpen(false);
                    setSelectedComplaint(null);
                }}
                editData={selectedComplaint}
                customers={customers}
                users={users}
                onSuccess={() => {
                    setRefreshKey((p) => p + 1);
                }}
            />
            {/* ─── Log Customer Interaction Modal ─────────────────────────────── */}
            <LogInteractionModal
                isOpen={isInteractionModalOpen}
                onClose={() => {
                    setIsInteractionModalOpen(false);
                    setSelectedInteraction(null);
                }}
                editData={selectedInteraction}
                customers={customers}
                users={users}
                onSuccess={() => {
                    setRefreshKey((p) => p + 1);
                }}
            />
        </>
    );
}
