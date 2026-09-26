import { useState } from 'react';
import { Eye, X, Calendar, PhoneCall, FileText, CheckCircle2, Clock, Layers } from 'lucide-react';

export default function ViewOrderEnquiryModal({ isOpen, onClose, data }) {
    const [activeTab, setActiveTab] = useState('details');

    if (!isOpen || !data) return null;

    const prospectName =
        data.customerRef?.companyName ||
        data.customerRef?.name ||
        data.customer?.companyName ||
        data.customer?.name ||
        data.newCustomerDetails?.company ||
        data.newCustomerDetails?.name ||
        '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
            <div className="fixed inset-0" onClick={onClose} />

            <div className="relative z-10 w-full max-w-2xl bg-card-bg border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 bg-sidebar-bg text-sidebar-text-active border-b border-sidebar-hover flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary/20 text-primary-light rounded-xl shrink-0">
                            <Eye size={18} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-extrabold text-sidebar-text-active">
                                    {prospectName}
                                </h3>
                                {data.nslNumber && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/15 text-white font-bold">
                                        {data.nslNumber}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-sidebar-text">
                                Complete Read-Only Master Record • Order Enquiry
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-sidebar-text hover:text-white rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-border bg-app-bg/50 px-4 pt-2 gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer ${
                            activeTab === 'details'
                                ? 'border-primary text-primary bg-card-bg'
                                : 'border-transparent text-text-muted hover:text-text-main'
                        }`}
                    >
                        Enquiry Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('followUps')}
                        className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'followUps'
                                ? 'border-primary text-primary bg-card-bg'
                                : 'border-transparent text-text-muted hover:text-text-main'
                        }`}
                    >
                        <PhoneCall size={12} />
                        <span>Follow-up Logs</span>
                        {data.followUps?.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary">
                                {data.followUps.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
                    {activeTab === 'details' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40 sm:col-span-2">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    CUSTOMER
                                </span>
                                <div className="text-xs font-semibold text-text-main">{prospectName}</div>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Status
                                </span>
                                <div className="text-xs font-semibold text-text-main">{data.status || 'Open'}</div>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Enquiry Date
                                </span>
                                <div className="text-xs font-semibold text-text-main">
                                    {data.enquiryDate ? new Date(data.enquiryDate).toLocaleDateString() : '-'}
                                </div>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Category
                                </span>
                                <div className="text-xs font-semibold text-text-main">{data.productCategory || '-'}</div>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Quantity
                                </span>
                                <div className="text-xs font-semibold text-text-main">
                                    {data.totalOrderQuantity ? `${Number(data.totalOrderQuantity).toLocaleString('en-IN')} Bags` : '-'}
                                </div>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/60 bg-app-bg/40 sm:col-span-2">
                                <span className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Customer Requirement / Notes
                                </span>
                                <div className="text-xs font-semibold text-text-main whitespace-pre-wrap">
                                    {data.description || data.remarks || '-'}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'followUps' && (
                        <div>
                            {data?.followUps?.length > 0 ? (
                                <div className="space-y-3">
                                    {data.followUps.map((log, index) => (
                                        <div key={index} className="p-3 border border-border rounded-md bg-card-bg">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-xs text-primary">{log.communicationType || log.type}</span>
                                                <span className="text-xs text-text-muted">{new Date(log.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-text-main mt-1 whitespace-pre-wrap">{log.notes}</p>
                                            {log.nextFollowUpDate && (
                                                <div className="mt-2 text-[10px] text-text-muted flex items-center gap-1 font-mono">
                                                    <span>Next Action:</span>
                                                    <span className="font-bold">{new Date(log.nextFollowUpDate).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-text-muted italic">No follow-ups recorded.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-app-bg/60 border-t border-border flex items-center justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold rounded-lg text-xs cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
