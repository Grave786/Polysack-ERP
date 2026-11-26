import { AlertCircle } from 'lucide-react';

export default function ChargesAndAdjustmentsSection({
    charges,
    onChange,
    totals,
    disabled = false
}) {
    const updateField = (field, val) => {
        onChange({ ...charges, [field]: val });
    };

    return (
        <div className="bg-card-bg border border-border rounded-xl p-3.5 space-y-3 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="font-bold uppercase tracking-wider text-text-main text-[11px]">
                    Charges &amp; Adjustments
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-semibold text-text-muted">
                    <input
                        type="checkbox"
                        disabled={disabled}
                        checked={charges.autoRoundOff !== false}
                        onChange={(e) => updateField('autoRoundOff', e.target.checked)}
                        className="accent-primary cursor-pointer"
                    />
                    <span>Auto round-off</span>
                </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Discount (% or Fixed toggle) */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-text-muted">
                            Discount
                        </label>
                        <div className="inline-flex rounded border border-border overflow-hidden text-[10px] font-bold">
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => updateField('discountType', 'FIXED')}
                                className={`px-2 py-0.5 cursor-pointer ${
                                    charges.discountType !== 'PERCENT'
                                        ? 'bg-primary text-sidebar-bg'
                                        : 'bg-app-bg text-text-muted'
                                }`}
                            >
                                ₹ Fixed
                            </button>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => updateField('discountType', 'PERCENT')}
                                className={`px-2 py-0.5 cursor-pointer ${
                                    charges.discountType === 'PERCENT'
                                        ? 'bg-primary text-sidebar-bg'
                                        : 'bg-app-bg text-text-muted'
                                }`}
                            >
                                % Pct
                            </button>
                        </div>
                    </div>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        placeholder={charges.discountType === 'PERCENT' ? 'e.g. 5' : '0'}
                        value={charges.discountValue}
                        onChange={(e) => updateField('discountValue', e.target.value)}
                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                </div>

                {/* Freight / Transport Charges */}
                <div>
                    <label className="block text-[10px] font-bold uppercase text-text-muted mb-1">
                        Freight / Transport Charges (₹)
                    </label>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        placeholder="0"
                        value={charges.freightAmount}
                        onChange={(e) => updateField('freightAmount', e.target.value)}
                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                </div>

                {/* Insurance Charges */}
                <div>
                    <label className="block text-[10px] font-bold uppercase text-text-muted mb-1">
                        Insurance Charges (₹)
                    </label>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        placeholder="0"
                        value={charges.insuranceAmount}
                        onChange={(e) => updateField('insuranceAmount', e.target.value)}
                        className="w-full border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                </div>

                {/* Other Charges + Label */}
                <div>
                    <label className="block text-[10px] font-bold uppercase text-text-muted mb-1">
                        Other Charges (₹ &amp; Label)
                    </label>
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            disabled={disabled}
                            placeholder="e.g. Packing / Loading"
                            value={charges.otherChargesLabel}
                            onChange={(e) => updateField('otherChargesLabel', e.target.value)}
                            className="w-1/2 border border-border rounded-lg p-2 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                        />
                        <input
                            type="number"
                            step="any"
                            min="0"
                            disabled={disabled}
                            placeholder="0"
                            value={charges.otherChargesAmount}
                            onChange={(e) => updateField('otherChargesAmount', e.target.value)}
                            className="w-1/2 border border-border rounded-lg p-2 bg-app-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                        />
                    </div>
                </div>
            </div>

            {totals?.validationError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{totals.validationError}</span>
                </div>
            )}
        </div>
    );
}
