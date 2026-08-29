import { Receipt, Printer, CreditCard, CheckCircle2, User } from 'lucide-react';

export default function ViewInvoiceModal({ isOpen, invoice, onClose, onRecordPayment }) {
    if (!isOpen || !invoice) return null;

    const customer = typeof invoice.customer === 'object' ? invoice.customer : null;
    const isWalkIn = invoice.customerType === 'WALK_IN' || !customer;
    const customerName = customer?.companyName || invoice.walkInCustomer?.name || (isWalkIn ? 'Walk-in Customer' : 'Registered Customer');
    const items = invoice.items || [];
    const grandTotal = invoice.grandTotal || 0;
    const paidAmount = invoice.paidAmount || 0;
    const dueAmount = invoice.dueAmount !== undefined ? invoice.dueAmount : Math.max(0, grandTotal - paidAmount);
    const isPaid = invoice.paymentStatus === 'PAID';

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start pb-3 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-base text-primary">
                                {invoice.invoiceNumber || 'INV-DETAIL'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                                {invoice.paymentStatus || 'UNPAID'}
                            </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                            GST Tax Invoice & Financial Audit Record (Immutable)
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

                {/* Customer & Invoice Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg border border-border rounded-xl p-3.5">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Billed To</div>
                        <div className="font-extrabold text-sm text-text-main">{customerName}</div>
                        {customer?.gstin && <div className="text-[11px] font-mono text-text-muted">GSTIN: {customer.gstin}</div>}
                        {invoice.walkInCustomer?.phone && <div className="text-[11px] text-text-muted">Phone: {invoice.walkInCustomer.phone}</div>}
                    </div>

                    <div className="space-y-1 sm:text-right">
                        <div className="text-[11px] text-text-muted">
                            Invoice Date: <span className="font-mono font-bold text-text-main">{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '-'}</span>
                        </div>
                        {invoice.salesOrder && (
                            <div className="text-[11px] text-text-muted">
                                Sales Order Ref: <span className="font-mono font-bold text-primary">{invoice.salesOrder.soNumber || 'SO'}</span>
                            </div>
                        )}
                        <div className="text-[11px] text-text-muted">
                            Payment Mode: <span className="font-semibold text-text-main">{invoice.paymentMode || 'CASH'}</span>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-border/60 bg-table-header-bg text-[10px] font-bold uppercase text-table-header-text">
                                <th className="p-2.5">#</th>
                                <th className="p-2.5">Description</th>
                                <th className="p-2.5 text-right">Quantity</th>
                                <th className="p-2.5 text-right">Rate (₹)</th>
                                <th className="p-2.5 text-right">Taxable Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-sans">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-app-bg/50">
                                    <td className="p-2.5 text-text-muted font-mono">{idx + 1}</td>
                                    <td className="p-2.5 font-semibold text-text-main">{it.description || 'Finished Poly Bag'}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-text-main">{Number(it.quantity || 0).toLocaleString()}</td>
                                    <td className="p-2.5 text-right font-mono">₹{Number(it.ratePerUnit || 0).toFixed(2)}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-text-main">₹{Number(it.taxableValue || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-app-bg border border-border rounded-xl p-3.5">
                    <div className="space-y-1 text-xs">
                        <div className="text-text-muted">CGST (9%): <span className="font-mono font-semibold text-text-main">₹{(invoice.cgstAmount || 0).toLocaleString()}</span></div>
                        <div className="text-text-muted">SGST (9%): <span className="font-mono font-semibold text-text-main">₹{(invoice.sgstAmount || 0).toLocaleString()}</span></div>
                        {invoice.igstAmount > 0 && (
                            <div className="text-text-muted">IGST (18%): <span className="font-mono font-semibold text-text-main">₹{invoice.igstAmount.toLocaleString()}</span></div>
                        )}
                    </div>

                    <div className="space-y-1 sm:text-right">
                        <div className="text-xs font-bold text-text-main">
                            Grand Total: <span className="font-mono font-extrabold text-sm text-primary">₹{grandTotal.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700">
                            Paid: <span className="font-mono font-bold">₹{paidAmount.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-amber-800 font-bold">
                            Outstanding Due: <span className="font-mono">₹{dueAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-1.5 bg-card-bg hover:bg-app-bg border border-border text-text-main font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Printer size={14} />
                        <span>Print Invoice</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {!isPaid && onRecordPayment && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onRecordPayment(invoice);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CreditCard size={14} />
                                <span>Record Payment</span>
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
