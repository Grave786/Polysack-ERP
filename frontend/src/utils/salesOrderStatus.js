/**
 * Shared Sales Order status workflow & labels (Frontend).
 * Mirrors Backend/src/utils/salesOrderStatus.js.
 */

export const SO_STATUS_TRANSITIONS = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['DRAFT', 'READY_FOR_DISPATCH', 'CANCELLED'],
    READY_FOR_DISPATCH: ['DISPATCHED', 'CANCELLED'],
    PARTIALLY_DISPATCHED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['DELIVERED'],
    FULLY_DISPATCHED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: []
};

export const SO_STATUS_LABELS = {
    DRAFT: 'DRAFT (Quotation / Proposal)',
    CONFIRMED: 'CONFIRMED (Ready for Production)',
    READY_FOR_DISPATCH: 'READY FOR DISPATCH',
    PARTIALLY_DISPATCHED: 'PARTIALLY DISPATCHED',
    DISPATCHED: 'DISPATCHED',
    FULLY_DISPATCHED: 'FULLY DISPATCHED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED'
};

/**
 * Returns the list of allowed statuses (current + valid next transitions) for a given Sales Order.
 */
export const getAllowedSoStatuses = (currentStatus, { hasLinkedWo = false, hasDispatch = false, hasInvoice = false } = {}) => {
    const curr = String(currentStatus || 'DRAFT').trim().toUpperCase();
    const nextList = SO_STATUS_TRANSITIONS[curr] || [];
    const filteredNext = nextList.filter((target) => {
        if (curr === 'CONFIRMED' && target === 'DRAFT' && (hasLinkedWo || hasDispatch || hasInvoice)) {
            return false;
        }
        return true;
    });
    return [curr, ...filteredNext];
};
