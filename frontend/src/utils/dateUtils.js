/**
 * PolySack ERP - Local Date Utilities
 * Ensures all HTML date-pickers (<input type="date">) use the exact local date (YYYY-MM-DD)
 * without UTC shift or timezone offset corruption.
 */

/**
 * Returns today's date in local YYYY-MM-DD format
 */
export const getTodayLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns a date N days ahead in local YYYY-MM-DD format
 */
export const getFutureLocalDateString = (daysAhead = 7) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Converts any date input (ISO string, timestamp, Date obj) to local YYYY-MM-DD string
 */
export const formatToLocalDateString = (dateInput) => {
    if (!dateInput) return getTodayLocalDateString();
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return getTodayLocalDateString();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
