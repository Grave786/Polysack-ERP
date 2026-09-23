import { Plus, Trash2, Layers, AlertCircle } from 'lucide-react';

/**
 * Empty roll template
 */
export const createEmptyRoll = (index = 1) => ({
    rollNo: '',
    rollNumber: '',
    length: '',
    fabricLength: '',
    width: '',
    grossWeight: '',
    netWeight: '',
    qtyKgs: '',
    totalQuantityKg: '',
    qtyPcs: '',
    totalQuantityPcs: ''
});

/**
 * Reusable Packing Slip & Roll Specifications Component.
 * Supports multiple rolls per GRN / Work Order with inline validation hints and live tally.
 */
export default function PackingSlipRollsSection({
    rolls = [],
    onChange,
    title = 'Packing Slip & Roll Specifications',
    subtitle = 'Inward roll specifications from paper packing list',
    required = false
}) {
    const handleAddRoll = () => {
        onChange([...rolls, createEmptyRoll(rolls.length + 1)]);
    };

    const handleRemoveRoll = (indexToRemove) => {
        if (rolls.length <= 1 && required) {
            onChange([createEmptyRoll(1)]);
            return;
        }
        onChange(rolls.filter((_, idx) => idx !== indexToRemove));
    };

    const handleRollChange = (index, field, value) => {
        const updated = rolls.map((roll, idx) => {
            if (idx !== index) return roll;
            const updatedRoll = {
                ...roll,
                [field]: value
            };
            if (field === 'rollNumber' || field === 'rollNo') {
                updatedRoll.rollNumber = value;
                updatedRoll.rollNo = value;
            }
            if (field === 'fabricLength' || field === 'length') {
                updatedRoll.fabricLength = value;
                updatedRoll.length = value;
            }
            if (field === 'totalQuantityKg' || field === 'qtyKgs') {
                updatedRoll.totalQuantityKg = value;
                updatedRoll.qtyKgs = value;
            }
            if (field === 'totalQuantityPcs' || field === 'qtyPcs') {
                updatedRoll.totalQuantityPcs = value;
                updatedRoll.qtyPcs = value;
            }
            return updatedRoll;
        });
        onChange(updated);
    };

    // Live tallies
    const totalRolls = rolls.length;
    const totalGrossWeight = rolls.reduce((acc, r) => acc + (Number(r.grossWeight) || 0), 0);
    const totalNetWeight = rolls.reduce((acc, r) => acc + (Number(r.netWeight) || 0), 0);
    const totalKg = rolls.reduce((acc, r) => acc + (Number(r.totalQuantityKg ?? r.qtyKgs) || 0), 0);
    const totalPcs = rolls.reduce((acc, r) => acc + (Number(r.totalQuantityPcs ?? r.qtyPcs) || 0), 0);

    return (
        <div className="space-y-3 pt-3 border-t border-border font-sans">
            {/* Header with Title and + Add Roll Button */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-primary/10 text-primary">
                        <Layers size={15} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                            <span>{title}</span>
                            {required && <span className="text-danger">*</span>}
                        </h4>
                        {subtitle && <p className="text-[10.5px] text-text-muted">{subtitle}</p>}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleAddRoll}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                    <Plus size={13} />
                    <span>+ Add Roll</span>
                </button>
            </div>

            {/* Empty State */}
            {rolls.length === 0 ? (
                <div className="p-4 border border-dashed border-border rounded-lg text-center bg-app-bg/50">
                    <p className="text-xs text-text-muted">No rolls added yet.</p>
                    <button
                        type="button"
                        onClick={handleAddRoll}
                        className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                        + Add First Roll
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {rolls.map((roll, idx) => {
                        const gwNum = Number(roll.grossWeight);
                        const nwNum = Number(roll.netWeight);
                        const isNwExceeded = !isNaN(gwNum) && !isNaN(nwNum) && gwNum > 0 && nwNum > gwNum;

                        return (
                            <div
                                key={idx}
                                className="bg-app-bg border border-border/80 rounded-lg p-3 space-y-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                            >
                                {/* Row Top: Identifier and Remove button */}
                                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold uppercase bg-primary text-sidebar-bg px-2 py-0.5 rounded">
                                            Roll #{idx + 1}
                                        </span>
                                        {(roll.rollNumber || roll.rollNo) && (
                                            <span className="text-xs font-mono font-bold text-text-main">
                                                {roll.rollNumber || roll.rollNo}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRoll(idx)}
                                        className="text-text-muted hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors cursor-pointer"
                                        title="Remove roll"
                                        aria-label={`Remove roll ${idx + 1}`}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                {/* Inputs Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {/* Roll No. */}
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Roll No. <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required={required}
                                            maxLength={50}
                                            placeholder="e.g. 1388/27"
                                            value={roll.rollNumber || roll.rollNo || ''}
                                            onChange={(e) => handleRollChange(idx, 'rollNo', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary uppercase"
                                        />
                                    </div>

                                    {/* Fabric Length (Meters) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Length (M)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            max="50000"
                                            placeholder="1–50,000"
                                            value={(roll.fabricLength !== undefined && roll.fabricLength !== null && roll.fabricLength !== '') ? roll.fabricLength : (roll.length ?? '')}
                                            onChange={(e) => handleRollChange(idx, 'length', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Width (Inches) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Width (In)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="e.g. 58"
                                            value={roll.width !== undefined && roll.width !== null ? roll.width : ''}
                                            onChange={(e) => handleRollChange(idx, 'width', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Gross Weight (Kg) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            G.W. (Kg)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max="10000"
                                            placeholder="Max 10,000"
                                            value={roll.grossWeight !== undefined && roll.grossWeight !== null ? roll.grossWeight : ''}
                                            onChange={(e) => handleRollChange(idx, 'grossWeight', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Net Weight (Kg) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main">
                                                N.W. (Kg)
                                            </label>
                                            <span className="text-[9px] text-text-muted">≤ G.W.</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max="10000"
                                            placeholder="Net Wt"
                                            value={roll.netWeight !== undefined && roll.netWeight !== null ? roll.netWeight : ''}
                                            onChange={(e) => handleRollChange(idx, 'netWeight', e.target.value)}
                                            className={`w-full border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none ${
                                                isNwExceeded ? 'border-amber-500 focus:border-amber-600 bg-amber-50/20' : 'border-border focus:border-primary'
                                            }`}
                                        />
                                    </div>

                                    {/* Total Quantity in Kgs */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Qty (Kgs)
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            placeholder="Roll Wt"
                                            value={(roll.totalQuantityKg !== undefined && roll.totalQuantityKg !== null && roll.totalQuantityKg !== '') ? roll.totalQuantityKg : (roll.qtyKgs ?? '')}
                                            onChange={(e) => handleRollChange(idx, 'qtyKgs', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Total Quantity in Pcs */}
                                    <div className="col-span-2 sm:col-span-2">
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Qty (Pcs)
                                        </label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            placeholder="Piece count"
                                            value={(roll.totalQuantityPcs !== undefined && roll.totalQuantityPcs !== null && roll.totalQuantityPcs !== '') ? roll.totalQuantityPcs : (roll.qtyPcs ?? '')}
                                            onChange={(e) => handleRollChange(idx, 'qtyPcs', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>

                                {/* Soft validation hint if Net Weight > Gross Weight */}
                                {isNwExceeded && (
                                    <div className="flex items-center gap-1.5 text-[10.5px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded px-2 py-1">
                                        <AlertCircle size={12} className="shrink-0" />
                                        <span>Soft check: Net Weight ({nwNum} Kg) exceeds Gross Weight ({gwNum} Kg). Please verify paper slip.</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tally Summary Bar */}
            {rolls.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-extrabold text-primary uppercase">
                            Total: {totalRolls} Roll{totalRolls > 1 ? 's' : ''}
                        </span>
                        {totalGrossWeight > 0 && (
                            <span className="text-[11px] text-text-muted">
                                G.W.: <strong className="text-text-main">{totalGrossWeight.toFixed(2)} Kg</strong>
                            </span>
                        )}
                        {totalNetWeight > 0 && (
                            <span className="text-[11px] text-text-muted">
                                N.W.: <strong className="text-text-main">{totalNetWeight.toFixed(2)} Kg</strong>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                        {totalKg > 0 && (
                            <span className="text-text-muted">
                                Total Wt: <strong className="text-emerald-700 font-bold">{totalKg.toFixed(2)} Kg</strong>
                            </span>
                        )}
                        {totalPcs > 0 && (
                            <span className="text-text-muted">
                                Total Pcs: <strong className="text-emerald-700 font-bold">{totalPcs.toLocaleString()}</strong>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
