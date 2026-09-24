import { ShoppingCart, Calendar, User, MapPin, Package, CheckCircle2, FileText } from 'lucide-react';

export default function ViewSalesOrderModal({ isOpen, salesOrder, onClose, onGenerateInvoice, onEdit }) {
    if (!isOpen || !salesOrder) return null;

    const customer = typeof salesOrder.customer === 'object' ? salesOrder.customer : null;
    const customerName = customer?.companyName || salesOrder.customerName || 'Registered Customer';
    const items = salesOrder.items || [];
    const totalQty = items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const subtotal = salesOrder.totalValue || salesOrder.totalAmount || 0;
    const gstRate = 18;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const grandTotal = subtotal + gstAmount;

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
                            Order Date: <span className="font-mono font-bold text-text-main">{salesOrder.orderDate ? new Date(salesOrder.orderDate).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            Delivery Due: <span className="font-mono font-bold text-primary">{salesOrder.deliveryDue ? new Date(salesOrder.deliveryDue).toLocaleDateString() : '-'}</span>
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
                        Total Quantity: <strong className="text-text-main font-bold font-mono">{totalQty.toLocaleString()} Bags</strong>
                    </div>
                    <div className="text-right space-y-0.5">
                        <div className="text-[11px] text-text-muted">
                            Taxable Value: <span className="font-mono font-bold text-text-main">₹{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            Estimated GST (18%): <span className="font-mono font-bold text-text-main">₹{gstAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-xs font-bold text-text-main pt-1 border-t border-border/80">
                            Grand Total: <span className="font-mono font-extrabold text-sm text-primary">₹{grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {salesOrder.notes && (
                    <div className="text-xs text-text-muted bg-card-bg border border-border rounded-lg p-2.5">
                        <strong className="text-text-main">Instructions:</strong> {salesOrder.notes}
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-border">
                    <div>
                        {(salesOrder.status === 'DRAFT' || salesOrder.status === 'CONFIRMED') && onEdit && (
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
                    </div>
                    <div className="flex items-center gap-2">
                        {salesOrder.status !== 'DRAFT' && salesOrder.status !== 'CANCELLED' && onGenerateInvoice && (
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
