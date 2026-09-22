import { Pencil, Trash2 } from 'lucide-react';

/**
 * Reusable dropdown component with inline master management (+ Add New, Edit, Delete).
 * Features uniform min-height header & mt-auto baseline alignment to prevent "upar-niche"
 * vertical misalignment across 2-column grid rows, with non-obstructing top-anchored tooltips.
 */
export default function InlineLookupSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder,
    onOpenAdd,
    onOpenEdit,
    onDelete,
    required = false,
    disabled = false
}) {
    // Check if current value matches an existing master option
    const matchedOption = options.find((opt) => opt.name === value);

    const handleSelectChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header: Label with uniform min-height & inline action buttons */}
            <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                    {label} {required && <span className="text-danger">*</span>}
                </label>
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap pt-0.5">
                    {onOpenAdd && (
                        <div className="relative group inline-flex items-center">
                            <button
                                type="button"
                                onClick={onOpenAdd}
                                className="text-xs text-primary hover:underline font-bold cursor-pointer shrink-0 transition-colors"
                                aria-label={`Add new ${label}`}
                            >
                                + Add New
                            </button>
                            {/* Non-obstructing tooltip forced strictly ABOVE trigger button without overlapping neighboring inputs */}
                            <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end z-[90] animate-in fade-in zoom-in-95 duration-100">
                                <span className="w-max max-w-[200px] whitespace-normal text-center leading-tight break-words rounded bg-slate-900/95 backdrop-blur-xs text-white text-[10px] font-medium px-2.5 py-1 shadow-xl border border-slate-700/50">
                                    Add new {label}
                                </span>
                                <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900/95 mr-2 -mt-[1px]" />
                            </div>
                        </div>
                    )}
                    {matchedOption && (
                        <>
                            {onOpenEdit && (
                                <div className="relative group inline-flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => onOpenEdit(matchedOption)}
                                        className="text-xs text-text-muted hover:text-primary flex items-center gap-1 font-medium cursor-pointer shrink-0 transition-colors"
                                        aria-label={`Edit '${matchedOption.name}'`}
                                    >
                                        <Pencil size={12} />
                                        <span>Edit</span>
                                    </button>
                                    <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end z-[90] animate-in fade-in zoom-in-95 duration-100">
                                        <span className="w-max max-w-[180px] whitespace-normal text-center leading-tight break-words rounded bg-slate-900/95 backdrop-blur-xs text-white text-[10px] font-medium px-2.5 py-1 shadow-xl border border-slate-700/50">
                                            Edit '{matchedOption.name}'
                                        </span>
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900/95 mr-2 -mt-[1px]" />
                                    </div>
                                </div>
                            )}
                            {onDelete && (
                                <div className="relative group inline-flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => onDelete(matchedOption)}
                                        className="text-xs text-danger hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0 transition-colors"
                                        aria-label={`Delete '${matchedOption.name}'`}
                                    >
                                        <Trash2 size={12} />
                                        <span>Delete</span>
                                    </button>
                                    <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:flex flex-col items-end z-[90] animate-in fade-in zoom-in-95 duration-100">
                                        <span className="w-max max-w-[180px] whitespace-normal text-center leading-tight break-words rounded bg-slate-900/95 backdrop-blur-xs text-white text-[10px] font-medium px-2.5 py-1 shadow-xl border border-slate-700/50">
                                            Delete '{matchedOption.name}'
                                        </span>
                                        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900/95 mr-2 -mt-[1px]" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Dropdown Input: Pushed to bottom with mt-auto for perfect horizontal baseline alignment */}
            <div className="mt-auto w-full">
                <select
                    value={value || ''}
                    onChange={handleSelectChange}
                    disabled={disabled}
                    required={required}
                    className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer transition-colors"
                >
                    <option value="">{placeholder || `-- Select ${label} --`}</option>
                    {options.map((opt) => (
                        <option key={opt._id || opt.name} value={opt.name}>
                            {opt.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
