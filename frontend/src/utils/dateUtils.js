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

/**
 * Formats a date value into dd/mm/yyyy string.
 * Zero-pads day and month.
 * Avoids timezone shift issues for date-only strings (YYYY-MM-DD or midnight ISO).
 * Returns "-" for null, undefined or invalid dates.
 */
export const formatDate = (val) => {
    if (!val) return '-';

    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return '-';

        // Check if string matches YYYY-MM-DD (e.g. "2026-09-28" or "2026-09-28T00:00:00...")
        const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
        if (dateOnlyMatch) {
            const [, y, m, d] = dateOnlyMatch;
            return `${d}/${m}/${y}`;
        }
    }

    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Formats a date/time value into "dd/mm/yyyy, hh:mm AM/PM" string.
 * Returns "-" for null, undefined or invalid dates.
 */
export const formatDateTime = (val) => {
    if (!val) return '-';
    const d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? String(hours).padStart(2, '0') : '12';

    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
};

/**
 * Safely parses any date representation (Date obj, timestamp, ISO string, DD/MM/YYYY, DD-MM-YYYY).
 * Returns Date object or null if invalid.
 */
export const parseDateValue = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        // Check for DD/MM/YYYY or DD-MM-YYYY (e.g. 12/10/2026 or 28/09/2026)
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
            const year = parseInt(ddmmyyyyMatch[3], 10);
            const d = new Date(year, month, day, 23, 59, 59, 999);
            if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
};

/**
 * Checks if a given date is strictly in the past (before today / now).
 */
export const isDateOverdue = (dateVal, now = new Date()) => {
    const d = parseDateValue(dateVal);
    if (!d) return false;
    return d.getTime() < now.getTime();
};
