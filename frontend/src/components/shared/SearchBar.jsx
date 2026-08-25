import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search record...' }) {
    return (
        <div className="relative flex items-center w-full max-w-xs">
            <Search className="absolute left-3 text-text-muted pointer-events-none" size={16} />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full py-2 pl-9 pr-8 bg-card-bg border border-border rounded-lg text-xs text-text-main placeholder-text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-sans"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2.5 text-text-muted hover:text-text-main p-0.5"
                    title="Clear search"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
