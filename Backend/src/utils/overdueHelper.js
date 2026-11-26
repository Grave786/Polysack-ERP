/**
 * Single source of truth for Effective Due Date, Overdue Status, and PO Received/Payable computation.
 */

const parseDateValue = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
            const year = parseInt(ddmmyyyyMatch[3], 10);
            const d = new Date(year, month, day, 0, 0, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
};

/**
 * Parse party paymentTerms string (e.g. 'Net 30', '15 Days', '30', 'Immediate', 'COD') into integer days.
 * Returns null if no explicit term days can be extracted.
 */
const parsePaymentTermsDays = (paymentTerms) => {
    if (paymentTerms === undefined || paymentTerms === null) return null;
    const str = String(paymentTerms).trim();
    if (!str) return null;
    if (/^(immediate|cod|cash|advance|due on receipt)$/i.test(str)) return 0;
    const match = str.match(/(\d+)/);
    if (match) {
        const days = parseInt(match[1], 10);
        if (!isNaN(days) && days >= 0 && days <= 3650) {
            return days;
        }
    }
    return null;
};

const toStartOfDay = (dateVal) => {
    const d = parseDateValue(dateVal);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

/**
 * Resolve effective due date:
 * 1) docDate + party's paymentTerms (days) if terms exist
 * 2) else explicit docDueDate on the document
 * 3) else null
 */
const resolveEffectiveDueDate = ({ docDate, docDueDate, paymentTerms }) => {
    const termDays = parsePaymentTermsDays(paymentTerms);
    const baseDate = parseDateValue(docDate);
    if (termDays !== null && baseDate) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
        d.setDate(d.getDate() + termDays);
        return d;
    }
    const explicit = parseDateValue(docDueDate);
    return explicit ? new Date(explicit.getFullYear(), explicit.getMonth(), explicit.getDate(), 0, 0, 0, 0) : null;
};

/**
 * Compute payment status and overdue days:
 * - Paid: balance <= 0
 * - Overdue: balance > 0 AND effectiveDueDate exists AND effectiveDueDate < todayStart
 * - Partially Paid: paid > 0 && balance > 0 (and not overdue)
 * - Unpaid: paid === 0 && (!effectiveDueDate || effectiveDueDate >= todayStart)
 */
const computeOverdueInfo = ({ totalAmount = 0, paidAmount = 0, docDate, docDueDate, paymentTerms, now = new Date() }) => {
    const total = Math.max(0, Number(totalAmount || 0));
    const paid = Math.max(0, Number(paidAmount || 0));
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

    const effectiveDueDate = resolveEffectiveDueDate({ docDate, docDueDate, paymentTerms });
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dueStart = effectiveDueDate ? toStartOfDay(effectiveDueDate) : null;

    let isOverdue = false;
    let daysOverdue = 0;

    if (balance > 0.0001 && dueStart && dueStart.getTime() < todayStart.getTime()) {
        isOverdue = true;
        daysOverdue = Math.max(1, Math.floor((todayStart.getTime() - dueStart.getTime()) / (1000 * 60 * 60 * 24)));
    }

    let paymentStatus = 'UNPAID';
    if (balance <= 0.0001) {
        paymentStatus = 'PAID';
    } else if (isOverdue) {
        paymentStatus = 'OVERDUE';
    } else if (paid > 0.0001) {
        paymentStatus = 'PARTIALLY_PAID';
    } else {
        paymentStatus = 'UNPAID';
    }

    return {
        effectiveDueDate,
        balance,
        isOverdue,
        daysOverdue,
        paymentStatus
    };
};

/**
 * Compute PO received value and payable amount based on receivedQuantity:
 * - FULLY_RECEIVED: receivedValue = poGrandTotal
 * - PARTIALLY_RECEIVED: proportional received value (sum(receivedQty * ratePerUnit) scaled by grandTotal/itemsSubtotal if charges exist, capped at poGrandTotal)
 * - Other statuses (DRAFT, PENDING_APPROVAL, SENT_TO_SUPPLIER): receivedValue = 0 (goods not yet received)
 */
const computePoPayableValues = (poDoc) => {
    const poValue = Math.max(0, Number(poDoc.grandTotal ?? poDoc.totalValue ?? poDoc.totalAmount ?? 0));
    const paid = Math.max(0, Number(poDoc.paidAmount || 0));
    const status = String(poDoc.status || 'DRAFT').toUpperCase();

    let receivedValue = 0;
    if (status === 'FULLY_RECEIVED') {
        receivedValue = poValue;
    } else if (status === 'PARTIALLY_RECEIVED' || (Array.isArray(poDoc.items) && poDoc.items.some((it) => Number(it.receivedQuantity || 0) > 0))) {
        const items = Array.isArray(poDoc.items) ? poDoc.items : [];
        const rawOrdered = items.reduce((s, it) => s + (Number(it.orderedQuantity || 0) * Number(it.ratePerUnit || 0)), 0);
        const rawReceived = items.reduce((s, it) => s + (Number(it.receivedQuantity || 0) * Number(it.ratePerUnit || 0)), 0);
        if (rawOrdered > 0) {
            const ratio = Math.min(1, rawReceived / rawOrdered);
            receivedValue = Math.round(poValue * ratio * 100) / 100;
        } else {
            receivedValue = Math.round(rawReceived * 100) / 100;
        }
        receivedValue = Math.min(poValue, receivedValue);
    }

    const payableBalance = Math.max(0, Math.round((receivedValue - paid) * 100) / 100);
    return {
        poValue,
        receivedValue,
        paidAmount: paid,
        payableBalance
    };
};

module.exports = {
    parseDateValue,
    parsePaymentTermsDays,
    resolveEffectiveDueDate,
    computeOverdueInfo,
    computePoPayableValues
};
