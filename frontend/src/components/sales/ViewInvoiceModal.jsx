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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:block">
            <style>
                {`
                  .no-scrollbar::-webkit-scrollbar {
                      display: none;
                  }
                  .no-scrollbar {
                      -ms-overflow-style: none;
                      scrollbar-width: none;
                  }

                  @media print {
                    body * { visibility: hidden; }
                    #printable-invoice, #printable-invoice * { visibility: visible; }
                    #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
                    @page { margin: 15mm; } /* Standard A4 margins */
                    
                    /* Hide scrollbars during print */
                    ::-webkit-scrollbar { display: none !important; }
                    * { scrollbar-width: none !important; }
                  }
                `}
            </style>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar print:max-h-none print:overflow-visible print:max-w-none">
                <div id="printable-invoice" className="bg-card-bg border border-border rounded-xl shadow-xl w-full p-6 space-y-4 font-sans text-xs print:max-w-none print:w-full print:p-0 print:border-none print:shadow-none">
                {/* Company Header */}
                <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                    <div>
                        <h1 className="text-lg md:text-xl font-extrabold uppercase text-text-main tracking-tight">
                            PP Poly & Paper Products
                        </h1>
                        <p className="text-xs text-gray-600 mt-0.5">Industrial Estate, Phase 2, Factory Outlet</p>
                        <p className="text-xs font-bold text-text-main mt-0.5">GSTIN: 06HDOPD5995P2ZF</p>
                    </div>

                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-extrabold text-base text-primary">
                                {invoice.invoiceNumber || 'INV-DETAIL'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                {invoice.paymentStatus || 'UNPAID'}
                            </span>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-text-muted hover:text-text-main text-sm font-bold cursor-pointer print:hidden ml-2"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wider font-semibold">
                            GST TAX INVOICE
                        </p>
                    </div>
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
                                <th className="p-2.5 text-right">Qty & Unit</th>
                                <th className="p-2.5 text-right">Rate (₹)</th>
                                <th className="p-2.5 text-right">Taxable Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-sans">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-app-bg/50">
                                    <td className="p-2.5 text-text-muted font-mono">{idx + 1}</td>
                                    <td className="p-2.5 font-semibold text-text-main">{it.description || 'Finished Poly Bag'}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-text-main">{Number(it.quantity || 0).toLocaleString()} {it.unit || 'Pcs'}</td>
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

                {/* Terms & Conditions & Signature Block */}
                <div className="border-t border-border mt-8 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                            Terms & Conditions
                        </div>
                        <div className="text-[9px] text-gray-500 space-y-0.5">
                            <p>1. Goods once sold will not be taken back.</p>
                            <p>2. Interest @18% p.a. will be charged if payment is delayed.</p>
                            <p>3. Subject to local jurisdiction.</p>
                        </div>
                    </div>

                    <div className="text-right sm:text-right">
                        <div className="text-xs font-bold text-text-main mb-8">
                            For PP Poly & Paper Products
                        </div>
                        <span className="text-[10px] border-t border-gray-400 pt-1 mt-10 inline-block text-text-muted">
                            Authorized Signatory
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border print:hidden">
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
        </div>
    );
}
