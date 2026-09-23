import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
    const totalRecords = pagination?.totalCount !== undefined
        ? pagination.totalCount
        : (pagination?.total !== undefined ? pagination.total : 0);
    const currentPage = pagination?.currentPage || pagination?.page || 1;
    const pageSize = pagination?.limit || 10;
    const totalPages = pagination?.totalPages || pagination?.pages || Math.ceil(totalRecords / pageSize) || 1;

    const start = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalRecords);

    const handlePrev = () => {
        if (typeof onPageChange === 'function') {
            onPageChange((prev) => Math.max((typeof prev === 'number' ? prev : currentPage) - 1, 1));
        }
    };

    const handleNext = () => {
        if (typeof onPageChange === 'function') {
            onPageChange((prev) => Math.min((typeof prev === 'number' ? prev : currentPage) + 1, totalPages));
        }
    };

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-card-bg border-t border-border text-xs text-text-muted font-sans">
            <div>
                Showing <span className="font-semibold text-text-main">{start}</span> to{' '}
                <span className="font-semibold text-text-main">{end}</span> of{' '}
                <span className="font-semibold text-text-main">{totalRecords}</span> records
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card-bg text-text-main hover:bg-app-bg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                </button>

                <span className="px-2 font-medium text-text-main">
                    Page {currentPage} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card-bg text-text-main hover:bg-app-bg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    <span>Next</span>
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
