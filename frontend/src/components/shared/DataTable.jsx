import { useState, useEffect, useRef } from 'react';
import { Loader2, Database, ArrowUpDown, Pencil, Trash2, Columns, Download, Filter, X, AlertTriangle, Eye } from 'lucide-react';
import SearchBar from './SearchBar';
import Pagination from './Pagination';

export default function DataTable({
    columns = [],
    data = [],
    isLoading = false,
    emptyMessage = 'No records found',
    search = '',
    onSearchChange = () => {},
    statusFilter = 'All',
    onStatusFilterChange = () => {},
    availableStatuses = ['Active', 'Inactive'],
    pagination = {},
    onPageChange = () => {},
    activeTabLabel = '',
    onView = null,
    isViewable = true,
    onEdit = (row) => console.log('Edit row:', row),
    onDelete = (row) => console.log('Deactivate row:', row),
    onBulkDelete = null,
    isEditable = true,
    isDeletable = true,
    onExportCsv = null
}) {
    // State to manage visible columns dynamically
    const [visibleColumns, setVisibleColumns] = useState({});
    const [showColumnDropdown, setShowColumnDropdown] = useState(false);

    // State to manage row selections for "Select All" header checkbox
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const dropdownRef = useRef(null);

    // Initialize visible columns when columns prop changes
    useEffect(() => {
        const initialVisibility = {};
        columns.forEach((col) => {
            const colKey = col.key || col.header;
            initialVisibility[colKey] = true;
        });
        setVisibleColumns(initialVisibility);
    }, [columns]);

    // Reset row selections when dataset changes
    useEffect(() => {
        setSelectedRowIds([]);
    }, [data]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowColumnDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Safe helper to extract nested object properties e.g., 'category.name'
    const getNestedValue = (obj, path) => {
        if (!obj || !path) return null;
        return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : null), obj);
    };

    const toggleColumnVisibility = (colKey) => {
        setVisibleColumns((prev) => ({
            ...prev,
            [colKey]: prev[colKey] === false ? true : false
        }));
    };

    // Row selection calculation
    const allDisplayedIds = data.map((row) => row._id).filter(Boolean);
    const isAllSelected = allDisplayedIds.length > 0 && allDisplayedIds.every((id) => selectedRowIds.includes(id));
    const isSomeSelected = allDisplayedIds.some((id) => selectedRowIds.includes(id)) && !isAllSelected;

    const handleToggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRowIds(allDisplayedIds);
        } else {
            setSelectedRowIds([]);
        }
    };

    const handleToggleRow = (id) => {
        setSelectedRowIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const hasCustomActionsColumn = columns.some((col) => col.header && String(col.header).toUpperCase() === 'ACTIONS');
    const showActionColumn = !hasCustomActionsColumn && (isEditable || isDeletable || (isViewable && Boolean(onView)));

    const handleConfirmBulkDelete = async () => {
        if (!onBulkDelete || selectedRowIds.length === 0) return;
        try {
            setIsDeleting(true);
            await onBulkDelete(selectedRowIds);
            setSelectedRowIds([]);
            setShowDeleteConfirm(false);
        } catch (err) {
            console.error('Bulk delete error:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="w-full max-w-full space-y-3 font-sans">
            {/* Contextual Bulk Action Bar */}
            {selectedRowIds.length > 0 && (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/30 p-2.5 sm:p-3 rounded-xl shadow-xs text-xs font-sans animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center bg-primary text-sidebar-bg font-mono font-extrabold w-6 h-6 rounded-full text-xs">
                            {selectedRowIds.length}
                        </span>
                        <span className="font-bold text-text-main">
                            {selectedRowIds.length} {selectedRowIds.length === 1 ? 'record' : 'records'} selected
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedRowIds([])}
                            className="px-2.5 py-1.5 text-text-muted hover:text-text-main hover:bg-card-bg border border-transparent hover:border-border rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <X size={14} />
                            <span>Clear selection</span>
                        </button>

                        {isDeletable !== false && onBulkDelete ? (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                <span>Delete Selected</span>
                            </button>
                        ) : (
                            <span className="text-[11px] text-text-muted italic px-2">
                                (Immutable records cannot be deleted)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Top Action Bar Above Table: Search Bar on LEFT, Columns & Export CSV on RIGHT */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-card-bg p-3 sm:p-3.5 border border-border rounded-xl shadow-2xs w-full max-w-full">
                {/* Search Bar on Left */}
                <div className="w-full sm:w-auto flex-1 max-w-full sm:max-w-md">
                    <SearchBar
                        value={search}
                        onChange={onSearchChange}
                        placeholder={`Search ${activeTabLabel || 'records'}...`}
                    />
                </div>

                {/* Right Action Controls: Status Filter, Columns & Export CSV */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 flex-wrap sm:flex-nowrap">
                    {/* Dynamic Status Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-card-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-main shadow-2xs select-none">
                        <Filter size={14} className="text-text-muted shrink-0" />
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                            className="bg-transparent text-xs font-semibold text-text-main focus:outline-none cursor-pointer"
                        >
                            <option value="All Statuses">All Statuses</option>
                            {availableStatuses.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Columns Dropdown Toggle Container */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-2 bg-card-bg border border-border hover:bg-app-bg text-text-muted hover:text-text-main rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs select-none"
                            onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                        >
                            <Columns size={15} />
                            <span>Columns</span>
                        </button>

                        {/* Column Toggle Dropdown Menu */}
                        {showColumnDropdown && (
                            <div className="absolute right-0 mt-2 w-56 bg-card-bg border border-border shadow-xl rounded-md z-50 p-3 font-sans">
                                <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                                    TOGGLE COLUMNS
                                </div>
                                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                    {columns.map((col, idx) => {
                                        const colKey = col.key || col.header;
                                        const isChecked = visibleColumns[colKey] !== false;
                                        return (
                                            <label
                                                key={idx}
                                                className="flex items-center gap-2 text-xs text-text-main cursor-pointer hover:text-primary transition-colors py-0.5 select-none"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleColumnVisibility(colKey)}
                                                    className="rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                                                />
                                                <span className="truncate">{col.header}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Export CSV Button */}
                    {onExportCsv && (
                        <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-2 bg-card-bg border border-border hover:bg-app-bg text-text-muted hover:text-text-main rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs select-none"
                            onClick={onExportCsv}
                        >
                            <Download size={15} />
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog for Bulk Delete */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card-bg border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 font-sans text-xs">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-full shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-text-main">
                                    Delete {selectedRowIds.length} {selectedRowIds.length === 1 ? 'Record' : 'Records'}?
                                </h3>
                                <p className="text-text-muted mt-1 leading-relaxed">
                                    Are you sure you want to deactivate {selectedRowIds.length} selected {activeTabLabel || 'record'}(s)? This will mark them as inactive.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-app-bg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleConfirmBulkDelete}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                <span>{isDeleting ? 'Deleting...' : 'Confirm Deletion'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table or Mobile Cards Content */}
            <div className="w-full max-w-full">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card-bg border border-border rounded-xl text-text-muted font-sans">
                        <Loader2 className="animate-spin mb-2 text-primary" size={32} />
                        <span className="text-xs font-semibold text-text-main">Loading records...</span>
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-card-bg border border-border rounded-xl text-text-muted font-sans">
                        <Database className="mb-2 opacity-40 text-text-muted" size={36} />
                        <span className="text-sm font-bold text-text-main">{emptyMessage}</span>
                        <span className="text-xs text-text-muted mt-1">There are no records matching your request.</span>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card-Based List View (visible below sm breakpoint) */}
                        <div className="sm:hidden space-y-3 font-sans w-full max-w-full">
                            {data.map((row, rowIndex) => {
                                const rowId = row._id || rowIndex;
                                const isRowSelected = selectedRowIds.includes(rowId);
                                const isInactiveRecord = row.isActive === false;

                                return (
                                    <div
                                        key={rowId}
                                        className={`bg-card-bg border rounded-xl p-3.5 shadow-2xs space-y-2.5 transition-all w-full max-w-full box-border ${
                                            isInactiveRecord
                                                ? 'border-border/60 bg-gray-100/50 text-text-muted opacity-75'
                                                : isRowSelected
                                                ? 'border-primary/50 bg-primary/5'
                                                : 'border-border'
                                        }`}
                                    >
                                        {/* Card Header row with checkbox */}
                                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isRowSelected}
                                                    onChange={() => handleToggleRow(rowId)}
                                                    className="rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                                                />
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                                                    RECORD #{rowIndex + 1}
                                                </span>
                                            </div>
                                            {isInactiveRecord && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-300">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>

                                        {/* Label : Value pairs */}
                                        <div className="space-y-2 pt-1">
                                            {columns.map((col, colIndex) => {
                                                const colKey = col.key || col.header;
                                                if (visibleColumns[colKey] === false) return null;

                                                let cellValue = null;
                                                if (col.render) {
                                                    cellValue = col.render(row);
                                                } else if (col.accessor) {
                                                    cellValue = getNestedValue(row, col.accessor);
                                                }

                                                if (col.type === 'badge') {
                                                    const isActiveState = cellValue === true || cellValue === 'Active' || cellValue === 'COMPLETED' || cellValue === 'PASSED' || cellValue === 'PAID';
                                                    cellValue = (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                                            isActiveState ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                        }`}>
                                                            {cellValue !== null && cellValue !== undefined ? String(cellValue) : 'Inactive'}
                                                        </span>
                                                    );
                                                }

                                                return (
                                                    <div key={colIndex} className="flex items-start justify-between gap-2 text-xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted shrink-0 max-w-[45%]">
                                                            {col.header}
                                                        </span>
                                                        <span className="font-semibold text-text-main text-right break-words max-w-[55%]">
                                                            {cellValue !== null && cellValue !== undefined ? cellValue : '-'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Card Actions Footer */}
                                        {showActionColumn && (
                                            <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-border/40">
                                                {isViewable && onView && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onView(row)}
                                                        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
                                                        title="View Record Details"
                                                    >
                                                        <Eye size={14} />
                                                        <span>View</span>
                                                    </button>
                                                )}
                                                {isEditable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(row)}
                                                        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
                                                    >
                                                        <Pencil size={14} />
                                                        <span>Edit</span>
                                                    </button>
                                                )}
                                                {isDeletable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDelete(row)}
                                                        className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Deactivate</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Standard Desktop / Tablet HTML Table (visible sm and above) */}
                        <div className="hidden sm:block w-full max-w-full overflow-x-auto border border-border rounded-xl shadow-2xs bg-card-bg">
                            <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                                <thead>
                                    <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase tracking-wider text-[11px]">
                                        <th className="px-4 py-3.5 border-b border-border/40 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                ref={(input) => {
                                                    if (input) input.indeterminate = isSomeSelected;
                                                }}
                                                onChange={handleToggleSelectAll}
                                                className="rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                                                title="Select all displayed rows"
                                            />
                                        </th>

                                        {columns.map((col, idx) => {
                                            const colKey = col.key || col.header;
                                            if (visibleColumns[colKey] === false) return null;

                                            return (
                                                <th key={idx} className="px-4 py-3.5 border-b border-border/40 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{col.header}</span>
                                                        {col.sortable && (
                                                            <ArrowUpDown size={12} className="text-table-header-text/70 shrink-0" />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}

                                        {showActionColumn && (
                                            <th className="px-4 py-3.5 border-b border-border/40 text-right whitespace-nowrap">
                                                ACTIONS
                                            </th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border bg-card-bg">
                                    {data.map((row, rowIndex) => {
                                        const rowId = row._id || rowIndex;
                                        const isRowSelected = selectedRowIds.includes(rowId);
                                        const isInactiveRecord = row.isActive === false;

                                        return (
                                            <tr
                                                key={rowId}
                                                className={`transition-colors duration-150 text-text-main ${
                                                    isInactiveRecord
                                                        ? 'bg-gray-100/70 text-text-muted opacity-60'
                                                        : isRowSelected
                                                        ? 'bg-primary/5 hover:bg-primary/10'
                                                        : 'hover:bg-app-bg/60'
                                                }`}
                                            >
                                                <td className="px-4 py-3.5 w-10 text-center whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRowSelected}
                                                        onChange={() => handleToggleRow(rowId)}
                                                        className="rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                                                    />
                                                </td>

                                                {columns.map((col, colIndex) => {
                                                    const colKey = col.key || col.header;
                                                    if (visibleColumns[colKey] === false) return null;

                                                    let cellValue = null;
                                                    if (col.render) {
                                                        cellValue = col.render(row);
                                                    } else if (col.accessor) {
                                                        cellValue = getNestedValue(row, col.accessor);
                                                    }

                                                    if (col.type === 'badge') {
                                                        const isActiveState = cellValue === true || cellValue === 'Active' || cellValue === 'COMPLETED' || cellValue === 'PASSED' || cellValue === 'PAID';
                                                        cellValue = (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                                                isActiveState ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                            }`}>
                                                                {cellValue !== null && cellValue !== undefined ? String(cellValue) : 'Inactive'}
                                                            </span>
                                                        );
                                                    }

                                                    return (
                                                        <td key={colIndex} className="px-4 py-3.5 whitespace-nowrap text-xs font-medium">
                                                            {cellValue !== null && cellValue !== undefined ? cellValue : '-'}
                                                        </td>
                                                    );
                                                })}

                                                {showActionColumn && (
                                                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isViewable && onView && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onView(row)}
                                                                    className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer rounded"
                                                                    title="View Details"
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                            )}

                                                            {isEditable && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onEdit(row)}
                                                                    className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer rounded"
                                                                    title="Edit Record"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                            )}

                                                            {isDeletable && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onDelete(row)}
                                                                    className="p-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer rounded"
                                                                    title="Deactivate Record"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Pagination Footer */}
                {pagination && (pagination.total > 0 || pagination.totalCount > 0) && (
                    <Pagination pagination={pagination} onPageChange={onPageChange} />
                )}
            </div>
        </div>
    );
}
