import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Users, ShoppingBag } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ customers: [], salesOrders: [] });
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

    // Debounced search logic (400ms)
    useEffect(() => {
        if (!query.trim() || query.trim().length < 2) {
            setResults({ customers: [], salesOrders: [] });
            setIsLoading(false);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            setIsOpen(true);
            try {
                const [custRes, soRes] = await Promise.allSettled([
                    axiosInstance.get('/customers', { params: { search: query.trim(), limit: 5 } }),
                    axiosInstance.get('/sales-orders', { params: { search: query.trim(), limit: 5 } })
                ]);

                const customers = custRes.status === 'fulfilled' && custRes.value.data?.success ? custRes.value.data.data : [];
                const salesOrders = soRes.status === 'fulfilled' && soRes.value.data?.success ? soRes.value.data.data : [];

                setResults({ customers, salesOrders });
            } catch (err) {
                console.warn('Global search failed:', err.message);
                setResults({ customers: [], salesOrders: [] });
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query]);

    const hasResults = results.customers.length > 0 || results.salesOrders.length > 0;

    return (
        <div className="flex-1 max-w-lg mx-4 relative font-sans" ref={searchRef}>
            <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-sidebar-text pointer-events-none" size={15} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
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
                            setIsOpen(false);
                        }}
                        className="absolute right-3 text-sidebar-text hover:text-sidebar-text-active cursor-pointer"
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
                        <>
                            {/* Customers Section */}
                            {results.customers.length > 0 && (
                                <div className="p-2">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <Users size={13} className="text-primary" />
                                        <span>Customers ({results.customers.length})</span>
                                    </div>
                                    {results.customers.map((c) => (
                                        <div
                                            key={c._id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                navigate('/master-data');
                                            }}
                                            className="px-3 py-2 hover:bg-app-bg rounded-lg cursor-pointer flex items-center justify-between transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-text-main">{c.companyName}</div>
                                                <div className="text-[11px] text-text-muted">{c.code || c.customerCode} {c.city ? `• ${c.city}` : ''}</div>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                Master Data
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Sales Orders Section */}
                            {results.salesOrders.length > 0 && (
                                <div className="p-2">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                        <ShoppingBag size={13} className="text-primary" />
                                        <span>Sales Orders ({results.salesOrders.length})</span>
                                    </div>
                                    {results.salesOrders.map((so) => (
                                        <div
                                            key={so._id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                navigate('/sales');
                                            }}
                                            className="px-3 py-2 hover:bg-app-bg rounded-lg cursor-pointer flex items-center justify-between transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-text-main">{so.soNumber || 'SO-RECORD'}</div>
                                                <div className="text-[11px] text-text-muted">
                                                    {typeof so.customer === 'object' ? so.customer?.companyName : 'Customer Order'}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                ₹{so.totalAmount ? Number(so.totalAmount).toLocaleString() : '0'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
