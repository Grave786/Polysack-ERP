import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
    const { total = 0, page = 1, limit = 10, totalPages = 1 } = pagination || {};

    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-card-bg border-t border-border text-xs text-text-muted font-sans">
            <div>
                Showing <span className="font-semibold text-text-main">{start}</span> to{' '}
                <span className="font-semibold text-text-main">{end}</span> of{' '}
                <span className="font-semibold text-text-main">{total}</span> records
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card-bg text-text-main hover:bg-app-bg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                </button>

                <span className="px-2 font-medium text-text-main">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card-bg text-text-main hover:bg-app-bg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <span>Next</span>
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
