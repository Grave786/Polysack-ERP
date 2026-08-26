import { useState, useEffect, useRef } from 'react';
import { Loader2, Database, ArrowUpDown, Pencil, Trash2, Columns, Download, Filter } from 'lucide-react';
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
    onEdit = (row) => console.log('Edit row:', row),
    onDelete = (row) => console.log('Deactivate row:', row),
    onExportCsv = null
}) {
    // State to manage visible columns dynamically
    const [visibleColumns, setVisibleColumns] = useState({});
    const [showColumnDropdown, setShowColumnDropdown] = useState(false);

    // State to manage row selections for "Select All" header checkbox
    const [selectedRowIds, setSelectedRowIds] = useState([]);

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

    return (
        <div className="w-full space-y-3 font-sans">
            {/* Top Action Bar Above Table: Search Bar on LEFT, Columns & Export CSV on RIGHT */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card-bg p-3.5 border border-border rounded-xl shadow-2xs">
                {/* Search Bar on Left */}
                <div className="w-full sm:w-auto flex-1 max-w-sm sm:max-w-md">
                    <SearchBar
                        value={search}
                        onChange={onSearchChange}
                        placeholder={`Search ${activeTabLabel || 'records'}...`}
                    />
                </div>

                {/* Right Action Controls: Status Filter, Columns & Export CSV */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 flex-wrap sm:flex-nowrap">
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
                    <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-2 bg-card-bg border border-border hover:bg-app-bg text-text-muted hover:text-text-main rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs select-none"
                        onClick={onExportCsv || (() => alert('Exporting CSV feature coming soon!'))}
                    >
                        <Download size={15} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Table & Mobile Cards Container */}
            <div className="w-full space-y-3">
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
                        <div className="sm:hidden space-y-3 font-sans">
                            {data.map((row, rowIndex) => {
                                const rowId = row._id || rowIndex;
                                const isRowSelected = selectedRowIds.includes(rowId);
                                const isInactiveRecord = row.isActive === false;

                                return (
                                    <div
                                        key={rowId}
                                        className={`bg-card-bg border rounded-xl p-4 shadow-2xs space-y-2.5 transition-all ${
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
                                                    <div key={colIndex} className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted shrink-0">
                                                            {col.header}
                                                        </span>
                                                        <span className="font-semibold text-text-main text-right truncate">
                                                            {cellValue !== null && cellValue !== undefined ? cellValue : '-'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Card Actions Footer */}
                                        {!hasCustomActionsColumn && (
                                            <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-border/40">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(row)}
                                                    className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={14} />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(row)}
                                                    className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Deactivate</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Standard Desktop / Tablet HTML Table (visible sm and above) */}
                        <div className="hidden sm:block w-full overflow-x-auto border border-border rounded-xl shadow-2xs bg-card-bg">
                            <table className="w-full text-left border-collapse text-xs">
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

                                        {!hasCustomActionsColumn && (
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

                                                {!hasCustomActionsColumn && (
                                                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => onEdit(row)}
                                                                className="p-1 text-text-muted hover:text-primary transition-colors cursor-pointer rounded"
                                                                title="Edit Record"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => onDelete(row)}
                                                                className="p-1 text-text-muted hover:text-rose-500 transition-colors cursor-pointer rounded"
                                                                title="Deactivate Record"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
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
                {pagination && pagination.total > 0 && (
                    <Pagination pagination={pagination} onPageChange={onPageChange} />
                )}
            </div>
        </div>
    );
}
