/**
 * Single source of truth for Sales Order status workflow & transition validation (Backend).
 */

const SO_STATUS_TRANSITIONS = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['DRAFT', 'READY_FOR_DISPATCH', 'CANCELLED'],
    READY_FOR_DISPATCH: ['DISPATCHED', 'CANCELLED'],
    PARTIALLY_DISPATCHED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['DELIVERED'],
    FULLY_DISPATCHED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: []
};

const SO_FINAL_STATUSES = ['DELIVERED', 'CANCELLED'];
const SO_DISPATCHED_STATUSES = ['DISPATCHED', 'FULLY_DISPATCHED', 'DELIVERED'];

/**
 * Validate a requested Sales Order status transition.
 */
const validateSoStatusTransition = ({
    currentStatus,
    targetStatus,
    remark = '',
    hasLinkedWo = false,
    hasDispatch = false,
    hasInvoice = false
}) => {
    const curr = String(currentStatus || 'DRAFT').trim().toUpperCase();
    const next = String(targetStatus || '').trim().toUpperCase();

    if (!next) {
        return { valid: false, error: 'Target status is required.' };
    }
    if (curr === next) {
        return { valid: true, unchanged: true };
    }
    if (SO_FINAL_STATUSES.includes(curr)) {
        return {
            valid: false,
            error: `Sales Order is '${curr}' and cannot transition to '${next}'.`
        };
    }

    const allowedNext = SO_STATUS_TRANSITIONS[curr] || [];
    if (!allowedNext.includes(next)) {
        const allowedLabel = allowedNext.length > 0 ? allowedNext.join(', ') : 'none';
        return {
            valid: false,
            error: `Invalid status transition from '${curr}' to '${next}'. Allowed next statuses: ${allowedLabel}.`
        };
    }

    if (curr === 'CONFIRMED' && next === 'DRAFT' && (hasLinkedWo || hasDispatch || hasInvoice)) {
        return {
            valid: false,
            error: 'Cannot revert a Confirmed Sales Order back to DRAFT once Work Orders, Dispatches, or Invoices exist.'
        };
    }

    if (next === 'DISPATCHED' && !String(remark || '').trim()) {
        return {
            valid: false,
            error: 'A remark is required when manually marking a Sales Order as Dispatched.'
        };
    }

    if (next === 'CANCELLED' && !String(remark || '').trim()) {
        return {
            valid: false,
            error: 'A cancellation reason is required to cancel a Sales Order.'
        };
    }

    return { valid: true, unchanged: false };
};

module.exports = {
    SO_STATUS_TRANSITIONS,
    SO_FINAL_STATUSES,
    SO_DISPATCHED_STATUSES,
    validateSoStatusTransition
};
