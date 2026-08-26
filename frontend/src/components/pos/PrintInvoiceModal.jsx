import { Printer, X, CheckCircle, FileText } from 'lucide-react';

export default function PrintInvoiceModal({ isOpen, onClose, invoice }) {
    if (!isOpen || !invoice) return null;

    const invoiceNumber = invoice.invoiceNumber || 'INV-000';
    const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : new Date().toLocaleString();
    const paymentMode = invoice.paymentMode || 'CASH';

    // Customer details
    const isWalkIn = invoice.customerType === 'WALK_IN' || !invoice.customer;
    const customerName = isWalkIn
        ? (invoice.walkInDetails?.name || 'Counter Retail Customer')
        : (invoice.customer?.companyName || invoice.customer?.contactPersonName || 'Registered Customer');
    
    const customerGstin = isWalkIn
        ? (invoice.walkInDetails?.gstin || 'UNREGISTERED')
        : (invoice.customer?.gstin || 'UNREGISTERED');

    const customerPhone = isWalkIn
        ? (invoice.walkInDetails?.phone || '-')
        : (invoice.customer?.phone || '-');

    const items = invoice.items || [];
    const subtotal = invoice.subtotal || invoice.totalAmount || 0;
    const cgst = invoice.cgstAmount || (invoice.taxAmount ? invoice.taxAmount / 2 : 0);
    const sgst = invoice.sgstAmount || (invoice.taxAmount ? invoice.taxAmount / 2 : 0);
    const grandTotal = invoice.grandTotal || invoice.totalAmount || 0;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="bg-card-bg border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5 print:p-0 print:border-none print:shadow-none print:max-w-none">
                
                {/* Modal Header Controls (Hidden on Print) */}
                <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={20} className="text-emerald-500" />
                        <h2 className="text-base font-bold text-text-main">
                            POS Sale Completed Successfully!
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-sidebar-bg font-extrabold text-xs rounded-lg shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
                        >
                            <Printer size={14} />
                            <span>Print Invoice</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-text-muted hover:text-text-main rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Printable Invoice Container */}
                <div className="bg-white text-slate-900 p-6 rounded-lg border border-slate-200 text-xs space-y-4 print:border-none print:p-0 font-sans">
                    {/* Invoice Top Bar */}
                    <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                                TAX INVOICE
                            </h1>
                            <p className="text-[11px] font-bold text-slate-600">Polysack ERP - Packaging Solutions</p>
                            <p className="text-[10px] text-slate-500">Industrial Estate, Phase 2, Factory Outlet</p>
                        </div>

                        <div className="text-right">
                            <span className="text-xs font-mono font-bold text-slate-900 block">
                                {invoiceNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                                Date: {invoiceDate}
                            </span>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase rounded">
                                PAID ({paymentMode})
                            </span>
                        </div>
                    </div>

                    {/* Customer & Billed-To Info */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 text-[11px]">
                        <div>
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                BILLED TO (CUSTOMER)
                            </span>
                            <strong className="text-xs text-slate-900 block mt-0.5">{customerName}</strong>
                            <span className="text-slate-600 block">Phone: {customerPhone}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                GSTIN / TAX ID
                            </span>
                            <strong className="text-xs font-mono text-slate-900 block mt-0.5">{customerGstin}</strong>
                            <span className="text-slate-600 block">Customer Type: {isWalkIn ? 'Walk-in Retail' : 'Registered B2B'}</span>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-300 text-[9px] font-extrabold uppercase text-slate-600">
                                    <th className="p-2">#</th>
                                    <th className="p-2">FINISHED GOOD ITEM SPEC</th>
                                    <th className="p-2 text-right">QTY (BAGS)</th>
                                    <th className="p-2 text-right">UNIT PRICE (₹)</th>
                                    <th className="p-2 text-right">AMOUNT (₹)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 font-mono">
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 text-slate-500">{idx + 1}</td>
                                        <td className="p-2 font-sans font-semibold text-slate-900">
                                            {item.finishedGood?.name || item.name || 'Poly Bag Spec'}
                                        </td>
                                        <td className="p-2 text-right font-bold">{item.quantity}</td>
                                        <td className="p-2 text-right">₹{item.unitPrice || item.pricePerBag || 0}</td>
                                        <td className="p-2 text-right font-bold text-slate-900">
                                            ₹{((item.quantity || 0) * (item.unitPrice || item.pricePerBag || 0)).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex justify-end border-t border-slate-200 pt-3 text-xs">
                        <div className="w-64 space-y-1.5 text-right font-mono">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 text-[11px]">
                                <span>CGST (9%):</span>
                                <span>₹{cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 text-[11px]">
                                <span>SGST (9%):</span>
                                <span>₹{sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-slate-300 pt-1.5">
                                <span>GRAND TOTAL:</span>
                                <span>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Terms / Footer */}
                    <div className="border-t border-dashed border-slate-300 pt-3 text-[10px] text-slate-500 text-center">
                        Thank you for your business! Computer-generated tax invoice. No signature required.
                    </div>
                </div>

                {/* Bottom Close Button (Hidden on Print) */}
                <div className="flex justify-end pt-2 print:hidden">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-app-bg border border-border text-text-muted hover:text-text-main font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                        Done & Close
                    </button>
                </div>
            </div>
        </div>
    );
}
