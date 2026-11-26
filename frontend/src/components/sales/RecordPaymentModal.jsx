import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { getTodayLocalDateString, formatDate } from '../../utils/dateUtils';

export default function RecordPaymentModal({ isOpen, invoice, po, onClose, onSuccess, type = 'invoice' }) {
    const isPO = type === 'po' || Boolean(po && !invoice);
    const target = isPO ? po : invoice;

    if (!isOpen || !target) return null;

    const totalValue = isPO ? Number(target.grandTotal ?? target.totalValue ?? 0) : Number(target.grandTotal || 0);
    const paidAmount = Number(target.paidAmount || 0);
    const balanceAmount = Math.max(0, Math.round((totalValue - paidAmount) * 100) / 100);

    const partyObj = isPO
        ? (typeof target.supplier === 'object' ? target.supplier : null)
        : (typeof target.customer === 'object' ? target.customer : null);
    const partyId = partyObj?._id || (typeof (isPO ? target.supplier : target.customer) === 'string' ? (isPO ? target.supplier : target.customer) : null);

    const [paymentAmount, setPaymentAmount] = useState(balanceAmount > 0 ? String(balanceAmount) : '');
    const [paymentDate, setPaymentDate] = useState(getTodayLocalDateString());
    const [paymentMode, setPaymentMode] = useState(target.paymentMode || 'UPI');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [availableAdvance, setAvailableAdvance] = useState(Number(partyObj?.advanceBalance || 0));
    const [applyAdvanceAmount, setApplyAdvanceAmount] = useState(0);
    const [confirmExcessToAdvance, setConfirmExcessToAdvance] = useState(false);

    useEffect(() => {
        if (target) {
            const tot = isPO ? Number(target.grandTotal ?? target.totalValue ?? 0) : Number(target.grandTotal || 0);
            const bal = Math.max(0, Math.round((tot - Number(target.paidAmount || 0)) * 100) / 100);
            setPaymentAmount(bal > 0 ? String(bal) : '');
            setPaymentDate(getTodayLocalDateString());
            setPaymentMode(target.paymentMode || 'UPI');
            setReference('');
            setNotes('');
            setApplyAdvanceAmount(0);
            setConfirmExcessToAdvance(false);
            setAvailableAdvance(Number(partyObj?.advanceBalance || 0));

            if (partyId) {
                const ledgerUrl = isPO ? `/purchase-orders/supplier-ledger/${partyId}` : `/invoices/customer-ledger/${partyId}`;
                axiosInstance.get(ledgerUrl)
                    .then((res) => {
                        if (res.data?.success && res.data?.data) {
                            setAvailableAdvance(Number(res.data.data.advanceBalance || 0));
                        }
                    })
                    .catch(() => {});
            }
        }
    }, [target, isPO, partyId]);

    const titlePrefix = isPO ? `Purchase Order ${target.poNumber || ''}` : `Invoice ${target.invoiceNumber || ''}`;
    const partyName = isPO
        ? (partyObj?.name || partyObj?.companyName || target.supplier)
        : (partyObj?.companyName || partyObj?.name || target.walkInCustomer?.name || 'Customer');
    const partyLabel = isPO ? 'supplier' : 'customer';

    const remainingAfterAdvance = Math.max(0, Math.round((balanceAmount - applyAdvanceAmount) * 100) / 100);
    const enteredAmt = Math.max(0, Number(paymentAmount || 0));
    const excessAmount = Math.max(0, Math.round((enteredAmt - remainingAfterAdvance) * 100) / 100);
    const needsExcessConfirm = excessAmount > 0.001;

    const handleApplyAdvance = () => {
        const maxApply = Math.min(availableAdvance, balanceAmount);
        setApplyAdvanceAmount(maxApply);
        const rem = Math.max(0, Math.round((balanceAmount - maxApply) * 100) / 100);
        setPaymentAmount(rem > 0 ? String(rem) : '0');
        setConfirmExcessToAdvance(false);
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const amt = Number(paymentAmount || 0);
        if ((isNaN(amt) || amt <= 0) && applyAdvanceAmount <= 0) {
            toast.error('Please enter a valid payment amount or apply available advance.');
            return;
        }

        if (needsExcessConfirm && !confirmExcessToAdvance) {
            toast.error(`Please confirm saving the excess ₹${excessAmount.toLocaleString('en-IN')} as Advance / Credit.`);
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
                applyAdvanceAmount,
                confirmExcessToAdvance,
                paymentDate,
                paymentMode,
                reference: reference.trim(),
                notes: notes.trim()
            };

            const res = await axiosInstance.patch(endpoint, payload);

            if (res.data?.success) {
                toast.success(res.data.message || `Payment recorded successfully!`);
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
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

                {(() => {
                    const discountAmt = Number(target.discountAmount ?? target.discount ?? 0);
                    const freightAmt = Number(target.freightAmount ?? target.freightCharges ?? 0);
                    const insuranceAmt = Number(target.insuranceAmount ?? target.insuranceCharges ?? 0);
                    const otherAmt = Number(target.otherChargesAmount ?? target.otherCharges ?? 0);
                    const otherLbl = target.otherChargesLabel || 'Charges';
                    const gstRateVal = target.gstTreatment === 'EXEMPT' ? 0 : Number(target.gstRate ?? 18);
                    const taxAmt = Number(target.taxAmount ?? target.gstAmount ?? 0);
                    const roundOffVal = Number(target.roundOff ?? 0);
                    const itemsSum = Array.isArray(target.items)
                        ? target.items.reduce((s, it) => s + Number(it.taxableValue ?? ((it.orderedQuantity ?? it.quantity ?? 0) * (it.ratePerUnit ?? 0))), 0)
                        : 0;
                    const itemsSubtotal = Number(target.itemsSubtotal ?? target.subtotal ?? (itemsSum > 0 ? itemsSum : totalValue));
                    const hasBreakdown = itemsSubtotal > 0 || discountAmt > 0 || freightAmt > 0 || insuranceAmt > 0 || otherAmt > 0 || taxAmt > 0 || roundOffVal !== 0;

                    return (
                        <div className="bg-app-bg border border-border rounded-lg p-3 space-y-1 text-xs">
                            {hasBreakdown && (
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-text-muted">Items Subtotal:</span>
                                        <span className="font-mono font-semibold text-text-main">₹{itemsSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {discountAmt > 0 && (
                                        <div className="flex justify-between items-center text-xs text-emerald-600">
                                            <span>Less: Discount{target.discountType === 'PERCENT' ? ` (${target.discountValue}%)` : ''}:</span>
                                            <span className="font-mono font-semibold">-₹{discountAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {freightAmt > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Freight / Transport:</span>
                                            <span className="font-mono font-semibold text-text-main">+₹{freightAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {insuranceAmt > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Insurance Charges:</span>
                                            <span className="font-mono font-semibold text-text-main">+₹{insuranceAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {otherAmt > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Other ({otherLbl}):</span>
                                            <span className="font-mono font-semibold text-text-main">+₹{otherAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {taxAmt > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">GST ({gstRateVal}%):</span>
                                            <span className="font-mono font-semibold text-text-main">₹{taxAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {roundOffVal !== 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Round Off:</span>
                                            <span className="font-mono font-semibold text-text-main">
                                                {roundOffVal >= 0 ? '+' : '-'}₹{Math.abs(roundOffVal).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={hasBreakdown ? 'border-t border-slate-200 my-2 pt-2 space-y-1' : 'space-y-1'}>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-900">Grand Total:</span>
                                    <span className="font-mono font-extrabold text-slate-900">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted">Already Paid:</span>
                                    <span className="font-mono font-semibold text-emerald-600">₹{paidAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-1 border-t border-border/80">
                                    <span className="font-bold text-slate-900">Balance Due:</span>
                                    <span className="font-mono font-extrabold text-amber-600">₹{balanceAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                {applyAdvanceAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs text-emerald-600 pt-0.5">
                                        <span className="font-semibold">Advance Applied:</span>
                                        <span className="font-mono font-bold">-₹{applyAdvanceAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {availableAdvance > 0 && balanceAmount > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-900">
                            <Wallet size={14} className="text-emerald-600 shrink-0" />
                            <span>Available advance: <strong className="font-mono">₹{availableAdvance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
                        </div>
                        {applyAdvanceAmount > 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setApplyAdvanceAmount(0);
                                    setPaymentAmount(String(balanceAmount));
                                }}
                                className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded font-bold text-[11px] cursor-pointer"
                            >
                                Clear
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleApplyAdvance}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] cursor-pointer"
                            >
                                Apply Advance
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleRecordPayment} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-main mb-1">
                                Amount (₹) *
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder={`Balance ₹${remainingAfterAdvance}`}
                                value={paymentAmount}
                                onChange={(e) => {
                                    setPaymentAmount(e.target.value);
                                    setConfirmExcessToAdvance(false);
                                }}
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

                    {needsExcessConfirm && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2 text-xs text-amber-950">
                            <div className="flex items-start gap-1.5 font-semibold">
                                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                <span>
                                    Amount exceeds balance by <strong>₹{excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>. The extra will be saved as Advance / Credit for this {partyLabel}.
                                </span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                <input
                                    type="checkbox"
                                    checked={confirmExcessToAdvance}
                                    onChange={(e) => setConfirmExcessToAdvance(e.target.checked)}
                                    className="accent-primary cursor-pointer"
                                />
                                <span>Confirm saving ₹{excessAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} as Advance / Credit</span>
                            </label>
                        </div>
                    )}

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
                            disabled={isSubmitting || (needsExcessConfirm && !confirmExcessToAdvance)}
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
