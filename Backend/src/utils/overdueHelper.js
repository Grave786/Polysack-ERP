/**
 * Single source of truth for Effective Due Date, Overdue Status, and PO/GRN Received/Payable computation.
 */
const { computeDocumentTotals } = require('./gstHelper');

// Counting rule for GRN payable due date: received date counts as day 1 (dueDate = receivedDate + termsDays - 1)
const GRN_RECEIVED_DATE_COUNTS_AS_DAY_ONE = true;
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

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

/**
 * Resolve supplier payment terms in integer days, falling back to DEFAULT_PAYMENT_TERMS_DAYS (30 days)
 * so suppliers without explicit terms still receive a visible default.
 */
const resolveSupplierPaymentTerms = (paymentTerms) => {
    const parsed = parsePaymentTermsDays(paymentTerms);
    if (parsed !== null) {
        return {
            days: parsed,
            isDefault: false,
            label: parsed === 0 ? 'Immediate (0 days)' : `${parsed} days`
        };
    }
    return {
        days: DEFAULT_PAYMENT_TERMS_DAYS,
        isDefault: true,
        label: `${DEFAULT_PAYMENT_TERMS_DAYS} days (default)`
    };
};

/**
 * Extract IST YYYY-MM-DD calendar date parts (no UTC off-by-one shift).
 */
const getIstCalendarParts = (dateVal) => {
    const d = parseDateValue(dateVal);
    if (!d) return null;
    try {
        const ymd = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
        const [y, m, day] = ymd.split('-').map(Number);
        if (!y || !m || !day) return null;
        return { y, m, day };
    } catch {
        return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
    }
};

/**
 * Compute GRN payable due date in IST date-only math:
 * When GRN_RECEIVED_DATE_COUNTS_AS_DAY_ONE is true, receivedDate counts as day 1:
 *   dueDate = receivedDate + max(0, paymentTermsDays - 1)
 */
const computeGrnDueDate = (receivedDate, paymentTermsDays) => {
    const parts = getIstCalendarParts(receivedDate);
    if (!parts) return null;
    const days = Math.max(0, Number(paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS));
    const offsetDays = GRN_RECEIVED_DATE_COUNTS_AS_DAY_ONE ? Math.max(0, days - 1) : days;
    // Construct UTC midnight for calendar arithmetic, then store as IST start-of-day
    const utcTarget = new Date(Date.UTC(parts.y, parts.m - 1, parts.day + offsetDays));
    const y = utcTarget.getUTCFullYear();
    const m = String(utcTarget.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcTarget.getUTCDate()).padStart(2, '0');
    return new Date(`${y}-${m}-${day}T00:00:00.000+05:30`);
};

const extractRefId = (ref) => {
    if (!ref) return '';
    if (typeof ref === 'object' && ref._id) return String(ref._id);
    return String(ref);
};

const extractGrnItemQty = (gi) => {
    if (!gi) return 0;
    const raw = gi.receivedQuantity ?? gi.receivedQty ?? gi.quantity ?? gi.qty ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
};

const extractPoItemRate = (pi) => {
    if (!pi) return 0;
    const raw = pi.ratePerUnit ?? pi.unitPrice ?? pi.rate ?? pi.pricePerUnit ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
};

/**
 * Compute GRN payable amount (received qty * PO line rate + pro-rata PO discount/charges + GST + whole-rupee round-off).
 */
const computeGrnPayableAmount = (grnDoc, poDoc) => {
    const grnItems = Array.isArray(grnDoc?.items) ? grnDoc.items : [];
    const poItems = Array.isArray(poDoc?.items) ? poDoc.items : [];

    let grnSubtotal = 0;
    let grnTotalQty = 0;

    for (const gi of grnItems) {
        const qty = extractGrnItemQty(gi);
        grnTotalQty += qty;
        const rmId = extractRefId(gi.rawMaterial);
        let poItem = poItems.find((pi) => rmId && extractRefId(pi.rawMaterial) === rmId);
        if (!poItem && (gi.poItemId || gi.itemId)) {
            const itemId = String(gi.poItemId || gi.itemId);
            poItem = poItems.find((pi) => pi._id && String(pi._id) === itemId);
        }
        if (!poItem && poItems.length === 1 && grnItems.length === 1) {
            poItem = poItems[0];
        }
        const rate = extractPoItemRate(poItem);
        grnSubtotal += qty * rate;
    }

    // Legacy roll-based GRNs where item receivedQuantity may be 0 and weight is on rolls
    if (grnSubtotal <= 0 && Array.isArray(grnDoc?.rolls) && grnDoc.rolls.length > 0 && poItems.length > 0) {
        const rollQty = grnDoc.rolls.reduce(
            (sum, r) => sum + Number(r.totalQuantityKg ?? r.netWeight ?? r.grossWeight ?? 0),
            0
        );
        if (rollQty > 0) {
            grnTotalQty = rollQty;
            const rate = extractPoItemRate(poItems[0]);
            grnSubtotal = rollQty * rate;
        }
    }

    const poSubtotalFromItems = poItems.reduce(
        (s, it) => s + (Number(it.orderedQuantity ?? it.quantity ?? 0) * extractPoItemRate(it)),
        0
    );
    const poSubtotal = Number(poDoc?.itemsSubtotal || 0) > 0
        ? Number(poDoc.itemsSubtotal)
        : poSubtotalFromItems;

    // Fallback: proportional to ordered quantity if item-level ID matching still yielded 0
    if (grnSubtotal <= 0 && grnTotalQty > 0 && poSubtotal > 0) {
        const totalOrderedQty = poItems.reduce((s, it) => s + Number(it.orderedQuantity ?? it.quantity ?? 0), 0);
        if (totalOrderedQty > 0) {
            grnSubtotal = (grnTotalQty / totalOrderedQty) * poSubtotal;
        }
    }

    const share = poSubtotal > 0 ? (grnSubtotal / poSubtotal) : 0;
    const disc = Number((Number(poDoc?.discountAmount || 0) * share).toFixed(2));
    const freight = Number((Number(poDoc?.freightAmount ?? poDoc?.freightCharges ?? 0) * share).toFixed(2));
    const insurance = Number((Number(poDoc?.insuranceAmount ?? poDoc?.insuranceCharges ?? 0) * share).toFixed(2));
    const other = Number((Number(poDoc?.otherChargesAmount ?? poDoc?.otherCharges ?? 0) * share).toFixed(2));

    const rawTreatment = String(poDoc?.gstTreatment || 'TAXABLE').trim().toUpperCase();
    const gstTreatment = ['TAXABLE', 'EXEMPT'].includes(rawTreatment) ? rawTreatment : 'TAXABLE';
    const gstRate = (poDoc?.gstRate !== undefined && poDoc?.gstRate !== null && !isNaN(Number(poDoc.gstRate)))
        ? Number(poDoc.gstRate)
        : 18;

    const totals = computeDocumentTotals({
        itemsSubtotal: grnSubtotal,
        discountType: 'FIXED',
        discountValue: disc,
        freightAmount: freight,
        insuranceAmount: insurance,
        otherChargesAmount: other,
        gstTreatment,
        gstRate,
        autoRoundOff: poDoc?.autoRoundOff !== false
    });

    if (totals && !totals.error) {
        return Math.max(0, Number(totals.grandTotal || 0));
    }
    return Math.max(0, Math.round(grnSubtotal));
};

/**
 * Single shared GRN payable resolver:
 * - If the GRN has stored snapshot fields (payableAmount > 0 and dueDate present), use them.
 * - Otherwise compute at read time from GRN received quantities, PO line rates, PO GST treatment,
 *   pro-rata charges/discount, and whole-rupee round-off.
 * Returns { termsDays, isDefaultPaymentTerms, paymentTermsLabel, dueDate, payableAmount, isSnapshot, isUnknownPayable }.
 */
const resolveGrnPayable = (grnDoc, poDoc = {}, supplierTerms = null) => {
    const gObj = grnDoc?.toObject ? grnDoc.toObject() : (grnDoc || {});
    const termsInfo = resolveSupplierPaymentTerms(supplierTerms ?? poDoc?.supplier?.paymentTerms);

    const hasStoredTerms = gObj.paymentTermsDays !== undefined && gObj.paymentTermsDays !== null;
    const termsDays = hasStoredTerms ? Number(gObj.paymentTermsDays) : termsInfo.days;
    const isDefaultPaymentTerms = hasStoredTerms ? Boolean(gObj.isDefaultPaymentTerms) : termsInfo.isDefault;
    const paymentTermsLabel = isDefaultPaymentTerms
        ? `${termsDays} days (default)`
        : (termsDays === 0 ? 'Immediate (0 days)' : `${termsDays} days`);

    const parsedStoredDueDate = gObj.dueDate ? parseDateValue(gObj.dueDate) : null;
    const hasStoredPayable = gObj.payableAmount !== undefined && gObj.payableAmount !== null && Number(gObj.payableAmount) > 0;
    const isSnapshot = Boolean(hasStoredPayable && parsedStoredDueDate);

    const dueDate = parsedStoredDueDate || computeGrnDueDate(gObj.receivedDate || gObj.createdAt, termsDays);
    const payableAmount = isSnapshot
        ? Number(gObj.payableAmount)
        : computeGrnPayableAmount(gObj, poDoc);

    const hasReceivedQty = (
        (Array.isArray(gObj.items) && gObj.items.some((it) => extractGrnItemQty(it) > 0))
        || (Array.isArray(gObj.rolls) && gObj.rolls.some((r) => Number(r.totalQuantityKg ?? r.netWeight ?? r.grossWeight ?? 0) > 0))
    );
    const isUnknownPayable = hasReceivedQty && (!Number.isFinite(payableAmount) || payableAmount <= 0);

    if (isUnknownPayable) {
        console.warn(`[resolveGrnPayable] Payable amount is 0 or could not be computed for GRN ${gObj.grnNumber || gObj._id || 'UNKNOWN'}`);
    }

    return {
        termsDays,
        isDefaultPaymentTerms,
        paymentTermsLabel,
        dueDate,
        payableAmount: Number.isFinite(payableAmount) ? Math.max(0, Number(payableAmount)) : 0,
        isSnapshot,
        isUnknownPayable
    };
};

/**
 * Allocate PO-level paidAmount across its GRNs (oldest due date first).
 * Returns enriched GRN rows with paidAmount, balanceAmount, paymentStatus, isOverdue, daysOverdue.
 */
const allocatePaymentsToGrns = (grns = [], poDoc = {}, supplierTerms = null, now = new Date()) => {
    const todayParts = getIstCalendarParts(now);
    const todayStart = todayParts
        ? new Date(`${todayParts.y}-${String(todayParts.m).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}T00:00:00.000+05:30`)
        : toStartOfDay(now);

    const prepared = (grns || []).map((g) => {
        const gObj = g.toObject ? g.toObject() : { ...g };
        const resolved = resolveGrnPayable(gObj, poDoc, supplierTerms);

        return {
            ...gObj,
            paymentTermsDays: resolved.termsDays,
            isDefaultPaymentTerms: resolved.isDefaultPaymentTerms,
            paymentTermsLabel: resolved.paymentTermsLabel,
            dueDate: resolved.dueDate,
            payableAmount: resolved.payableAmount,
            isSnapshot: resolved.isSnapshot,
            isUnknownPayable: resolved.isUnknownPayable
        };
    });

    // Sort oldest due date first for FIFO payment allocation
    prepared.sort((a, b) => {
        const da = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return new Date(a.receivedDate || a.createdAt || 0).getTime() - new Date(b.receivedDate || b.createdAt || 0).getTime();
    });

    let remainingPaid = Math.max(0, Number(poDoc?.paidAmount || 0));
    let totalReceivedValue = 0;
    let totalPaidAllocated = 0;
    let totalBalance = 0;

    const grnRows = prepared.map((g) => {
        const amt = Math.max(0, Number(g.payableAmount || 0));
        const paidForGrn = Math.min(amt, Math.round(remainingPaid * 100) / 100);
        remainingPaid = Math.max(0, Math.round((remainingPaid - paidForGrn) * 100) / 100);
        const balance = Math.max(0, Math.round((amt - paidForGrn) * 100) / 100);

        const dueParts = g.dueDate ? getIstCalendarParts(g.dueDate) : null;
        const dueStart = dueParts
            ? new Date(`${dueParts.y}-${String(dueParts.m).padStart(2, '0')}-${String(dueParts.day).padStart(2, '0')}T00:00:00.000+05:30`)
            : null;

        let isOverdue = false;
        let daysOverdue = 0;
        if (!g.isUnknownPayable && amt > 0 && balance > 0.01 && dueStart && todayStart && dueStart.getTime() < todayStart.getTime()) {
            isOverdue = true;
            daysOverdue = Math.max(1, Math.floor((todayStart.getTime() - dueStart.getTime()) / (1000 * 60 * 60 * 24)));
        }

        let paymentStatus = 'UNPAID';
        if (g.isUnknownPayable || amt <= 0) {
            paymentStatus = 'CHECK_DATA';
        } else if (amt > 0 && balance <= 0.01) {
            paymentStatus = 'PAID';
        } else if (isOverdue) {
            paymentStatus = 'OVERDUE';
        } else if (paidForGrn > 0.01) {
            paymentStatus = 'PARTIAL';
        }

        totalReceivedValue += amt;
        totalPaidAllocated += paidForGrn;
        totalBalance += balance;

        return {
            ...g,
            paidAmount: paidForGrn,
            balanceAmount: balance,
            isOverdue,
            daysOverdue,
            paymentStatus
        };
    });

    const hasUnknownPayable = grnRows.some((g) => g.paymentStatus === 'CHECK_DATA');

    return {
        grnRows,
        hasUnknownPayable,
        totalReceivedValue: Math.round(totalReceivedValue * 100) / 100,
        totalPaidAllocated: Math.round(totalPaidAllocated * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100
    };
};

module.exports = {
    GRN_RECEIVED_DATE_COUNTS_AS_DAY_ONE,
    DEFAULT_PAYMENT_TERMS_DAYS,
    parseDateValue,
    parsePaymentTermsDays,
    resolveSupplierPaymentTerms,
    resolveEffectiveDueDate,
    computeOverdueInfo,
    computePoPayableValues,
    computeGrnDueDate,
    computeGrnPayableAmount,
    resolveGrnPayable,
    allocatePaymentsToGrns
};
