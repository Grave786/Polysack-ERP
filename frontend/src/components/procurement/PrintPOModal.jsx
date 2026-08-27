import { useState, useEffect } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

export default function PrintPOModal({ isOpen, onClose, po }) {
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

        return {
            matName,
            qty,
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
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans animate-in fade-in duration-150">
            <div className="bg-card-bg border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5 print:p-0 print:border-none print:shadow-none print:max-w-none">
                
                {/* Modal Header Controls (Hidden on Print) */}
                <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
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

                {/* Printable Purchase Order Document */}
                <div className="bg-white text-slate-900 p-6 rounded-lg border border-slate-200 text-xs space-y-4 print:border-none print:p-0 font-sans">
                    {/* Header Banner */}
                    <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                                PURCHASE ORDER
                            </h1>
                            <p className="text-[11px] font-bold text-slate-700">PolySack ERP Manufacturing Ltd.</p>
                            <p className="text-[10px] text-slate-500">Plot 104, GIDC Industrial Estate, Vapi, Gujarat</p>
                            <p className="text-[10px] text-slate-500">GSTIN: 24AAACP1234A1Z8 | Contact: procurement@polysack.com</p>
                        </div>

                        <div className="text-right">
                            <span className="text-sm font-mono font-extrabold text-primary block">
                                {poNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                                Date: {poDate}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                                Expected: {expectedDelivery}
                            </span>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase rounded border border-amber-300">
                                {activePo.status || 'ISSUED'}
                            </span>
                        </div>
                    </div>

                    {/* Vendor / Supplier Information */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-200 text-[11px]">
                        <div>
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                VENDOR / SUPPLIER
                            </span>
                            <strong className="text-xs text-slate-900 block mt-0.5">{supplierName}</strong>
                            <span className="text-slate-600 block">Contact: {supplierContact}</span>
                            <span className="text-slate-600 block">Phone: {supplierPhone}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                TAX & DISPATCH DETAILS
                            </span>
                            <span className="text-slate-700 block font-mono mt-0.5">GSTIN: {supplierGstin}</span>
                            <span className="text-slate-600 block">Address: {supplierAddress}</span>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                            ORDERED MATERIALS & LINE ITEMS
                        </span>
                        <table className="w-full text-left border-collapse border border-slate-200 text-[11px]">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                                    <th className="p-2 border-r border-slate-200">#</th>
                                    <th className="p-2 border-r border-slate-200">RAW MATERIAL DESCRIPTION</th>
                                    <th className="p-2 border-r border-slate-200 text-right">QUANTITY</th>
                                    <th className="p-2 border-r border-slate-200 text-right">UNIT PRICE (₹)</th>
                                    <th className="p-2 text-right">TOTAL AMOUNT (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr className="border-b border-slate-200">
                                        <td colSpan={5} className="p-4 text-center text-slate-500">Loading line items...</td>
                                    </tr>
                                ) : formattedItems.length > 0 ? (
                                    formattedItems.map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-200 text-slate-800">
                                            <td className="p-2 border-r border-slate-200 font-mono text-[10px] text-center">{idx + 1}</td>
                                            <td className="p-2 border-r border-slate-200 font-semibold">{item.matName}</td>
                                            <td className="p-2 border-r border-slate-200 text-right font-mono">{item.qty.toLocaleString('en-IN')}</td>
                                            <td className="p-2 border-r border-slate-200 text-right font-mono">₹{item.price.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right font-mono font-bold">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr className="border-b border-slate-200 text-slate-800">
                                        <td className="p-2 border-r border-slate-200 text-center">1</td>
                                        <td className="p-2 border-r border-slate-200 font-semibold">Standard Poly Granules / Raw Stock</td>
                                        <td className="p-2 border-r border-slate-200 text-right font-mono">1,000</td>
                                        <td className="p-2 border-r border-slate-200 text-right font-mono">₹170</td>
                                        <td className="p-2 text-right font-mono font-bold">₹1,70,000</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Order Summary & Total */}
                    <div className="flex justify-between items-end pt-2">
                        <div className="text-[10px] text-slate-500 space-y-1">
                            <p className="font-bold text-slate-700">TERMS & CONDITIONS:</p>
                            <p>1. Material inward Subject to QC Inspection & Lab Approval.</p>
                            <p>2. Payment processed within 30 days of GRN generation.</p>
                        </div>

                        <div className="w-56 bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 text-right text-[11px]">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal:</span>
                                <span className="font-mono font-semibold">₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>GST (18%):</span>
                                <span className="font-mono">₹{gstTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-300 pt-1 text-xs">
                                <span>PO Grand Total:</span>
                                <span className="font-mono text-primary">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="pt-6 grid grid-cols-2 gap-8 text-[10px] text-slate-500">
                        <div>
                            <div className="border-b border-slate-300 pb-8"></div>
                            <span className="block mt-1 text-center font-bold text-slate-700 uppercase">PREPARED BY (PURCHASE OFFICER)</span>
                        </div>
                        <div>
                            <div className="border-b border-slate-300 pb-8"></div>
                            <span className="block mt-1 text-center font-bold text-slate-700 uppercase">AUTHORISED SIGNATORY (PLANT HEAD)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
