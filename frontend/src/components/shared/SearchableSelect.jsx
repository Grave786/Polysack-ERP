import { useState, useEffect, useLayoutEffect, useRef, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Loader2, Plus } from 'lucide-react';

/**
 * Highlight matched query text inside a string safely without dangerouslySetInnerHTML.
 */
function HighlightText({ text, query }) {
    if (!text) return null;
    const str = String(text);
    const q = (query || '').trim();
    if (!q) return str;

    const lowerStr = str.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerStr.indexOf(lowerQ);
    if (idx === -1) return str;

    const before = str.slice(0, idx);
    const match = str.slice(idx, idx + q.length);
    const after = str.slice(idx + q.length);

    return (
        <>
            {before}
            <mark className="bg-amber-200/80 text-slate-950 rounded px-0.5 font-semibold">{match}</mark>
            {after}
        </>
    );
}

const BADGE_TONES = {
    amber: 'bg-amber-100 text-amber-900 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
};

/**
 * SearchableSelect — Reusable, accessible combobox replacing native <select>.
 * Renders its dropdown in a portal with auto-flip positioning on desktop and a
 * bottom-sheet drawer on mobile screens.
 */
export default function SearchableSelect({
    value = '',
    onChange,
    options = [],
    groups = null,
    placeholder = 'Select an option...',
    searchPlaceholder = 'Type to search...',
    disabled = false,
    required = false,
    name,
    id,
    error = false,
    clearable,
    loading = false,
    emptyMessage = 'No options available',
    noResultsMessage = 'No results found',
    footerAction = null,
    footerText = '',
    className = '',
    triggerClassName = '',
    maxRendered = 100
}) {
    const generatedId = useId();
    const controlId = id || `searchable-select-${generatedId}`;
    const listboxId = `${controlId}-listbox`;

    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const searchInputRef = useRef(null);
    const listContainerRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
    const [panelStyle, setPanelStyle] = useState(null);

    const canClear = clearable !== undefined ? clearable : !required;

    // Flatten groups if `groups` prop is provided
    const normalizedOptions = useMemo(() => {
        if (Array.isArray(groups) && groups.length > 0) {
            const flat = [];
            for (const grp of groups) {
                const grpLabel = grp.label || grp.title || '';
                for (const opt of grp.options || []) {
                    flat.push({ ...opt, group: opt.group || grpLabel });
                }
            }
            return flat;
        }
        return Array.isArray(options) ? options : [];
    }, [options, groups]);

    const selectedOption = useMemo(
        () => normalizedOptions.find((opt) => String(opt.value) === String(value ?? '')) || null,
        [normalizedOptions, value]
    );

    // Filter options by search query
    const filteredOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return normalizedOptions;

        return normalizedOptions.filter((opt) => {
            const haystack = [
                opt.label,
                opt.subLabel,
                opt.code,
                opt.badge,
                opt.group,
                opt.searchText
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [normalizedOptions, searchQuery]);

    // Performance cap for large lists (> 200 items)
    const isTruncated = normalizedOptions.length > 200 && filteredOptions.length > maxRendered;
    const visibleOptions = useMemo(
        () => (isTruncated ? filteredOptions.slice(0, maxRendered) : filteredOptions),
        [filteredOptions, isTruncated, maxRendered]
    );

    // Group visible options while preserving order
    const groupedSections = useMemo(() => {
        const hasGroups = visibleOptions.some((o) => Boolean(o.group));
        if (!hasGroups) {
            return [{ group: '', items: visibleOptions.map((item, idx) => ({ item, flatIndex: idx })) }];
        }
        const map = new Map();
        visibleOptions.forEach((item, idx) => {
            const g = item.group || 'Other';
            if (!map.has(g)) map.set(g, []);
            map.get(g).push({ item, flatIndex: idx });
        });
        return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
    }, [visibleOptions]);

    // Track viewport size for mobile bottom-sheet vs desktop popover
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Compute desktop portal position with auto-flip
    const updatePosition = () => {
        if (!triggerRef.current || isMobile) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;

        const spaceBelow = viewportH - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const flipUp = spaceBelow < 260 && spaceAbove > spaceBelow;

        const minWidth = Math.min(viewportW - 24, Math.max(rect.width, 320));
        const maxWidth = Math.min(viewportW - 24, Math.max(rect.width, 520));
        let left = rect.left;
        if (left + minWidth > viewportW - 12) {
            left = Math.max(12, viewportW - minWidth - 12);
        }

        const availableH = flipUp ? Math.min(360, spaceAbove) : Math.min(360, spaceBelow);

        setPanelStyle({
            position: 'fixed',
            left: `${left}px`,
            width: `${minWidth}px`,
            maxWidth: `${maxWidth}px`,
            maxHeight: `${Math.max(200, availableH)}px`,
            zIndex: 9999,
            visibility: 'visible',
            ...(flipUp
                ? { bottom: `${viewportH - rect.top + 6}px` }
                : { top: `${rect.bottom + 6}px` })
        });
    };

    // Position synchronously before paint to prevent (0,0) flicker
    useLayoutEffect(() => {
        if (!isOpen) {
            setPanelStyle(null);
            return;
        }
        updatePosition();
    }, [isOpen, isMobile]);

    useEffect(() => {
        if (!isOpen) return;

        // Autofocus search input without scrolling parent drawer/page
        const raf = requestAnimationFrame(() => {
            searchInputRef.current?.focus({ preventScroll: true });
        });

        // Set initial activeIndex to selected item or first enabled item
        const selIdx = visibleOptions.findIndex((o) => String(o.value) === String(value ?? '') && !o.disabled);
        setActiveIndex(selIdx >= 0 ? selIdx : visibleOptions.findIndex((o) => !o.disabled));

        const handleOutsidePointerDown = (e) => {
            if (
                triggerRef.current?.contains(e.target) ||
                panelRef.current?.contains(e.target)
            ) {
                return;
            }
            setIsOpen(false);
        };

        const handleRepositionOnScroll = (e) => {
            // Scrolling inside the dropdown list does not move the trigger
            if (panelRef.current && panelRef.current.contains(e.target)) {
                return;
            }
            if (!isMobile) {
                updatePosition();
            }
        };

        document.addEventListener('pointerdown', handleOutsidePointerDown);
        window.addEventListener('scroll', handleRepositionOnScroll, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('pointerdown', handleOutsidePointerDown);
            window.removeEventListener('scroll', handleRepositionOnScroll, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, isMobile]);

    // Reset search when closed
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setActiveIndex(-1);
        }
    }, [isOpen]);

    // Keep keyboard-active option scrolled into view inside the list container only (never scroll parent page/drawer)
    useEffect(() => {
        if (!isOpen || activeIndex < 0 || !listContainerRef.current) return;
        const container = listContainerRef.current;
        const activeEl = container.querySelector(`[data-option-index="${activeIndex}"]`);
        if (!activeEl) return;

        const elTop = activeEl.offsetTop;
        const elBottom = elTop + activeEl.offsetHeight;
        if (elTop < container.scrollTop) {
            container.scrollTop = elTop;
        } else if (elBottom > container.scrollTop + container.clientHeight) {
            container.scrollTop = elBottom - container.clientHeight;
        }
    }, [activeIndex, isOpen]);

    const handleSelectOption = (opt) => {
        if (!opt || opt.disabled) return;
        if (onChange) onChange(opt.value);
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (disabled || !canClear) return;
        if (onChange) onChange('');
        triggerRef.current?.focus();
    };

    const moveActiveIndex = (direction) => {
        if (visibleOptions.length === 0) return;
        let next = activeIndex;
        for (let i = 0; i < visibleOptions.length; i++) {
            next = (next + direction + visibleOptions.length) % visibleOptions.length;
            if (!visibleOptions[next].disabled) {
                setActiveIndex(next);
                return;
            }
        }
    };

    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setIsOpen(true);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            setIsOpen(true);
            setSearchQuery(e.key);
        }
    };

    const handlePanelKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus();
        } else if (e.key === 'Tab') {
            setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveActiveIndex(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveActiveIndex(-1);
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && visibleOptions[activeIndex] && !visibleOptions[activeIndex].disabled) {
                e.preventDefault();
                handleSelectOption(visibleOptions[activeIndex]);
            }
        }
    };

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : '';

    const panelContent = (
        <div
            ref={panelRef}
            onKeyDown={handlePanelKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={isMobile ? undefined : (panelStyle || { position: 'fixed', visibility: 'hidden', zIndex: 9999 })}
            className={
                isMobile
                    ? 'fixed inset-x-0 bottom-0 z-[9999] bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl flex flex-col max-h-[82vh] animate-in slide-in-from-bottom-4 duration-150 motion-reduce:animate-none'
                    : 'bg-white border border-slate-200 rounded-xl shadow-[0_14px_38px_-8px_rgba(15,23,42,0.22),0_4px_12px_-4px_rgba(15,23,42,0.08)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none'
            }
        >
            {/* Mobile Sheet Handle & Header */}
            {isMobile && (
                <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-slate-100 shrink-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {placeholder}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label="Close dropdown"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Sticky Search Bar */}
            <div className="p-2.5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
                <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        placeholder={searchPlaceholder}
                        aria-label="Search options"
                        className="w-full pl-8 pr-8 py-2 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-lg text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                searchInputRef.current?.focus();
                            }}
                            className="absolute right-2 p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            aria-label="Clear search"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
                {searchQuery.trim() !== '' && (
                    <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
                        <span>
                            {filteredOptions.length === 0
                                ? 'No matching options'
                                : `${filteredOptions.length} ${filteredOptions.length === 1 ? 'result' : 'results'} found`}
                        </span>
                        {isTruncated && (
                            <span className="text-amber-700 font-semibold">
                                Showing first {maxRendered} — type to narrow
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Scrollable Options List */}
            <div
                ref={listContainerRef}
                id={listboxId}
                role="listbox"
                className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-50"
            >
                {loading ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <Loader2 size={15} className="animate-spin text-amber-500" />
                        <span>Loading options...</span>
                    </div>
                ) : visibleOptions.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-1">
                        <p className="text-xs font-semibold text-slate-600">
                            {searchQuery.trim() ? noResultsMessage : emptyMessage}
                        </p>
                        {searchQuery.trim() && (
                            <p className="text-[11px] text-slate-400">
                                Try a different keyword or clear the search filter.
                            </p>
                        )}
                    </div>
                ) : (
                    groupedSections.map((section) => (
                        <div key={section.group || '__default'}>
                            {section.group && (
                                <div className="sticky top-0 z-[5] px-3 py-1.5 bg-slate-100/95 backdrop-blur-xs border-y border-slate-200/70 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                    {section.group}
                                </div>
                            )}
                            {section.items.map(({ item: opt, flatIndex }) => {
                                const isSelected = String(opt.value) === String(value ?? '');
                                const isActive = flatIndex === activeIndex;
                                const badgeClass = BADGE_TONES[opt.badgeTone] || BADGE_TONES.slate;

                                return (
                                    <div
                                        key={`${opt.value}_${flatIndex}`}
                                        id={`${controlId}-opt-${flatIndex}`}
                                        data-option-index={flatIndex}
                                        role="option"
                                        aria-selected={isSelected}
                                        aria-disabled={Boolean(opt.disabled)}
                                        onMouseEnter={() => !opt.disabled && setActiveIndex(flatIndex)}
                                        onClick={() => handleSelectOption(opt)}
                                        className={`px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 flex items-start justify-between gap-2.5 transition-colors border-l-2 ${
                                            opt.disabled
                                                ? 'opacity-50 cursor-not-allowed bg-slate-50 border-l-transparent'
                                                : isSelected
                                                ? 'bg-amber-50/70 border-l-amber-500 cursor-pointer'
                                                : isActive
                                                ? 'bg-amber-50/50 border-l-transparent cursor-pointer'
                                                : 'hover:bg-amber-50/40 border-l-transparent cursor-pointer'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 whitespace-normal">
                                                {opt.code && (
                                                    <span className="font-mono font-bold text-slate-700 mr-1.5">
                                                        <HighlightText text={opt.code} query={searchQuery} />
                                                    </span>
                                                )}
                                                <HighlightText text={opt.label} query={searchQuery} />
                                            </div>
                                            {opt.subLabel && (
                                                <div className="text-[11px] text-slate-500 leading-tight break-words">
                                                    <HighlightText text={opt.subLabel} query={searchQuery} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                            {opt.badge && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${badgeClass}`}>
                                                    {opt.badge}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <Check size={14} className="text-amber-600 shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}

                {isTruncated && !searchQuery.trim() && (
                    <div className="px-3 py-2 bg-amber-50/60 text-center text-[11px] font-semibold text-amber-800 border-t border-amber-200/70">
                        Showing first {maxRendered} of {normalizedOptions.length} options. Type to narrow results.
                    </div>
                )}
            </div>

            {/* Optional Footer (Count / Pinned Action like "+ New Customer") */}
            {(footerText || footerAction) && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    {footerText ? (
                        <span className="text-[10.5px] font-medium text-slate-500">{footerText}</span>
                    ) : (
                        <span />
                    )}
                    {footerAction && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                footerAction.onClick?.();
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                        >
                            {footerAction.icon || <Plus size={13} />}
                            <span>{footerAction.label}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className={`relative ${className}`}>
            {/* Hidden input for native HTML5 required form validation */}
            {required && (
                <input
                    type="text"
                    name={name}
                    required
                    value={value ?? ''}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only pointer-events-none absolute bottom-0 left-1/2"
                />
            )}

            <button
                ref={triggerRef}
                id={controlId}
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={isOpen && activeIndex >= 0 ? `${controlId}-opt-${activeIndex}` : undefined}
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setIsOpen((prev) => !prev);
                }}
                onKeyDown={handleTriggerKeyDown}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold rounded-lg border transition-all focus:outline-none ${
                    disabled
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : hasError
                        ? 'bg-white border-red-400 text-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer'
                        : isOpen
                        ? 'bg-card-bg border-amber-500 ring-2 ring-amber-500/25 text-text-main cursor-pointer'
                        : 'bg-card-bg border-border hover:border-slate-400 text-text-main focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 cursor-pointer'
                } ${triggerClassName}`}
            >
                <span className={`truncate flex-1 ${selectedOption ? 'text-text-main' : 'text-text-muted font-normal'}`}>
                    {selectedOption ? (
                        <>
                            {selectedOption.code ? `${selectedOption.code} — ` : ''}
                            {selectedOption.label}
                        </>
                    ) : (
                        placeholder
                    )}
                </span>

                <span className="flex items-center gap-1 shrink-0">
                    {canClear && selectedOption && !disabled && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear selection"
                            onClick={handleClear}
                            className="p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                            <X size={13} />
                        </span>
                    )}
                    <ChevronDown
                        size={15}
                        className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-amber-600' : ''}`}
                    />
                </span>
            </button>

            {errorMessage && (
                <p className="text-[11px] font-semibold text-red-600 mt-1">{errorMessage}</p>
            )}

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    {isMobile && (
                        <div
                            className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-xs"
                            onClick={() => setIsOpen(false)}
                        />
                    )}
                    {panelContent}
                </>,
                document.body
            )}
        </div>
    );
}
