import { useState, useEffect } from 'react';
import { PhoneCall, AlertTriangle, Plus, RefreshCw, MessageSquare, CheckCircle, Clock, Calendar, UserCheck } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import SlideOverPanel from '../components/shared/SlideOverPanel';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function CustomerCrmPage() {
    const [activeTab, setActiveTab] = useState('follow-ups');
    const [isInteractionDrawerOpen, setIsInteractionDrawerOpen] = useState(false);
    const [isComplaintDrawerOpen, setIsComplaintDrawerOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Dropdown Data
    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tab Counts
    const [interactionCount, setInteractionCount] = useState(0);
    const [complaintCount, setComplaintCount] = useState(0);

    // Interaction Form State
    const [interactionForm, setInteractionForm] = useState({
        customer: '',
        interactionType: 'Phone Call',
        subject: '',
        date: new Date().toISOString().split('T')[0],
        assignedExecutive: '',
        status: 'OPEN',
        notes: '',
        nextFollowUpDate: ''
    });

    // Complaint Form State
    const [complaintForm, setComplaintForm] = useState({
        customer: '',
        complaintType: 'Quality Defect',
        description: '',
        date: new Date().toISOString().split('T')[0],
        assignedExecutive: '',
        status: 'OPEN',
        resolutionNotes: ''
    });

    // Fetch Customers & Sales Reps on Drawer Open
    useEffect(() => {
        if (isInteractionDrawerOpen || isComplaintDrawerOpen) {
            setIsLoadingDropdowns(true);
            Promise.all([
                axiosInstance.get('/customers?limit=100'),
                axiosInstance.get('/users?limit=100')
            ])
                .then(([custRes, userRes]) => {
                    if (custRes.data?.success && Array.isArray(custRes.data.data)) {
                        const custs = custRes.data.data;
                        setCustomers(custs);
                        if (custs.length > 0) {
                            setInteractionForm((prev) => ({ ...prev, customer: prev.customer || custs[0]._id }));
                            setComplaintForm((prev) => ({ ...prev, customer: prev.customer || custs[0]._id }));
                        }
                    }

                    if (userRes.data?.success && Array.isArray(userRes.data.data)) {
                        const usrList = userRes.data.data;
                        setUsers(usrList);
                        if (usrList.length > 0) {
                            setInteractionForm((prev) => ({ ...prev, assignedExecutive: prev.assignedExecutive || usrList[0]._id }));
                            setComplaintForm((prev) => ({ ...prev, assignedExecutive: prev.assignedExecutive || usrList[0]._id }));
                        }
                    }
                })
                .catch((err) => {
                    console.error('Error fetching CRM dropdown options:', err);
                    toast.error('Failed to load customers or sales executive catalog');
                })
                .finally(() => {
                    setIsLoadingDropdowns(false);
                });
        }
    }, [isInteractionDrawerOpen, isComplaintDrawerOpen]);

    // Submit Interaction Log
    const handleSubmitInteraction = async (e) => {
        e.preventDefault();

        if (!interactionForm.customer || !interactionForm.subject.trim()) {
            toast.error('Please select a Customer and enter a Subject');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                customer: interactionForm.customer,
                interactionType: interactionForm.interactionType,
                subject: interactionForm.subject.trim(),
                date: interactionForm.date || new Date(),
                assignedExecutive: interactionForm.assignedExecutive || undefined,
                status: interactionForm.status,
                notes: interactionForm.notes.trim(),
                nextFollowUpDate: interactionForm.nextFollowUpDate || undefined
            };

            const res = await axiosInstance.post('/crm/interactions', payload);

            if (res.data?.success) {
                toast.success('Customer interaction logged successfully!');
                setIsInteractionDrawerOpen(false);
                setInteractionForm({
                    customer: customers[0]?._id || '',
                    interactionType: 'Phone Call',
                    subject: '',
                    date: new Date().toISOString().split('T')[0],
                    assignedExecutive: users[0]?._id || '',
                    status: 'OPEN',
                    notes: '',
                    nextFollowUpDate: ''
                });
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error logging interaction:', err);
            toast.error(err.response?.data?.message || 'Failed to log customer interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit Complaint Ticket
    const handleSubmitComplaint = async (e) => {
        e.preventDefault();

        if (!complaintForm.customer || !complaintForm.description.trim()) {
            toast.error('Please select a Customer and provide a Description');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                customer: complaintForm.customer,
                complaintType: complaintForm.complaintType,
                description: complaintForm.description.trim(),
                date: complaintForm.date || new Date(),
                assignedExecutive: complaintForm.assignedExecutive || undefined,
                status: complaintForm.status,
                resolutionNotes: complaintForm.resolutionNotes.trim()
            };

            const res = await axiosInstance.post('/crm/complaints', payload);

            if (res.data?.success) {
                const ticketNum = res.data.data?.ticketNumber || 'COMP-TICKET';
                toast.success(`Complaint ticket '${ticketNum}' filed successfully!`);
                setIsComplaintDrawerOpen(false);
                setComplaintForm({
                    customer: customers[0]?._id || '',
                    complaintType: 'Quality Defect',
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    assignedExecutive: users[0]?._id || '',
                    status: 'OPEN',
                    resolutionNotes: ''
                });
                setRefreshKey((prev) => prev + 1);
            }
        } catch (err) {
            console.error('Error filing complaint:', err);
            toast.error(err.response?.data?.message || 'Failed to file complaint ticket');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Columns for Follow-up Logs Tab
    const followUpColumns = [
        {
            header: 'CUSTOMER',
            render: (row) => {
                const custObj = typeof row.customer === 'object' ? row.customer : null;
                const companyName = custObj?.companyName || row.customerName || 'Retail Client';
                const code = custObj?.code || '';

                return (
                    <div className="font-sans leading-tight">
                        <div className="font-extrabold text-text-main text-xs">{companyName}</div>
                        {code && <div className="text-[10px] font-mono text-text-muted">{code}</div>}
                    </div>
                );
            },
            sortable: true
        },
        {
            header: 'DATE',
            render: (row) => {
                const dateVal = row.date || row.createdAt;
                return (
                    <span className="font-mono text-xs text-text-main font-medium">
                        {dateVal ? new Date(dateVal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                );
            },
            sortable: true
        },
        {
            header: 'INTERACTION TYPE',
            render: (row) => {
                const type = row.interactionType || 'Phone Call';
                let badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                if (type.includes('Email')) badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200';
                if (type.includes('Meeting') || type.includes('In-Person')) badgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
                if (type.includes('Escalation') || type.includes('Visit')) badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
                        {type}
                    </span>
                );
            }
        },
        {
            header: 'SUBJECT',
            render: (row) => (
                <span className="font-semibold text-text-main text-xs truncate max-w-xs block" title={row.subject}>
                    {row.subject || '-'}
                </span>
            )
        },
        {
            header: 'ASSIGNED EXECUTIVE',
            render: (row) => {
                const execObj = typeof row.assignedExecutive === 'object' ? row.assignedExecutive : null;
                return (
                    <span className="font-semibold text-text-main text-xs">
                        {execObj?.name || row.assignedTo || 'Unassigned'}
                    </span>
                );
            }
        },
        {
            header: 'STATUS',
            render: (row) => {
                const st = (row.status || 'OPEN').toUpperCase();
                let dotColor = 'bg-amber-500';
                let textStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                let label = 'Open';

                if (st === 'IN_PROGRESS' || st === 'IN PROGRESS') {
                    dotColor = 'bg-blue-500';
                    textStyle = 'bg-blue-50 text-blue-800 border-blue-200';
                    label = 'In Progress';
                } else if (st === 'RESOLVED' || st === 'CLOSED') {
                    dotColor = 'bg-emerald-500';
                    textStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    label = 'Resolved';
                }

                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${textStyle}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span>{label}</span>
                    </div>
                );
            }
        }
    ];

    // Columns for Quality & Delivery Complaints Tab
    const complaintColumns = [
        {
            header: 'TICKET #',
            render: (row) => (
                <span className="font-mono font-bold uppercase text-text-main text-xs">
                    {row.ticketNumber || 'COMP-001'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'CUSTOMER',
            render: (row) => {
                const custObj = typeof row.customer === 'object' ? row.customer : null;
                return (
                    <span className="font-extrabold text-text-main text-xs">
                        {custObj?.companyName || row.customerName || '-'}
                    </span>
                );
            }
        },
        {
            header: 'COMPLAINT TYPE',
            render: (row) => (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                    {row.complaintType || 'Quality Defect'}
                </span>
            )
        },
        {
            header: 'DESCRIPTION',
            render: (row) => (
                <span className="text-xs text-text-muted max-w-xs block truncate" title={row.description}>
                    {row.description || '-'}
                </span>
            )
        },
        {
            header: 'ASSIGNED EXECUTIVE',
            render: (row) => {
                const execObj = typeof row.assignedExecutive === 'object' ? row.assignedExecutive : null;
                return (
                    <span className="font-semibold text-text-main text-xs">
                        {execObj?.name || 'Quality Lead'}
                    </span>
                );
            }
        },
        {
            header: 'STATUS',
            render: (row) => {
                const st = (row.status || 'OPEN').toUpperCase();
                const isResolved = st === 'RESOLVED' || st === 'CLOSED';
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        isResolved
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isResolved ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                        <span>{isResolved ? 'Resolved' : 'Open Ticket'}</span>
                    </div>
                );
            }
        }
    ];

    const tabs = [
        {
            key: 'follow-ups',
            label: `Follow-up Logs (${interactionCount})`,
            resourcePath: '/crm/interactions',
            columns: followUpColumns
        },
        {
            key: 'complaints',
            label: `Quality & Delivery Complaints (${complaintCount})`,
            resourcePath: '/crm/complaints',
            columns: complaintColumns
        }
    ];

    // Primary action button (orange theme per prototype)
    const headerButton = (
        <div className="flex items-center gap-2">
            {activeTab === 'complaints' ? (
                <button
                    type="button"
                    onClick={() => setIsComplaintDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
                >
                    <AlertTriangle size={15} />
                    <span>+ File Complaint Ticket</span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsInteractionDrawerOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
                >
                    <PhoneCall size={15} />
                    <span>+ Log Customer Interaction</span>
                </button>
            )}
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={refreshKey}
                title="Customer CRM & Complaint Management"
                description="Sales Follow-ups, Key Buyer History & Defect Escalation Handling"
                tabs={tabs}
                activeTabKey={activeTab}
                onTabChange={(key) => setActiveTab(key)}
                headerActions={headerButton}
            />

            {/* Drawer 1: Log Customer Interaction */}
            <SlideOverPanel
                isOpen={isInteractionDrawerOpen}
                onClose={() => setIsInteractionDrawerOpen(false)}
                title="Log Customer Interaction & Follow-up"
                subtitle="Record phone call, meeting notes, sales follow-up and assign sales representative"
            >
                <form onSubmit={handleSubmitInteraction} className="space-y-4 font-sans text-xs">
                    {isLoadingDropdowns ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-amber-500" />
                            <span>Loading customers & sales team list...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Select Customer Master *
                                </label>
                                <select
                                    required
                                    value={interactionForm.customer}
                                    onChange={(e) => setInteractionForm({ ...interactionForm, customer: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                >
                                    {customers.map((c) => (
                                        <option key={c._id} value={c._id}>
                                            {c.companyName} ({c.code || 'CUST'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Interaction Type *
                                    </label>
                                    <select
                                        required
                                        value={interactionForm.interactionType}
                                        onChange={(e) => setInteractionForm({ ...interactionForm, interactionType: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                    >
                                        <option value="Phone Call">Phone Call</option>
                                        <option value="Email">Email Communication</option>
                                        <option value="In-Person Meeting">In-Person Meeting</option>
                                        <option value="Factory Visit">Factory Visit</option>
                                        <option value="Escalation">Escalation / Issue</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Interaction Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={interactionForm.date}
                                        onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 font-sans"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Subject / Key Agenda *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Monthly order commitment & pricing discussion"
                                    value={interactionForm.subject}
                                    onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 font-sans"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Assigned Sales Executive
                                    </label>
                                    <select
                                        value={interactionForm.assignedExecutive}
                                        onChange={(e) => setInteractionForm({ ...interactionForm, assignedExecutive: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                    >
                                        {users.map((u) => (
                                            <option key={u._id} value={u._id}>
                                                {u.name} ({u.role?.name || u.role || 'Executive'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Status *
                                    </label>
                                    <select
                                        required
                                        value={interactionForm.status}
                                        onChange={(e) => setInteractionForm({ ...interactionForm, status: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
                                    >
                                        <option value="OPEN">Open (Requires Follow-up)</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="RESOLVED">Resolved / Complete</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Notes & Detailed Minutes of Meeting
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Enter detailed discussion points, customer feedback, quantity commitments..."
                                    value={interactionForm.notes}
                                    onChange={(e) => setInteractionForm({ ...interactionForm, notes: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-amber-500 font-sans"
                                />
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsInteractionDrawerOpen(false)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <PhoneCall size={15} />
                                    <span>{isSubmitting ? 'Saving Interaction...' : 'Save Interaction Log'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>

            {/* Drawer 2: Log Quality Complaint Ticket */}
            <SlideOverPanel
                isOpen={isComplaintDrawerOpen}
                onClose={() => setIsComplaintDrawerOpen(false)}
                title="File Quality & Delivery Complaint"
                subtitle="Escalate customer defect complaints, bag bursting, or delivery delay tickets"
            >
                <form onSubmit={handleSubmitComplaint} className="space-y-4 font-sans text-xs">
                    {isLoadingDropdowns ? (
                        <div className="flex items-center justify-center py-12 text-text-muted gap-2">
                            <RefreshCw size={18} className="animate-spin text-rose-500" />
                            <span>Loading options...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Customer Master *
                                </label>
                                <select
                                    required
                                    value={complaintForm.customer}
                                    onChange={(e) => setComplaintForm({ ...complaintForm, customer: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                >
                                    {customers.map((c) => (
                                        <option key={c._id} value={c._id}>
                                            {c.companyName} ({c.code || 'CUST'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Complaint Type *
                                    </label>
                                    <select
                                        required
                                        value={complaintForm.complaintType}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, complaintType: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                    >
                                        <option value="Quality Defect">Bag Burst / Stitching Defect</option>
                                        <option value="Delivery Delay">Delivery Delay / Logistics</option>
                                        <option value="Quantity Mismatch">Shortage / Quantity Mismatch</option>
                                        <option value="Packaging Damage">Bale Damage / Wet Bags</option>
                                        <option value="Billing Error">Invoice / Rate Discrepancy</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Incident Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={complaintForm.date}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, date: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 font-sans"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Complaint Description *
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Describe defect in detail (e.g. 50 bags burst during automated filling at customer site...)"
                                    value={complaintForm.description}
                                    onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-rose-500 font-sans"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Assign Executive / Quality Lead
                                    </label>
                                    <select
                                        value={complaintForm.assignedExecutive}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, assignedExecutive: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                    >
                                        {users.map((u) => (
                                            <option key={u._id} value={u._id}>
                                                {u.name} ({u.role?.name || u.role || 'Executive'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Initial Ticket Status *
                                    </label>
                                    <select
                                        required
                                        value={complaintForm.status}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, status: e.target.value })}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-rose-500 cursor-pointer font-sans"
                                    >
                                        <option value="OPEN">Open Ticket</option>
                                        <option value="INVESTIGATING">Under Investigation</option>
                                        <option value="RESOLVED">Resolved / CAPA Issued</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsComplaintDrawerOpen(false)}
                                    className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <AlertTriangle size={15} />
                                    <span>{isSubmitting ? 'Filing Ticket...' : 'File Complaint Ticket'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </SlideOverPanel>
        </>
    );
}
