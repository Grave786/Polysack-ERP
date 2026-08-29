import { useState } from 'react';
import { CreditCard, CheckCircle2, DollarSign } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function RecordPaymentModal({ isOpen, invoice, onClose, onSuccess }) {
    if (!isOpen || !invoice) return null;

    const [paymentAmount, setPaymentAmount] = useState(
        invoice.dueAmount !== undefined ? String(invoice.dueAmount) : String(invoice.grandTotal || 0)
    );
    const [paymentMode, setPaymentMode] = useState(invoice.paymentMode || 'UPI');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const grandTotal = invoice.grandTotal || 0;
    const paidAmount = invoice.paidAmount || 0;
    const dueAmount = invoice.dueAmount !== undefined ? invoice.dueAmount : Math.max(0, grandTotal - paidAmount);

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const amt = Number(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid payment amount greater than 0.');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await axiosInstance.patch(`/invoices/${invoice._id}/payment`, {
                amount: amt,
                paymentAmount: amt,
                paymentMode
            });

            if (res.data?.success) {
                toast.success(`Payment recorded for Invoice ${invoice.invoiceNumber}! Status: ${res.data.data?.paymentStatus}`);
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error recording payment:', err);
            toast.error(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <CreditCard className="text-primary" size={18} />
                        <h3 className="font-bold text-sm text-text-main">Record Payment for {invoice.invoiceNumber}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-muted hover:text-text-main text-xs font-bold cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <div className="bg-app-bg border border-border rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Invoice Grand Total:</span>
                        <span className="font-mono font-bold text-text-main">₹{grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Already Paid:</span>
                        <span className="font-mono font-semibold text-emerald-700">₹{paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border/80">
                        <span className="font-bold text-text-main">Current Outstanding Due:</span>
                        <span className="font-mono font-extrabold text-amber-700">₹{dueAmount.toLocaleString()}</span>
                    </div>
                </div>

                <form onSubmit={handleRecordPayment} className="space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Payment Amount (₹) *
                        </label>
                        <input
                            type="number"
                            required
                            min="1"
                            max={dueAmount > 0 ? dueAmount : grandTotal}
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Payment Mode *
                        </label>
                        <select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="UPI">UPI / NetBanking</option>
                            <option value="CASH">Cash</option>
                            <option value="CARD">Debit / Credit Card</option>
                            <option value="OTHER">Bank Transfer / Cheque</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <CheckCircle2 size={14} />
                            <span>{isSubmitting ? 'Recording...' : 'Confirm & Update Status'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
