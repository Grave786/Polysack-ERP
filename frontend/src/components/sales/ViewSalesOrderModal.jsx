import { ShoppingCart, Calendar, User, MapPin, Package, CheckCircle2, FileText, Factory, ExternalLink, Clock, XCircle, Truck, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/dateUtils';
import { useAuthStore } from '../../store/authStore';
import { hasModulePermission, hasApprovalPermission } from '../../utils/permissionUtils';

export default function ViewSalesOrderModal({ isOpen, salesOrder, onClose, onGenerateInvoice, onEdit, onQuickStatusChange, onCancelOrder, onApproveSo, onRejectSo }) {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const canAccessProduction = hasModulePermission(user, 'PRODUCTION');
    const canApprove = hasApprovalPermission(user);

    if (!isOpen || !salesOrder) return null;

    const approvalStatus = salesOrder.soApprovalStatus || 'Not Required';
    const isPendingApproval = approvalStatus === 'Pending Approval';
    const isRejectedApproval = approvalStatus === 'Rejected';

    const customer = typeof salesOrder.customer === 'object' ? salesOrder.customer : null;
    const se = typeof salesOrder.sourceEnquiry === 'object' ? salesOrder.sourceEnquiry : null;
    const seCust = se?.customer || se?.customerRef;
    const customerName = 
        customer?.companyName || 
        customer?.name || 
        salesOrder.customerName || 
        seCust?.companyName || 
        seCust?.name || 
        se?.newCustomerDetails?.company || 
        se?.newCustomerDetails?.name || 
        'Registered Customer';
    const items = salesOrder.items || [];
    const qtyByUnit = items.reduce((acc, it) => {
        const qty = Number(it.quantity || 0);
        if (qty > 0) {
            const unit = it.unit || 'Pcs';
            acc[unit] = (acc[unit] || 0) + qty;
        }
        return acc;
    }, {});
    const formattedTotalQty = Object.entries(qtyByUnit).length > 0
        ? Object.entries(qtyByUnit)
            .map(([unit, qty]) => `${qty % 1 === 0 ? qty.toLocaleString('en-IN') : Number(qty.toFixed(3)).toLocaleString('en-IN')} ${unit}`)
            .join(' + ')
        : '0 Pcs';
    const subtotal = salesOrder.totalValue || salesOrder.totalAmount || 0;
    const isGstExempt = salesOrder.gstTreatment === 'EXEMPT';
    const gstRate = isGstExempt ? 0 : (salesOrder.gstRate ?? 18);
    const gstAmount = isGstExempt ? 0 : (salesOrder.gstAmount ?? Math.round((subtotal * gstRate) / 100));
    const grandTotal = isGstExempt ? subtotal : (salesOrder.grandTotal ?? (subtotal + gstAmount));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start pb-3 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-base text-primary">
                                {salesOrder.soNumber || 'SO-DETAIL'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                {salesOrder.status || 'CONFIRMED'}
                            </span>
                            {isPendingApproval && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                    Pending Approval
                                </span>
                            )}
                            {isRejectedApproval && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                    Approval Rejected
                                </span>
                            )}
                            {isGstExempt && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    GST Exempt
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                            Customer Sales Order & Finished Goods Booking Record
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

                {/* Customer & Dates Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg border border-border rounded-xl p-3.5">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Buyer / Customer</div>
                        <div className="font-extrabold text-sm text-text-main">{customerName}</div>
                        {customer?.gstin && <div className="text-[11px] font-mono text-text-muted">GSTIN: {customer.gstin}</div>}
                        {customer?.phone && <div className="text-[11px] text-text-muted">Phone: {customer.phone}</div>}
                    </div>

                    <div className="space-y-1.5 sm:text-right">
                        <div className="text-[11px] text-text-muted">
                            Order Date: <span className="font-mono font-bold text-text-main">{formatDate(salesOrder.orderDate)}</span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            Delivery Due: <span className="font-mono font-bold text-primary">{formatDate(salesOrder.deliveryDue)}</span>
                        </div>
                        {salesOrder.dispatchLocation && (
                            <div className="text-[11px] text-text-muted">
                                Dock: <span className="font-semibold text-text-main">{salesOrder.dispatchLocation.name || 'Main Warehouse'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-border rounded-xl overflow-hidden">
                    <div className="bg-table-header-bg p-2.5 font-bold uppercase text-[10px] tracking-wider text-table-header-text">
                        Ordered Finished Bags
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-border/60 bg-app-bg text-[10px] font-bold uppercase text-text-muted">
                                <th className="p-2.5">#</th>
                                <th className="p-2.5">Bag Specification</th>
                                <th className="p-2.5 text-right">Quantity</th>
                                <th className="p-2.5 text-right">Rate (₹)</th>
                                <th className="p-2.5 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-sans">
                            {items.map((it, idx) => {
                                const fg = typeof it.finishedGood === 'object' ? it.finishedGood : null;
                                const fgName =
                                    it.product?.productName ||
                                    it.product?.title ||
                                    it.product?.name ||
                                    it.product?.bagName ||
                                    fg?.name ||
                                    fg?.title ||
                                    fg?.productName ||
                                    fg?.bagName ||
                                    it.finishedGoodName ||
                                    it.bagName ||
                                    it.description ||
                                    'Unknown Product';
                                const fgCode = it.product?.code || fg?.code || '';
                                const qty = Number(it.quantity || 0);
                                const rate = Number(it.ratePerUnit || 0);
                                const lineTotal = qty * rate;

                                return (
                                    <tr key={idx} className="hover:bg-app-bg/50">
                                        <td className="p-2.5 text-text-muted font-mono">{idx + 1}</td>
                                        <td className="p-2.5">
                                            <div className="font-semibold text-text-main">
                                                {it.product?.productName || it.product?.title || it.product?.name || it.product?.bagName || fg?.name || fg?.title || it.finishedGoodName || it.bagName || 'Unknown Product'}
                                            </div>
                                            {fgCode && <div className="text-[10px] font-mono text-text-muted">{fgCode}</div>}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-bold text-text-main">
                                            {qty.toLocaleString()} {it.unit && <span className="text-[10px] text-text-muted font-sans font-normal ml-0.5">{it.unit}</span>}
                                        </td>
                                        <td className="p-2.5 text-right font-mono">₹{rate.toFixed(2)}</td>
                                        <td className="p-2.5 text-right font-mono font-bold text-text-main">₹{lineTotal.toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Financial Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-app-bg border border-border rounded-xl p-3.5 gap-2">
                    <div className="text-xs text-text-muted">
                        Total Quantity: <strong className="text-text-main font-bold font-mono">{formattedTotalQty}</strong>
                    </div>
                    <div className="text-right space-y-0.5">
                        <div className="text-[11px] text-text-muted">
                            Items Subtotal: <span className="font-mono font-bold text-text-main">₹{Number(salesOrder.itemsSubtotal || subtotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        {Number(salesOrder.discountAmount || 0) > 0 && (
                            <div className="text-[11px] text-emerald-700">
                                Less: Discount{salesOrder.discountType === 'PERCENT' ? ` (${salesOrder.discountValue}%)` : ''}: <span className="font-mono font-bold">-₹{Number(salesOrder.discountAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {Number(salesOrder.freightAmount || 0) > 0 && (
                            <div className="text-[11px] text-text-muted">
                                Freight / Transport: <span className="font-mono font-semibold text-text-main">+₹{Number(salesOrder.freightAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {Number(salesOrder.insuranceAmount || 0) > 0 && (
                            <div className="text-[11px] text-text-muted">
                                Insurance Charges: <span className="font-mono font-semibold text-text-main">+₹{Number(salesOrder.insuranceAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {Number(salesOrder.otherChargesAmount || 0) > 0 && (
                            <div className="text-[11px] text-text-muted">
                                {salesOrder.otherChargesLabel ? `Other (${salesOrder.otherChargesLabel}):` : 'Other Charges:'} <span className="font-mono font-semibold text-text-main">+₹{Number(salesOrder.otherChargesAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        <div className="text-[11px] text-text-muted">
                            Taxable Value: <span className="font-mono font-bold text-text-main">₹{Number(salesOrder.taxableValue || subtotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            {isGstExempt ? 'GST (Exempt):' : `Estimated GST (${gstRate}%):`} <span className="font-mono font-bold text-text-main">₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        {Number(salesOrder.roundOff || 0) !== 0 && (
                            <div className="text-[11px] text-text-muted">
                                Round Off: <span className="font-mono font-semibold text-text-main">{Number(salesOrder.roundOff) > 0 ? `+₹${Number(salesOrder.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(salesOrder.roundOff)).toFixed(2)}`}</span>
                            </div>
                        )}
                        {isGstExempt && salesOrder.exemptionReason && (
                            <div className="text-[10px] text-emerald-800 font-semibold">
                                Exemption Reason: {salesOrder.exemptionReason}
                            </div>
                        )}
                        <div className="text-xs font-bold text-text-main pt-1 border-t border-border/80">
                            Grand Total: <span className="font-mono font-extrabold text-sm text-primary">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* PRODUCTION PLAN SECTION */}
                <div className="bg-app-bg border border-border rounded-lg p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex items-center gap-2">
                            <Factory size={14} className="text-primary" />
                            <span className="font-bold text-text-main uppercase tracking-wider text-[11px]">
                                Production Plan
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                salesOrder.productionStatus === 'Production Completed'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : salesOrder.productionStatus === 'In Production'
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                    : salesOrder.productionStatus === 'Fully Planned'
                                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                                    : salesOrder.productionStatus === 'Partially Planned'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                                {salesOrder.productionStatus || 'Not Planned'}
                            </span>
                        </div>
                        {canAccessProduction && !isPendingApproval && !isRejectedApproval && salesOrder.status === 'CONFIRMED' && salesOrder.productionStatus !== 'Fully Planned' && salesOrder.productionStatus !== 'Production Completed' && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    navigate('/production?tab=pending-production');
                                }}
                                className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <Factory size={12} />
                                <span>Create Work Order</span>
                            </button>
                        )}
                    </div>

                    {Array.isArray(salesOrder.productionPlan) && salesOrder.productionPlan.length > 0 ? (
                        <div className="space-y-2">
                            {salesOrder.productionPlan.map((plan, idx) => (
                                <div key={plan.lineId || idx} className="bg-card-bg border border-border rounded p-2.5 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-bold text-text-main text-xs">
                                            {plan.finishedGood?.name || items[idx]?.finishedGood?.name || `Line #${idx + 1}`}
                                        </span>
                                        <div className="flex items-center gap-3 font-mono text-[11px]">
                                            <span>Ordered: <strong>{Number(plan.orderedQuantity || 0).toLocaleString('en-IN')} {plan.orderedUnit}</strong></span>
                                            <span className="text-amber-700">Planned: <strong>{Number(plan.plannedQuantity || 0).toLocaleString('en-IN')}</strong></span>
                                            <span className="text-primary">Rem: <strong>{Number(plan.remainingQuantity || 0).toLocaleString('en-IN')}</strong></span>
                                        </div>
                                    </div>
                                    {Array.isArray(plan.linkedWorkOrders) && plan.linkedWorkOrders.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="text-[10px] text-text-muted font-semibold uppercase">Linked WOs:</span>
                                            {plan.linkedWorkOrders.map((wo) => (
                                                <button
                                                    key={wo._id}
                                                    type="button"
                                                    onClick={() => {
                                                        onClose();
                                                        navigate(`/production?id=${wo._id}`);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                                                >
                                                    <span>{wo.workOrderNumber}</span>
                                                    <span className="text-text-muted">({wo.status})</span>
                                                    <ExternalLink size={10} />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-text-muted italic">No Work Orders linked to this line yet.</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[11px] text-text-muted">
                            {items.map((it, idx) => (
                                <div key={it._id || idx} className="flex justify-between py-1 border-b border-border/40 last:border-b-0">
                                    <span>{it.finishedGood?.name || `Line #${idx + 1}`}</span>
                                    <span className="font-mono">
                                        Ordered: {Number(it.quantity || 0).toLocaleString('en-IN')} {it.unit || 'Pcs'} • Planned: {Number(it.plannedQuantity || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* CANCELLATION BANNER */}
                {salesOrder.status === 'CANCELLED' && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1 text-xs text-rose-900">
                        <div className="flex items-center gap-1.5 font-extrabold">
                            <XCircle size={14} className="text-rose-600" />
                            <span>Order Cancelled</span>
                            {salesOrder.cancelledAt && (
                                <span className="font-mono text-[11px] font-semibold text-rose-700 ml-auto">
                                    {formatDate(salesOrder.cancelledAt)}
                                </span>
                            )}
                        </div>
                        {salesOrder.cancellationReason && (
                            <div className="text-[11px]">
                                <strong>Reason:</strong> {salesOrder.cancellationReason}
                            </div>
                        )}
                        {salesOrder.cancelledBy?.name && (
                            <div className="text-[10px] text-rose-700">
                                Cancelled by: {salesOrder.cancelledBy.name}
                            </div>
                        )}
                    </div>
                )}

                {/* STATUS HISTORY TIMELINE */}
                {Array.isArray(salesOrder.statusHistory) && salesOrder.statusHistory.length > 0 && (
                    <div className="bg-app-bg border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-text-main uppercase tracking-wider text-[11px] border-b border-border pb-1.5">
                            <Clock size={13} className="text-primary" />
                            <span>Status Audit Trail</span>
                        </div>
                        <div className="space-y-1.5">
                            {salesOrder.statusHistory.map((h, idx) => (
                                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-card-bg border border-border/60 rounded px-2.5 py-1.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {h.from && (
                                            <>
                                                <span className="font-mono text-[10px] text-text-muted">{h.from.replace(/_/g, ' ')}</span>
                                                <span className="text-text-muted">→</span>
                                            </>
                                        )}
                                        <span className="font-mono font-extrabold text-[10px] text-primary">{(h.to || '').replace(/_/g, ' ')}</span>
                                        {h.changedByName && (
                                            <span className="text-text-muted">by <strong className="text-text-main">{h.changedByName}</strong></span>
                                        )}
                                        {h.remark && (
                                            <span className="text-text-muted italic">— "{h.remark}"</span>
                                        )}
                                    </div>
                                    <span className="font-mono text-[10px] text-text-muted">
                                        {formatDate(h.changedAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {salesOrder.notes && (
                    <div className="text-xs text-text-muted bg-card-bg border border-border rounded-lg p-2.5">
                        <strong className="text-text-main">Instructions:</strong> {salesOrder.notes}
                    </div>
                )}

                <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-border">
                    <div className="flex flex-wrap items-center gap-2">
                        {salesOrder.status !== 'CANCELLED' && onEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onEdit(salesOrder);
                                }}
                                className="px-3.5 py-1.5 bg-card-bg hover:bg-app-bg border border-border text-text-main font-bold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                                Edit Sales Order
                            </button>
                        )}
                        {salesOrder.status === 'CONFIRMED' && !isPendingApproval && !isRejectedApproval && onQuickStatusChange && (() => {
                            const isProductionCompleted =
                                ['Production Completed', 'Completed', 'Produced'].includes(salesOrder.productionStatus) ||
                                ['Production Completed', 'Completed', 'Produced'].includes(salesOrder.productionSummary?.status);
                            return (
                                <button
                                    type="button"
                                    disabled={!isProductionCompleted}
                                    onClick={() => isProductionCompleted && onQuickStatusChange(salesOrder, 'READY_FOR_DISPATCH')}
                                    title={isProductionCompleted ? 'Mark Ready for Dispatch' : 'Complete production before marking ready for dispatch'}
                                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                                        isProductionCompleted
                                            ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 cursor-pointer'
                                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                                    }`}
                                >
                                    <Truck size={13} />
                                    <span>Mark Ready for Dispatch</span>
                                </button>
                            );
                        })()}
                        {salesOrder.status === 'READY_FOR_DISPATCH' && onQuickStatusChange && (
                            <button
                                type="button"
                                onClick={() => onQuickStatusChange(salesOrder, 'DISPATCHED')}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <Truck size={13} />
                                <span>Mark Dispatched</span>
                            </button>
                        )}
                        {!['DISPATCHED', 'FULLY_DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(salesOrder.status) && onCancelOrder && (
                            <button
                                type="button"
                                onClick={() => onCancelOrder(salesOrder)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <XCircle size={13} />
                                <span>Cancel Order</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isPendingApproval && canApprove && onRejectSo && (
                            <button
                                type="button"
                                onClick={() => onRejectSo(salesOrder)}
                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                                <X size={13} />
                                <span>Reject</span>
                            </button>
                        )}
                        {isPendingApproval && canApprove && onApproveSo && (
                            <button
                                type="button"
                                onClick={() => onApproveSo(salesOrder)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                                <Check size={13} />
                                <span>Approve</span>
                            </button>
                        )}
                        {salesOrder.status !== 'DRAFT' && salesOrder.status !== 'CANCELLED' && !isPendingApproval && !isRejectedApproval && onGenerateInvoice && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onGenerateInvoice(salesOrder);
                                }}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <FileText size={14} />
                                <span>Generate Invoice</span>
                            </button>
                        )}
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
        </div>
    );
}
