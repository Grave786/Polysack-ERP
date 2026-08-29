import { useState } from 'react';
import { Truck, CheckCircle2, XCircle, MapPin, Package, Calendar, User, Phone, FileCheck, AlertTriangle, ShieldCheck, UploadCloud, Eye, ZoomIn, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function ViewDispatchModal({ isOpen, dispatch, onClose, onOpenUploadPod, onSuccess }) {
    if (!isOpen || !dispatch) return null;

    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [isZoomedImageOpen, setIsZoomedImageOpen] = useState(false);

    const soObj = typeof dispatch.salesOrder === 'object' ? dispatch.salesOrder : null;
    const soNum = soObj?.soNumber || dispatch.soNumber || '-';
    const custObj = typeof soObj?.customer === 'object' ? soObj.customer : null;
    const customerName = custObj?.companyName || dispatch.customerName || 'Customer';

    const status = (dispatch.deliveryStatus || 'IN_TRANSIT').toUpperCase();
    const isDelivered = status === 'DELIVERED';
    const isPendingApproval = status === 'POD_PENDING_APPROVAL';
    const isInTransit = status === 'IN_TRANSIT';

    const items = dispatch.items || [];
    const totalBags = items.reduce((acc, i) => acc + Number(i.dispatchedQuantity || i.quantity || 0), 0);
    const totalBales = totalBags > 0 ? Math.ceil(totalBags / 300) : 0;

    // Linked Invoice & Payment Check
    const invoice = dispatch.invoice;
    const isInvoicePaid = invoice ? (invoice.paymentStatus === 'PAID' || (invoice.dueAmount !== undefined && invoice.dueAmount <= 0.001)) : true;
    const invoiceDue = invoice?.dueAmount !== undefined ? invoice.dueAmount : (invoice?.grandTotal || 0);

    const handleApproveDelivery = async () => {
        if (!isInvoicePaid) {
            toast.error(`Cannot approve delivery — outstanding payment of ₹${invoiceDue.toLocaleString()} remains on Invoice ${invoice?.invoiceNumber || ''}.`);
            return;
        }

        try {
            setIsApproving(true);
            const res = await axiosInstance.patch(`/dispatches/${dispatch._id}/delivery-status`, {
                action: 'APPROVE_POD'
            });

            if (res.data?.success) {
                toast.success(`Dispatch #${dispatch.dispatchNumber} delivery approved & marked as DELIVERED!`);
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error approving POD:', err);
            toast.error(err.response?.data?.message || 'Failed to approve delivery');
        } finally {
            setIsApproving(false);
        }
    };

    const handleRejectDelivery = async (e) => {
        if (e) e.preventDefault();

        try {
            setIsRejecting(true);
            const res = await axiosInstance.patch(`/dispatches/${dispatch._id}/delivery-status`, {
                action: 'REJECT_POD',
                rejectionReason: rejectReason.trim() || 'Proof of Delivery rejected by Admin. Please re-upload clearer proof.'
            });

            if (res.data?.success) {
                toast.success(`POD rejected. Dispatch #${dispatch.dispatchNumber} reverted to IN_TRANSIT.`);
                setShowRejectForm(false);
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error rejecting POD:', err);
            toast.error(err.response?.data?.message || 'Failed to reject POD');
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-start pb-3 border-b border-border">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-base text-primary">
                                    {dispatch.dispatchNumber || 'DISPATCH'}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                    isDelivered
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : isPendingApproval
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200 animate-pulse'
                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                    {isDelivered ? 'Delivered' : (isPendingApproval ? 'POD Pending Approval' : 'In Transit')}
                                </span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">
                                Vehicle Gate Pass, Delivery Challan & Logistics Ledger
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-text-muted hover:text-text-main text-sm font-bold cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Logistics Info Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg border border-border rounded-xl p-3.5">
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Transport & Vehicle</div>
                            <div className="font-mono font-bold text-sm text-text-main">{dispatch.vehicleNumber || '-'}</div>
                            <div className="font-semibold text-text-muted">{dispatch.transporter || 'Transporter Carrier'}</div>
                            {dispatch.driverName && (
                                <div className="text-[11px] text-text-muted">
                                    Driver: {dispatch.driverName} {dispatch.driverPhone ? `(${dispatch.driverPhone})` : ''}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 sm:text-right">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Sales Order & Buyer</div>
                            <div className="font-mono font-bold text-primary">{soNum}</div>
                            <div className="font-bold text-text-main">{customerName}</div>
                            <div className="text-[11px] text-text-muted">
                                Dispatched: {dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toLocaleDateString() : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Linked Invoice & Payment Status Card */}
                    {invoice && (
                        <div className="bg-app-bg border border-border rounded-xl p-3.5 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                    Associated Tax Invoice
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                    isInvoicePaid
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : 'bg-danger/10 text-danger border border-danger/20'
                                }`}>
                                    {invoice.paymentStatus || (isInvoicePaid ? 'PAID' : 'UNPAID')}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/60">
                                <div>
                                    <span className="text-[10px] text-text-muted block">Invoice Number</span>
                                    <span className="font-mono font-bold text-primary">{invoice.invoiceNumber}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-text-muted block">Grand Total</span>
                                    <span className="font-mono font-semibold text-text-main">₹{(invoice.grandTotal || 0).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-text-muted block">Outstanding Due</span>
                                    <span className={`font-mono font-extrabold ${invoiceDue > 0 ? 'text-danger' : 'text-emerald-700'}`}>
                                        ₹{invoiceDue.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {!isInvoicePaid && (
                                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 p-2.5 rounded-lg flex items-start gap-2 text-[11px]">
                                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">Delivery Gated by Payment:</span> Delivery cannot be approved into <strong>DELIVERED</strong> status until the outstanding balance of ₹{invoiceDue.toLocaleString()} on Invoice {invoice.invoiceNumber} is fully settled.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shipped Bag Items */}
                    <div className="border border-border rounded-xl overflow-hidden">
                        <div className="bg-table-header-bg p-2.5 font-bold uppercase text-[10px] tracking-wider text-table-header-text flex justify-between">
                            <span>Bags Shipped in Load</span>
                            <span className="font-mono">{totalBags.toLocaleString()} Bags ({totalBales} Bales)</span>
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border/60 bg-app-bg text-[10px] font-bold uppercase text-text-muted">
                                    <th className="p-2.5">#</th>
                                    <th className="p-2.5">Finished Bag Product</th>
                                    <th className="p-2.5 text-right">Shipped Bags</th>
                                    <th className="p-2.5 text-right">Bales</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 font-sans">
                                {items.map((it, idx) => {
                                    const fg = typeof it.finishedGood === 'object' ? it.finishedGood : null;
                                    const fgName = fg?.name || it.finishedGoodName || 'Finished Poly Bag';
                                    const qty = Number(it.dispatchedQuantity || it.quantity || 0);
                                    const bales = qty > 0 ? Math.ceil(qty / 300) : 0;

                                    return (
                                        <tr key={idx} className="hover:bg-app-bg/50">
                                            <td className="p-2.5 text-text-muted font-mono">{idx + 1}</td>
                                            <td className="p-2.5 font-semibold text-text-main">{fgName}</td>
                                            <td className="p-2.5 text-right font-mono font-bold text-text-main">{qty.toLocaleString()}</td>
                                            <td className="p-2.5 text-right font-mono text-text-muted">{bales}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Step 2: Approver Visual Review & POD Verification */}
                    <div className="bg-app-bg border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileCheck size={16} className="text-primary" />
                                <span className="font-bold uppercase tracking-wider text-[11px] text-text-main">
                                    Proof of Delivery (POD) Visual Verification
                                </span>
                            </div>
                            {isDelivered && (
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <ShieldCheck size={12} />
                                    <span>Verified & Delivered</span>
                                </span>
                            )}
                        </div>

                        {dispatch.pod ? (
                            <div className="space-y-3 text-xs">
                                {/* Uploaded Photo Display */}
                                {dispatch.pod.proofImage ? (
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase text-text-muted">
                                                Delivery Proof Photo (Uploaded by Driver/Dispatcher)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsZoomedImageOpen(true)}
                                                className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                            >
                                                <ZoomIn size={13} />
                                                <span>Click to Inspect / Full Size</span>
                                            </button>
                                        </div>
                                        <div
                                            onClick={() => setIsZoomedImageOpen(true)}
                                            className="relative border-2 border-border/80 hover:border-primary rounded-xl overflow-hidden bg-card-bg cursor-pointer group max-h-64 flex items-center justify-center p-2 transition-all shadow-xs"
                                        >
                                            <img
                                                src={dispatch.pod.proofImage}
                                                alt="Delivery Proof Document"
                                                className="max-h-60 w-auto object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[1px]">
                                                <ZoomIn size={18} />
                                                <span>Click to Enlarge</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-card-bg border border-border rounded-lg p-3 text-text-muted text-[11px]">
                                        📄 Document Reference: <span className="font-semibold text-text-main">{dispatch.pod.proofDocument || 'Physical Challan Recorded'}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card-bg border border-border p-3 rounded-lg">
                                    <div>
                                        <span className="text-[10px] text-text-muted block">Receiver Name</span>
                                        <span className="font-semibold text-text-main text-xs">{dispatch.pod.receiverName || 'Recorded'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-text-muted block">Receiver Phone</span>
                                        <span className="font-mono text-text-main text-xs">{dispatch.pod.receiverPhone || '-'}</span>
                                    </div>
                                </div>

                                {dispatch.pod.notes && (
                                    <div className="bg-card-bg border border-border p-3 rounded-lg">
                                        <span className="text-[10px] text-text-muted block">Delivery Remarks</span>
                                        <p className="text-text-main italic text-xs mt-0.5">{dispatch.pod.notes}</p>
                                    </div>
                                )}

                                {dispatch.pod.rejectionReason && (
                                    <div className="bg-danger/10 border border-danger/20 text-danger p-2.5 rounded-lg text-xs">
                                        <strong>Rejection Reason:</strong> {dispatch.pod.rejectionReason}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-text-muted text-[11px] py-2">
                                {isInTransit ? 'No Proof of Delivery uploaded yet. Driver/dispatcher must submit POD upon delivery.' : 'No POD recorded.'}
                            </div>
                        )}

                        {/* Step 1 Button: Upload POD if in transit */}
                        {isInTransit && onOpenUploadPod && (
                            <div className="pt-2 border-t border-border flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenUploadPod(dispatch);
                                    }}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <UploadCloud size={14} />
                                    <span>Step 1: Mark as Delivered & Upload Photo</span>
                                </button>
                            </div>
                        )}

                        {/* Step 2 Actions: Approve / Reject POD if POD_PENDING_APPROVAL */}
                        {isPendingApproval && !showRejectForm && (
                            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectForm(true)}
                                    className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <XCircle size={14} />
                                    <span>Reject POD</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!isInvoicePaid || isApproving}
                                    onClick={handleApproveDelivery}
                                    title={!isInvoicePaid ? `Cannot approve — unpaid balance of ₹${invoiceDue.toLocaleString()} on invoice` : 'Approve POD and complete delivery'}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <CheckCircle2 size={14} />
                                    <span>{isApproving ? 'Approving...' : 'Step 2: Approve Delivery'}</span>
                                </button>
                            </div>
                        )}

                        {/* Reject Reason Form */}
                        {showRejectForm && (
                            <form onSubmit={handleRejectDelivery} className="pt-2 border-t border-border space-y-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-danger mb-1">
                                        Reason for Rejecting POD (Dispatcher will be asked to re-upload) *
                                    </label>
                                    <textarea
                                        rows={2}
                                        required
                                        placeholder="e.g. Photo blurry, stamp missing, wrong buyer signature"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full border border-danger/30 rounded-lg p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-danger resize-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowRejectForm(false)}
                                        className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isRejecting}
                                        className="px-4 py-1.5 bg-danger hover:bg-danger-hover text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                                    >
                                        {isRejecting ? 'Rejecting...' : 'Confirm Reject & Revert to In Transit'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* High-Resolution Full-Screen Zoomed Image Viewer Modal */}
            {isZoomedImageOpen && dispatch.pod?.proofImage && (
                <div
                    className="fixed inset-0 bg-black/85 z-60 flex flex-col items-center justify-center p-4"
                    onClick={() => setIsZoomedImageOpen(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-card-bg border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-3 bg-app-bg border-b border-border">
                            <span className="font-bold text-xs text-text-main">
                                Proof of Delivery Photo — {dispatch.dispatchNumber}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsZoomedImageOpen(false)}
                                className="text-text-muted hover:text-text-main font-bold p-1 rounded-md"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center bg-black/10">
                            <img
                                src={dispatch.pod.proofImage}
                                alt="High Resolution Delivery Proof"
                                className="max-h-[75vh] w-auto object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
