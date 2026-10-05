import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Loader2,
    X,
    Users,
    ShoppingBag,
    Layers,
    Package,
    Truck,
    UserCheck,
    Settings,
    FileText,
    Receipt,
    ScrollText,
    Hash
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const getTypeBadgeStyle = (type) => {
    switch (type) {
        case 'Fabric Roll':
            return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Raw Material':
            return 'bg-teal-100 text-teal-800 border-teal-200';
        case 'Finished Bag':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Customer':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Supplier':
            return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'Employee':
            return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'Machine':
            return 'bg-slate-100 text-slate-800 border-slate-200';
        case 'Work Order':
            return 'bg-violet-100 text-violet-800 border-violet-200';
        case 'Invoice':
            return 'bg-sky-100 text-sky-800 border-sky-200';
        case 'Sales Order':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'GRN / Lot Number':
            return 'bg-rose-100 text-rose-800 border-rose-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getTypeIcon = (type) => {
    switch (type) {
        case 'Fabric Roll':
            return <ScrollText size={13} className="text-amber-600" />;
        case 'Raw Material':
            return <Layers size={13} className="text-teal-600" />;
        case 'Finished Bag':
            return <Package size={13} className="text-emerald-600" />;
        case 'Customer':
            return <Users size={13} className="text-blue-600" />;
        case 'Supplier':
            return <Truck size={13} className="text-purple-600" />;
        case 'Employee':
            return <UserCheck size={13} className="text-indigo-600" />;
        case 'Machine':
            return <Settings size={13} className="text-slate-600" />;
        case 'Work Order':
            return <FileText size={13} className="text-violet-600" />;
        case 'Invoice':
            return <Receipt size={13} className="text-sky-600" />;
        case 'Sales Order':
            return <ShoppingBag size={13} className="text-green-600" />;
        case 'GRN / Lot Number':
            return <Hash size={13} className="text-rose-600" />;
        default:
            return <Search size={13} className="text-text-muted" />;
    }
};

export default function GlobalSearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search logic (350ms) across all transactions, Master Data, and Fabric Rolls
    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 2) {
            setResults([]);
            setIsLoading(false);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await axiosInstance.get('/dashboard/global-search', {
                    params: { q: trimmed }
                });
                const list = res.data?.data || [];
                setResults(list);
                setIsOpen(true);
            } catch (err) {
                console.warn('Global search query failed:', err.message);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [query]);

    // Handle Enter keypress for instant navigation to exact or top match
    const handleKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = query.trim().toLowerCase();
            if (!trimmed) return;

            if (results.length > 0) {
                const exact = results.find((r) => (r.code || '').toLowerCase() === trimmed);
                const target = exact || results[0];
                if (target?.url) {
                    setQuery('');
                    setResults([]);
                    setIsOpen(false);
                    navigate(target.url);
                    return;
                }
            }

            // If not yet loaded or debounced, fetch immediately on Enter
            try {
                setIsLoading(true);
                const res = await axiosInstance.get('/dashboard/global-search', {
                    params: { q: query.trim() }
                });
                const list = res.data?.data || [];
                setResults(list);
                if (list.length > 0) {
                    const exact = list.find((r) => (r.code || '').toLowerCase() === trimmed);
                    const target = exact || list[0];
                    if (target?.url) {
                        setQuery('');
                        setResults([]);
                        setIsOpen(false);
                        navigate(target.url);
                    }
                } else {
                    setIsOpen(true);
                }
            } catch (err) {
                console.warn('Enter search execution failed:', err.message);
            } finally {
                setIsLoading(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const hasResults = results.length > 0;

    return (
        <div className="flex-1 max-w-lg mx-4 relative font-sans" ref={searchRef}>
            <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-sidebar-text pointer-events-none" size={15} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (query.trim().length >= 2) setIsOpen(true);
                    }}
                    placeholder="Search WO#, Invoice, Customer, Lot Number, Machine code..."
                    className="w-full py-2 pl-10 pr-9 bg-sidebar-hover/80 border border-sidebar-hover rounded-xl text-xs text-sidebar-text-active placeholder-sidebar-text outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all shadow-2xs"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                            setIsOpen(false);
                        }}
                        className="absolute right-3 text-sidebar-text hover:text-sidebar-text-active cursor-pointer"
                        title="Clear Search"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Global Search Popover Dropdown */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-card-bg border border-border shadow-2xl rounded-xl z-50 overflow-hidden font-sans text-xs text-text-main max-h-96 overflow-y-auto divide-y divide-border">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-6 text-text-muted gap-2">
                            <Loader2 className="animate-spin text-primary" size={16} />
                            <span>Searching ERP database...</span>
                        </div>
                    ) : !hasResults ? (
                        <div className="p-6 text-center text-text-muted">
                            No records found matching "<span className="font-semibold text-text-main">{query}</span>"
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between border-b border-border/40 pb-1.5 mb-1">
                                <span>Search Results ({results.length})</span>
                                <span className="text-[10px] text-text-muted font-normal lowercase">Press Enter or click to navigate</span>
                            </div>
                            {results.map((item, idx) => (
                                <div
                                    key={item.id || `${item.type}-${item.code}-${idx}`}
                                    onClick={() => {
                                        setQuery('');
                                        setResults([]);
                                        setIsOpen(false);
                                        navigate(item.url);
                                    }}
                                    className="px-3 py-2 hover:bg-app-bg rounded-lg cursor-pointer flex items-center justify-between gap-3 transition-colors border-b border-border/30 last:border-0"
                                >
                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                        <div className="mt-0.5 shrink-0">
                                            {getTypeIcon(item.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono font-bold text-text-main text-xs">{item.code}</span>
                                                <span className="text-text-muted text-xs">—</span>
                                                <span className="font-semibold text-text-main text-xs truncate">{item.name}</span>
                                            </div>
                                            {item.subtitle && (
                                                <div className="text-[11px] text-text-muted truncate mt-0.5">
                                                    {item.subtitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getTypeBadgeStyle(item.type)}`}>
                                        {item.type}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
