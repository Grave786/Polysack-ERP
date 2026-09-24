import { useState, useEffect } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { useAuthStore } from '../../store/authStore';

export default function PrintPOModal({ isOpen, onClose, po }) {
    const user = useAuthStore((state) => state.user);
    const [fullPo, setFullPo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && po?._id) {
            setIsLoading(true);
            axiosInstance.get(`/purchase-orders/${po._id}`)
                .then((res) => {
                    if (res.data?.success && res.data?.data) {
                        setFullPo(res.data.data);
                    } else {
                        setFullPo(po);
                    }
                })
                .catch(() => {
                    setFullPo(po);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setFullPo(po);
        }
    }, [isOpen, po]);

    if (!isOpen || !po) return null;

    const activePo = fullPo || po;

    const tenant = user?.tenant || user?.tenantData || {};
    const companyName = tenant?.companyName || tenant?.name || user?.companyName || 'PP Poly & Paper Products';
    const companyAddress = tenant?.address || tenant?.location || '';
    const companyGstin = tenant?.gstin || '';
    const companyContact = tenant?.contactEmail || tenant?.phone || user?.email || '';

    const terms = activePo.termsAndConditions || activePo.terms || null;

    const poNumber = activePo.poNumber || 'PO-0000';
    const poDate = activePo.poDate ? new Date(activePo.poDate).toLocaleDateString() : (activePo.createdAt ? new Date(activePo.createdAt).toLocaleDateString() : new Date().toLocaleDateString());
    const expectedDelivery = activePo.expectedDelivery ? new Date(activePo.expectedDelivery).toLocaleDateString() : 'N/A';

    const supplierName = typeof activePo.supplier === 'object' ? (activePo.supplier?.companyName || activePo.supplier?.name) : (activePo.supplier || 'N/A');
    const supplierContact = typeof activePo.supplier === 'object' ? (activePo.supplier?.contactPerson || activePo.supplier?.contactPersonName || '-') : '-';
    const supplierPhone = typeof activePo.supplier === 'object' ? (activePo.supplier?.phone || activePo.supplier?.phoneNumber || '-') : '-';
    const supplierGstin = typeof activePo.supplier === 'object' ? (activePo.supplier?.gstin || '-') : '-';
    const supplierAddress = typeof activePo.supplier === 'object' ? (activePo.supplier?.address || '-') : '-';

    const items = activePo.items || activePo.materials || [];

    // Calculate accurate line item totals
    let itemsSubtotal = 0;
    const formattedItems = items.map((item) => {
        const matName = typeof item.rawMaterial === 'object'
            ? (item.rawMaterial?.name || item.rawMaterial?.code)
            : (item.materialName || item.name || 'Raw Material');

        const qty = Number(item.orderedQuantity ?? item.quantity ?? item.qty ?? 0);
        const price = Number(item.ratePerUnit ?? item.unitPrice ?? item.rate ?? 0);
        const lineTotal = qty * price;
        itemsSubtotal += lineTotal;

        const unit = item.unit || (typeof item.rawMaterial === 'object' && (item.rawMaterial?.uom?.symbol || item.rawMaterial?.uom?.name || item.rawMaterial?.uom)) || 'Kg';

        return {
            matName,
            qty,
            unit,
            price,
            lineTotal
        };
    });

    const subtotal = itemsSubtotal > 0 ? itemsSubtotal : (activePo.totalValue || 0);
    const gstTax = subtotal * 0.18;
    const grandTotal = subtotal + gstTax;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150 print:absolute print:inset-0 print:bg-white print:z-50 print:p-0 print:block">
            <style>
                {`
                  /* Hide scrollbar for Chrome, Safari and Opera */
                  .no-scrollbar::-webkit-scrollbar {
                      display: none;
                  }
                  /* Hide scrollbar for IE, Edge and Firefox */
                  .no-scrollbar {
                      -ms-overflow-style: none;  /* IE and Edge */
                      scrollbar-width: none;  /* Firefox */
                  }

                  @media print {
                    body * { visibility: hidden; }
                    #printable-po-document, #printable-po-document * { visibility: visible; }
                    #printable-po-document { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-shadow: none; }
                    @page { margin: 15mm; } /* Standard A4 margin */
                    body { padding: 0 !important; }
                    
                    /* Hide scrollbars during print */
                    ::-webkit-scrollbar { display: none !important; }
                    * { scrollbar-width: none !important; overflow: visible !important; }
                  }
                `}
            </style>
            <div className="bg-card-bg border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto no-scrollbar print:max-h-none print:overflow-visible print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full">

                {/* Modal Header Controls (Hidden on Print) */}
                <div className="sticky top-0 z-10 bg-card-bg/95 backdrop-blur-xs flex items-center justify-between border-b border-border pt-6 pb-4 px-6 print:hidden">
                    <div className="flex items-center gap-2">
                        <FileText size={20} className="text-primary" />
                        <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                            Purchase Order Document ({poNumber})
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-sidebar-bg font-extrabold text-xs rounded-lg shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
                        >
                            <Printer size={14} />
                            <span>Print / Save PDF</span>
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

                <div className="p-6 print:p-0">
                    {/* Printable Purchase Order Document */}
                    <div
                        id="printable-po-document"
                        className="bg-white text-slate-900 p-8 sm:p-10 rounded-lg border border-slate-200 space-y-5 mb-10 print:mb-0 print:border-none print:p-0 font-sans print:max-w-none print:w-full"
                    >
                        {/* Header Banner */}
                        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                            <div>
                                <h1 className="text-lg md:text-lg print:text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                                    PURCHASE ORDER
                                </h1>
                                <p className="text-xs md:text-sm print:text-base font-bold text-slate-800 mt-1">{companyName}</p>
                                {companyAddress && <p className="text-xs print:text-sm text-slate-600">{companyAddress}</p>}
                                {(companyGstin || companyContact) && (
                                    <p className="text-xs print:text-sm text-slate-600">
                                        {[companyGstin ? `GSTIN: ${companyGstin}` : '', companyContact ? `Contact: ${companyContact}` : ''].filter(Boolean).join(' | ')}
                                    </p>
                                )}
                            </div>

                            <div className="text-right">
                                <span className="text-sm md:text-base print:text-base font-mono font-extrabold text-primary block">
                                    {poNumber}
                                </span>
                                <span className="text-xs print:text-sm text-slate-600 font-mono block">
                                    Date: {poDate}
                                </span>
                                <span className="text-xs print:text-sm text-slate-600 font-mono block">
                                    Expected: {expectedDelivery}
                                </span>
                                <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-extrabold uppercase rounded border border-amber-300">
                                    {activePo.status || 'ISSUED'}
                                </span>
                            </div>
                        </div>

                        {/* Vendor / Supplier Information */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-200 text-xs print:text-sm">
                            <div>
                                <span className="text-[10px] print:text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                                    VENDOR / SUPPLIER
                                </span>
                                <strong className="text-xs md:text-sm print:text-base text-slate-900 block mt-0.5">{supplierName}</strong>
                                <span className="text-slate-600 block text-xs print:text-sm">Contact: {supplierContact}</span>
                                <span className="text-slate-600 block text-xs print:text-sm">Phone: {supplierPhone}</span>
                            </div>
                            <div>
                                <span className="text-[10px] print:text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                                    TAX & DISPATCH DETAILS
                                </span>
                                <span className="text-slate-700 block font-mono text-xs print:text-sm mt-0.5">GSTIN: {supplierGstin}</span>
                                <span className="text-slate-600 block text-xs print:text-sm">Address: {supplierAddress}</span>
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <div>
                            <span className="text-[10px] print:text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
                                ORDERED MATERIALS & LINE ITEMS
                            </span>
                            <table className="w-full text-left border-collapse border border-slate-200 text-xs print:text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] print:text-sm">
                                        <th className="p-2.5 border-r border-slate-200">#</th>
                                        <th className="p-2.5 border-r border-slate-200">RAW MATERIAL DESCRIPTION</th>
                                        <th className="p-2.5 border-r border-slate-200 text-right">QUANTITY</th>
                                        <th className="p-2.5 border-r border-slate-200 text-right">UNIT PRICE (₹)</th>
                                        <th className="p-2.5 text-right">TOTAL AMOUNT (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr className="border-b border-slate-200">
                                            <td colSpan={5} className="p-4 text-center text-slate-500 text-xs print:text-sm">Loading line items...</td>
                                        </tr>
                                    ) : formattedItems.length > 0 ? (
                                        formattedItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-200 text-slate-800 text-xs print:text-sm">
                                                <td className="p-2.5 border-r border-slate-200 font-mono text-center">{idx + 1}</td>
                                                <td className="p-2.5 border-r border-slate-200 font-semibold">{item.matName}</td>
                                                <td className="p-2.5 border-r border-slate-200 text-right font-mono">{item.qty.toLocaleString('en-IN')} {item.unit}</td>
                                                <td className="p-2.5 border-r border-slate-200 text-right font-mono">₹{item.price.toLocaleString('en-IN')}</td>
                                                <td className="p-2.5 text-right font-mono font-bold">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr className="border-b border-slate-200 text-slate-800 text-xs print:text-sm">
                                            <td className="p-2.5 border-r border-slate-200 text-center">1</td>
                                            <td className="p-2.5 border-r border-slate-200 font-semibold">Standard Poly Granules / Raw Stock</td>
                                            <td className="p-2.5 border-r border-slate-200 text-right font-mono">1,000</td>
                                            <td className="p-2.5 border-r border-slate-200 text-right font-mono">₹170</td>
                                            <td className="p-2.5 text-right font-mono font-bold">₹1,70,000</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Order Summary & Total */}
                        <div className="flex justify-between items-end pt-2">
                            <div className="text-xs print:text-sm text-slate-600 space-y-1">
                                <p className="font-bold text-slate-800 text-xs print:text-sm">TERMS & CONDITIONS:</p>
                                {Array.isArray(terms) && terms.length > 0 ? (
                                    terms.map((term, idx) => (
                                        <p key={idx}>{idx + 1}. {term}</p>
                                    ))
                                ) : typeof terms === 'string' && terms.trim() ? (
                                    terms.split('\n').filter(Boolean).map((line, idx) => (
                                        <p key={idx}>{line.startsWith(`${idx + 1}.`) ? line : `${idx + 1}. ${line}`}</p>
                                    ))
                                ) : (
                                    <>
                                        <p>1. Material inward Subject to QC Inspection & Lab Approval.</p>
                                        <p>2. Payment processed within agreed terms of GRN generation.</p>
                                    </>
                                )}
                            </div>

                            <div className="w-64 bg-slate-50 p-3 rounded border border-slate-200 space-y-1 text-right text-xs print:text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal:</span>
                                    <span className="font-mono font-semibold">₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>GST (18%):</span>
                                    <span className="font-mono">₹{gstTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-300 pt-1 text-sm print:text-base">
                                    <span>PO Grand Total:</span>
                                    <span className="font-mono text-primary">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="pt-8 grid grid-cols-2 gap-8 text-xs print:text-sm text-slate-500">
                            <div>
                                <div className="border-b border-slate-300 pb-8"></div>
                                <span className="block mt-1 text-center font-bold text-slate-700 uppercase text-xs print:text-sm">PREPARED BY (PURCHASE OFFICER)</span>
                            </div>
                            <div>
                                <div className="border-b border-slate-300 pb-8"></div>
                                <span className="block mt-1 text-center font-bold text-slate-700 uppercase text-xs print:text-sm">AUTHORISED SIGNATORY (PLANT HEAD)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
