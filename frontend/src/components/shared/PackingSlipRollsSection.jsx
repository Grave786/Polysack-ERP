import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Layers, AlertCircle, Search, ChevronDown, X, Loader2 } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

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
    fabricAverage: '',
    qtyKgs: '',
    totalQuantityKg: '',
    qtyPcs: '',
    totalQuantityPcs: ''
});

/**
 * Searchable Combobox for Available Inventory Rolls.
 * Queries /work-orders/available-rolls with debounce or filters provided availableRolls.
 */
function SearchableRollPicker({
    roll,
    idx,
    required,
    onSelectRoll,
    onClearRoll,
    availableRolls = []
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inputValue, setInputValue] = useState(roll.rollNumber || roll.rollNo || '');
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Sync input value with current roll
    useEffect(() => {
        setInputValue(roll.rollNumber || roll.rollNo || '');
    }, [roll.rollNumber, roll.rollNo]);

    // Handle outside clicks to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setInputValue(roll.rollNumber || roll.rollNo || '');
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [roll.rollNumber, roll.rollNo]);

    // Query available rolls with debounce or in-memory if availableRolls is provided
    useEffect(() => {
        if (!isOpen) return;

        if (availableRolls && availableRolls.length > 0) {
            const q = searchQuery.trim().toLowerCase();
            if (!q) {
                setOptions(availableRolls.slice(0, 20));
            } else {
                const terms = q.split(/\s+/).filter(Boolean);
                const filtered = availableRolls.filter((r) => {
                    const combined = `${r.rollNo || r.rollNumber || ''} ${r.materialName || ''} ${r.color || ''} ${r.materialQualityFabric || ''} ${r.laminationType || ''} ${r.fabricGrammage || ''} ${r.fabricAverage != null ? `${r.fabricAverage} gsm ${r.fabricAverage}` : ''} ${r.width != null ? `${r.width} inch ${r.width}" ${r.width}` : ''} ${r.grossWeight != null ? `${r.grossWeight} kg ${r.grossWeight}` : ''} ${r.grnNumber || ''}`.toLowerCase();
                    return terms.every((t) => combined.includes(t));
                });
                setOptions(filtered.slice(0, 20));
            }
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const params = { limit: 20 };
                if (searchQuery.trim()) {
                    params.search = searchQuery.trim();
                }
                const res = await axiosInstance.get('/work-orders/available-rolls', { params });
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    setOptions(res.data.data);
                } else {
                    setOptions([]);
                }
            } catch (err) {
                console.error('Failed to fetch available rolls:', err);
                setOptions([]);
            } finally {
                setIsLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [isOpen, searchQuery, availableRolls]);

    const handleFocus = (e) => {
        setIsOpen(true);
        e.target.select();
        setSearchQuery('');
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setSearchQuery(val);
        if (!isOpen) setIsOpen(true);
    };

    const handleSelectOption = (item) => {
        const rNo = item.rollNo || item.rollNumber || '';
        setInputValue(rNo);
        setSearchQuery('');
        setIsOpen(false);
        onSelectRoll(idx, item);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        setInputValue('');
        setSearchQuery('');
        onClearRoll(idx);
        inputRef.current?.focus();
    };

    const hasSelection = Boolean(roll.rollId || roll.rollNumber || roll.rollNo);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative flex items-center">
                <Search size={13} className="absolute left-2 text-text-muted pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    required={required && !hasSelection}
                    placeholder="Search roll #, spec, color..."
                    value={inputValue}
                    onFocus={handleFocus}
                    onChange={handleChange}
                    className="w-full pl-7 pr-12 py-1.5 bg-card-bg border border-border rounded text-xs font-mono font-bold text-text-main placeholder:font-sans placeholder:font-normal placeholder:text-text-muted focus:outline-none focus:border-primary truncate"
                />
                <div className="absolute right-1.5 flex items-center gap-0.5">
                    {isLoading && (
                        <Loader2 size={12} className="animate-spin text-primary" />
                    )}
                    {hasSelection && !isLoading && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10 transition-colors cursor-pointer"
                            title="Clear roll selection"
                        >
                            <X size={12} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (!isOpen) {
                                setIsOpen(true);
                                inputRef.current?.focus();
                            } else {
                                setIsOpen(false);
                            }
                        }}
                        className="p-1 text-text-muted hover:text-text-main rounded transition-colors cursor-pointer"
                    >
                        <ChevronDown size={13} className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Dropdown Options List */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 sm:w-84 max-w-[90vw] bg-card-bg border border-border rounded-lg shadow-2xl z-50 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1.5 border-b border-border bg-app-bg/60 flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        <span>Available Inventory Rolls</span>
                        <span>{isLoading ? 'Searching...' : `${options.length} rolls`}</span>
                    </div>

                    <ul className="max-h-56 overflow-y-auto divide-y divide-border/50 text-xs">
                        {isLoading && options.length === 0 ? (
                            <li className="p-4 text-center text-text-muted text-[11px] flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin text-primary" />
                                <span>Searching available rolls...</span>
                            </li>
                        ) : options.length === 0 ? (
                            <li className="p-4 text-center text-text-muted text-[11px]">
                                {searchQuery ? `No available rolls match "${searchQuery}"` : 'No available rolls found with stock > 0'}
                            </li>
                        ) : (
                            options.map((item) => {
                                const isCurrent = String(roll.rollId || roll._id) === String(item._id);
                                const specParts = [
                                    item.materialName,
                                    item.color,
                                    item.materialQualityFabric,
                                    item.width != null ? `${item.width}"` : '',
                                    item.fabricAverage != null ? `${item.fabricAverage} GSM` : (item.fabricGrammage ? `${item.fabricGrammage} GSM` : ''),
                                    item.laminationType
                                ].filter(Boolean);

                                return (
                                    <li
                                        key={item._id}
                                        onClick={() => handleSelectOption(item)}
                                        className={`p-2 hover:bg-primary/10 transition-colors cursor-pointer flex flex-col gap-0.5 ${
                                            isCurrent ? 'bg-primary/15 border-l-2 border-primary' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-mono font-bold text-text-main text-xs truncate">
                                                    {item.rollNo || item.rollNumber}
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-[9px] bg-primary text-sidebar-bg font-extrabold px-1.5 py-0.2 rounded shrink-0">
                                                        SELECTED
                                                    </span>
                                                )}
                                            </div>
                                            <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                Avail: {Number(item.remainingMeters).toLocaleString('en-IN')}m
                                            </span>
                                        </div>

                                        <div className="text-[10px] text-text-muted truncate">
                                            {specParts.length > 0 ? specParts.join(' • ') : 'Standard Fabric Roll'}
                                        </div>

                                        {(item.grossWeight != null || item.usedMeters > 0 || item.grnNumber) && (
                                            <div className="text-[9px] text-text-muted/75 flex items-center gap-2 flex-wrap">
                                                {item.grossWeight != null && <span>GW: {item.grossWeight} kg</span>}
                                                {item.width != null && <span>W: {item.width}"</span>}
                                                {item.usedMeters > 0 && <span>Used: {item.usedMeters}m</span>}
                                                {item.grnNumber && <span>GRN: {item.grnNumber}</span>}
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

/**
 * Reusable Packing Slip & Roll Specifications Component.
 * Supports multiple rolls per GRN / Work Order with inline validation hints and live tally.
 */
export default function PackingSlipRollsSection({
    rolls = [],
    onChange,
    availableRolls = [],
    allowRollSelection = false,
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

    const handleSelectAvailableRoll = (idx, selectedRoll) => {
        const updated = rolls.map((roll, i) => {
            if (i !== idx) return roll;
            return {
                ...roll,
                _id: selectedRoll._id,
                rollId: selectedRoll._id,
                rollNo: selectedRoll.rollNo,
                rollNumber: selectedRoll.rollNo,
                materialName: selectedRoll.materialName || '',
                remainingMeters: selectedRoll.remainingMeters,
                usedMeters: selectedRoll.usedMeters,
                fabricLength: selectedRoll.remainingMeters,
                length: selectedRoll.remainingMeters,
                width: selectedRoll.width != null ? selectedRoll.width : roll.width,
                grossWeight: selectedRoll.grossWeight != null ? selectedRoll.grossWeight : roll.grossWeight,
                netWeight: selectedRoll.netWeight != null ? selectedRoll.netWeight : roll.netWeight,
                fabricAverage: selectedRoll.fabricAverage != null ? selectedRoll.fabricAverage : roll.fabricAverage,
                totalQuantityKg: selectedRoll.totalQuantityKg != null ? selectedRoll.totalQuantityKg : roll.totalQuantityKg,
                totalQuantityPcs: selectedRoll.totalQuantityPcs != null ? selectedRoll.totalQuantityPcs : roll.totalQuantityPcs
            };
        });
        onChange(updated);
    };

    const handleClearRoll = (idx) => {
        const updated = rolls.map((roll, i) => {
            if (i !== idx) return roll;
            return {
                ...roll,
                _id: undefined,
                rollId: '',
                rollNo: '',
                rollNumber: '',
                materialName: '',
                remainingMeters: '',
                usedMeters: '',
                fabricLength: '',
                length: ''
            };
        });
        onChange(updated);
    };

    const canSelectFromInventory = Boolean(
        allowRollSelection ||
        (availableRolls && availableRolls.length > 0) ||
        title?.toLowerCase().includes('job order') ||
        title?.toLowerCase().includes('work order')
    );

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
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main">
                                                Roll No. <span className="text-danger">*</span>
                                            </label>
                                            {canSelectFromInventory && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const toggled = !roll.isManualEntry;
                                                        handleRollChange(idx, 'isManualEntry', toggled);
                                                    }}
                                                    className="text-[9px] text-primary hover:underline font-semibold cursor-pointer"
                                                >
                                                    {roll.isManualEntry ? 'Select Roll' : 'Manual'}
                                                </button>
                                            )}
                                        </div>

                                        {canSelectFromInventory && !roll.isManualEntry ? (
                                            <SearchableRollPicker
                                                roll={roll}
                                                idx={idx}
                                                required={required}
                                                onSelectRoll={handleSelectAvailableRoll}
                                                onClearRoll={handleClearRoll}
                                                availableRolls={availableRolls}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                required={required}
                                                maxLength={50}
                                                placeholder="e.g. 1388/27"
                                                value={roll.rollNumber || roll.rollNo || ''}
                                                onChange={(e) => handleRollChange(idx, 'rollNo', e.target.value)}
                                                className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono font-bold text-text-main focus:outline-none focus:border-primary uppercase"
                                            />
                                        )}
                                        {roll.materialName && (
                                            <p className="text-[9.5px] text-primary font-medium truncate mt-0.5">
                                                {roll.materialName} {roll.remainingMeters != null && `• Stock: ${roll.remainingMeters}m`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Fabric Length (Meters) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-main mb-0.5">
                                            Length (M)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0.001"
                                            max="50000"
                                            placeholder="0.001–50,000"
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
                                            step="0.001"
                                            min="0.001"
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
                                            step="0.001"
                                            min="0.001"
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
                                            step="0.001"
                                            min="0.001"
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
                                            step="0.001"
                                            min="0"
                                            placeholder="Roll Wt"
                                            value={(roll.totalQuantityKg !== undefined && roll.totalQuantityKg !== null && roll.totalQuantityKg !== '') ? roll.totalQuantityKg : (roll.qtyKgs ?? '')}
                                            onChange={(e) => handleRollChange(idx, 'qtyKgs', e.target.value)}
                                            className="w-full border border-border rounded p-1.5 bg-card-bg text-xs font-mono text-text-main focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Total Quantity in Pcs */}
                                    <div className="col-span-1 sm:col-span-1">
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

                                    {/* Fabric Average */}
                                    <div className="col-span-1 sm:col-span-1">
                                        <label className="block text-[10px] font-bold text-text-muted mb-1 uppercase tracking-wider">
                                            Fabric Average
                                        </label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            placeholder="e.g. 120.5"
                                            value={roll.fabricAverage || ''}
                                            onChange={(e) => handleRollChange(idx, 'fabricAverage', e.target.value)}
                                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary"
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
