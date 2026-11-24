import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, DollarSign } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { getTodayLocalDateString, formatDate } from '../../utils/dateUtils';

export default function RecordPaymentModal({ isOpen, invoice, po, onClose, onSuccess, type = 'invoice' }) {
    const isPO = type === 'po' || Boolean(po && !invoice);
    const target = isPO ? po : invoice;

    if (!isOpen || !target) return null;

    const totalValue = isPO ? (target.totalValue || 0) : (target.grandTotal || 0);
    const paidAmount = target.paidAmount || 0;
    const balanceAmount = target.balanceAmount !== undefined && target.balanceAmount !== null
        ? target.balanceAmount
        : (target.dueAmount !== undefined ? target.dueAmount : Math.max(0, totalValue - paidAmount));

    const [paymentAmount, setPaymentAmount] = useState(balanceAmount > 0 ? String(balanceAmount) : '');
    const [paymentDate, setPaymentDate] = useState(getTodayLocalDateString());
    const [paymentMode, setPaymentMode] = useState(target.paymentMode || 'UPI');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (target) {
            const bal = target.balanceAmount !== undefined && target.balanceAmount !== null
                ? target.balanceAmount
                : (target.dueAmount !== undefined ? target.dueAmount : Math.max(0, (isPO ? target.totalValue : target.grandTotal) - (target.paidAmount || 0)));
            setPaymentAmount(bal > 0 ? String(bal) : '');
            setPaymentDate(getTodayLocalDateString());
            setPaymentMode(target.paymentMode || 'UPI');
            setReference('');
            setNotes('');
        }
    }, [target, isPO]);

    const titlePrefix = isPO ? `Purchase Order ${target.poNumber || ''}` : `Invoice ${target.invoiceNumber || ''}`;
    const partyName = isPO
        ? (typeof target.supplier === 'object' ? (target.supplier?.name || target.supplier?.companyName) : target.supplier)
        : (typeof target.customer === 'object' ? (target.customer?.companyName || target.customer?.name) : (target.walkInCustomer?.name || 'Customer'));

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const amt = Number(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid payment amount greater than 0.');
            return;
        }

        if (amt > balanceAmount + 0.001) {
            toast.error(`Payment amount (₹${amt}) cannot exceed remaining balance (₹${balanceAmount.toFixed(2)}).`);
            return;
        }

        try {
            setIsSubmitting(true);
            const endpoint = isPO
                ? `/purchase-orders/${target._id}/payment`
                : `/invoices/${target._id}/payment`;

            const payload = {
                amount: amt,
                paymentAmount: amt,
                paymentDate,
                paymentMode,
                reference: reference.trim(),
                notes: notes.trim()
            };

            const res = await axiosInstance.patch(endpoint, payload);

            if (res.data?.success) {
                toast.success(`Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully!`);
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
                        <div>
                            <h3 className="font-bold text-sm text-text-main">Record Payment</h3>
                            <p className="text-[11px] text-text-muted">{titlePrefix} • {partyName || 'Party'}</p>
                        </div>
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
                        <span className="text-text-muted">Total Amount:</span>
                        <span className="font-mono font-bold text-text-main">₹{totalValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-text-muted">Already Paid:</span>
                        <span className="font-mono font-semibold text-emerald-700">₹{paidAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border/80">
                        <span className="font-bold text-text-main">Current Outstanding Balance:</span>
                        <span className="font-mono font-extrabold text-amber-700">₹{balanceAmount.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <form onSubmit={handleRecordPayment} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Amount (₹) *
                            </label>
                            <input
                                type="number"
                                required
                                min="0.01"
                                max={balanceAmount > 0 ? balanceAmount : totalValue}
                                step="any"
                                placeholder={`Max ₹${balanceAmount}`}
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Payment Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-card-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
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
                            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                            Reference / UTR / Cheque # (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. UTR-98234123, CHQ-102938"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full border border-border rounded-lg p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                        />
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
                            <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
