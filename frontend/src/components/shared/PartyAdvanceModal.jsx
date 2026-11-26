import { useState, useEffect } from 'react';
import { Wallet, CheckCircle2, X, Clock } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { getTodayLocalDateString, formatDate } from '../../utils/dateUtils';

export default function PartyAdvanceModal({
    isOpen,
    onClose,
    onSuccess,
    partyType = 'CUSTOMER', // 'CUSTOMER' | 'SUPPLIER'
    partyId,
    partyName,
    initialMode = 'RECORD' // 'RECORD' | 'LEDGER'
}) {
    const [mode, setMode] = useState(initialMode);
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(getTodayLocalDateString());
    const [paymentMode, setPaymentMode] = useState('UPI');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [ledgerData, setLedgerData] = useState(null);
    const [isLoadingLedger, setIsLoadingLedger] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setMode(initialMode);
        setAmount('');
        setPaymentDate(getTodayLocalDateString());
        setPaymentMode('UPI');
        setReference('');
        setNotes('');

        if (partyId) {
            setIsLoadingLedger(true);
            const url = partyType === 'SUPPLIER'
                ? `/purchase-orders/supplier-ledger/${partyId}`
                : `/invoices/customer-ledger/${partyId}`;
            axiosInstance.get(url)
                .then((res) => {
                    if (res.data?.success) setLedgerData(res.data.data);
                })
                .catch(() => {})
                .finally(() => setIsLoadingLedger(false));
        }
    }, [isOpen, partyId, partyType, initialMode]);

    if (!isOpen || !partyId) return null;

    const handleSubmitAdvance = async (e) => {
        e.preventDefault();
        const numAmt = Number(amount);
        if (isNaN(numAmt) || numAmt <= 0) {
            toast.error('Please enter a valid advance amount > 0');
            return;
        }
        try {
            setIsSubmitting(true);
            const url = partyType === 'SUPPLIER'
                ? '/purchase-orders/supplier-advance'
                : '/invoices/customer-advance';
            const payload = partyType === 'SUPPLIER'
                ? { supplierId: partyId, amount: numAmt, paymentDate, paymentMode, reference, notes }
                : { customerId: partyId, amount: numAmt, paymentDate, paymentMode, reference, notes };

            const res = await axiosInstance.post(url, payload);
            if (res.data?.success) {
                toast.success(res.data.message || 'Advance recorded successfully!');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to record advance');
        } finally {
            setIsSubmitting(false);
        }
    };

    const advanceBalance = Number(ledgerData?.advanceBalance || 0);
    const ledgerEntries = ledgerData?.ledger || [];

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center pb-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Wallet className="text-emerald-600" size={18} />
                        <div>
                            <h3 className="font-bold text-sm text-text-main">
                                {partyType === 'SUPPLIER' ? 'Supplier Advance & Ledger' : 'Customer Advance & Ledger'}
                            </h3>
                            <p className="text-[11px] text-text-muted">
                                {partyName || 'Party'} • Available Advance: <strong className="font-mono text-emerald-700">₹{advanceBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="text-text-muted hover:text-text-main cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex gap-2 border-b border-border pb-2">
                    <button
                        type="button"
                        onClick={() => setMode('RECORD')}
                        className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${mode === 'RECORD' ? 'bg-primary text-sidebar-bg' : 'bg-app-bg text-text-muted'}`}
                    >
                        Record Advance
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('LEDGER')}
                        className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${mode === 'LEDGER' ? 'bg-primary text-sidebar-bg' : 'bg-app-bg text-text-muted'}`}
                    >
                        Advance &amp; Adjustment History ({ledgerEntries.length})
                    </button>
                </div>

                {mode === 'RECORD' ? (
                    <form onSubmit={handleSubmitAdvance} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Advance Amount (₹) *</label>
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="any"
                                    placeholder="e.g. 10000"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-semibold text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Payment Mode</label>
                                <select
                                    value={paymentMode}
                                    onChange={(e) => setPaymentMode(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                >
                                    <option value="UPI">UPI / NetBanking</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Reference / UTR</label>
                                <input
                                    type="text"
                                    placeholder="Optional reference"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-text-main mb-1">Notes</label>
                            <input
                                type="text"
                                placeholder="e.g. Advance against upcoming orders"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-bold text-text-muted cursor-pointer">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                                <CheckCircle2 size={14} />
                                <span>{isSubmitting ? 'Saving...' : 'Save Advance'}</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-2">
                        {isLoadingLedger ? (
                            <p className="text-center text-text-muted py-6">Loading ledger...</p>
                        ) : ledgerEntries.length === 0 ? (
                            <p className="text-center text-text-muted py-6">No advance or adjustment entries yet.</p>
                        ) : (
                            <div className="border border-border rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-app-bg border-b border-border text-[10px] uppercase text-text-muted font-bold">
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Reference / Doc</th>
                                            <th className="p-2 text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {ledgerEntries.map((entry) => (
                                            <tr key={entry._id}>
                                                <td className="p-2 font-mono text-text-muted">{formatDate(entry.date || entry.createdAt)}</td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.entryType === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {entry.entryType === 'CREDIT' ? 'Advance Credit' : 'Applied'}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-text-main">
                                                    <div className="font-mono text-[11px]">{entry.reference || entry.paymentId || '-'}</div>
                                                    {entry.documentNumber && <div className="text-[10px] text-text-muted">Doc: {entry.documentNumber}</div>}
                                                </td>
                                                <td className={`p-2 text-right font-mono font-bold ${entry.entryType === 'CREDIT' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                    {entry.entryType === 'CREDIT' ? '+' : '-'}₹{Number(entry.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
