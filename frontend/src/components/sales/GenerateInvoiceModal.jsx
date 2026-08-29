import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Receipt, AlertCircle, ShoppingCart } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function GenerateInvoiceModal({ isOpen, onClose, onSuccess }) {
    const [salesOrders, setSalesOrders] = useState([]);
    const [selectedSoId, setSelectedSoId] = useState('');
    const [gstRate, setGstRate] = useState(18);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const loadEligibleSalesOrders = async () => {
            try {
                setIsLoading(true);
                const res = await axiosInstance.get('/sales-orders?limit=100');
                if (res.data?.success && Array.isArray(res.data.data)) {
                    // Filter orders that are CONFIRMED or READY_FOR_DISPATCH or DISPATCHED
                    const eligible = res.data.data.filter(
                        (so) => so.status === 'CONFIRMED' || so.status === 'READY_FOR_DISPATCH' || so.status === 'DISPATCHED'
                    );
                    setSalesOrders(eligible.length > 0 ? eligible : res.data.data);
                    if (eligible.length > 0) {
                        setSelectedSoId(eligible[0]._id);
                    }
                }
            } catch (err) {
                console.error('Error fetching sales orders for invoice:', err);
                toast.error('Failed to load eligible Sales Orders');
            } finally {
                setIsLoading(false);
            }
        };

        loadEligibleSalesOrders();
    }, [isOpen]);

    if (!isOpen) return null;

    const selectedSO = salesOrders.find((so) => so._id === selectedSoId);
    const custObj = typeof selectedSO?.customer === 'object' ? selectedSO.customer : null;
    const customerName = custObj?.companyName || 'Registered Customer';
    const totalOrderValue = selectedSO?.totalAmount || selectedSO?.totalValue || 0;
    const estimatedGst = Math.round((totalOrderValue * gstRate) / 100);
    const estimatedGrandTotal = totalOrderValue + estimatedGst;

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!selectedSoId) {
            toast.error('Please select a Sales Order');
            return;
        }

        try {
            setIsGenerating(true);
            const res = await axiosInstance.post(`/invoices/from-sales-order/${selectedSoId}`, {
                gstRate: Number(gstRate)
            });

            if (res.data?.success) {
                const invNum = res.data.data?.invoiceNumber || 'Tax Invoice';
                toast.success(`Tax Invoice '${invNum}' generated successfully!`);
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error generating invoice:', err);
            toast.error(err.response?.data?.message || 'Failed to generate Tax Invoice');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 font-sans text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Receipt className="text-primary" size={18} />
                        <h3 className="font-bold text-sm text-text-main">Generate Tax Invoice from Sales Order</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-muted hover:text-text-main text-xs font-bold cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleGenerate} className="space-y-3.5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Select Confirmed Sales Order *
                        </label>
                        <select
                            required
                            value={selectedSoId}
                            onChange={(e) => setSelectedSoId(e.target.value)}
                            disabled={isLoading}
                            className="w-full border border-border rounded-lg p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50 font-sans"
                        >
                            {isLoading ? (
                                <option value="">Loading eligible Sales Orders...</option>
                            ) : salesOrders.length === 0 ? (
                                <option value="">No confirmed Sales Orders available</option>
                            ) : (
                                salesOrders.map((so) => {
                                    const cName = so.customer?.companyName || 'Customer';
                                    return (
                                        <option key={so._id} value={so._id}>
                                            {so.soNumber} — {cName} (Status: {so.status} &middot; ₹{(so.totalAmount || so.totalValue || 0).toLocaleString()})
                                        </option>
                                    );
                                })
                            )}
                        </select>
                    </div>

                    {selectedSO && (
                        <div className="bg-app-bg border border-border rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Customer / Buyer:</span>
                                <span className="font-bold text-text-main">{customerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Order Date:</span>
                                <span className="font-mono font-semibold text-text-main">
                                    {selectedSO.orderDate ? new Date(selectedSO.orderDate).toLocaleDateString() : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Taxable Subtotal:</span>
                                <span className="font-mono font-bold text-text-main">₹{totalOrderValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">GST Rate applied:</span>
                                <select
                                    value={gstRate}
                                    onChange={(e) => setGstRate(Number(e.target.value))}
                                    className="border border-border rounded px-2 py-0.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none"
                                >
                                    <option value={18}>18% GST (Standard)</option>
                                    <option value={12}>12% GST</option>
                                    <option value={5}>5% GST</option>
                                    <option value={0}>0% (Exempt)</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-border/80">
                                <span className="font-bold text-text-main">Estimated Grand Total:</span>
                                <span className="font-mono font-extrabold text-sm text-primary">₹{estimatedGrandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isGenerating || !selectedSoId}
                            className="px-5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <FileText size={14} />
                            <span>{isGenerating ? 'Generating Invoice...' : 'Generate Tax Invoice'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
