/**
 * Generic Enum Normalizer Utility
 * Converts strings to UPPERCASE with underscores and maps common synonyms.
 */
const normalizeEnum = (val, defaultValue = '') => {
    if (!val || typeof val !== 'string') return defaultValue;
    const clean = val.trim().toUpperCase().replace(/[\s-]+/g, '_');

    // Synonym Mappings for Interaction Types
    if (['PHONE_CALL', 'PHONE', 'CALL'].includes(clean)) return 'CALL';
    if (['EMAIL', 'MAIL'].includes(clean)) return 'EMAIL';
    if (['VISIT', 'SITE_VISIT', 'IN_PERSON_VISIT'].includes(clean)) return 'VISIT';
    if (['FOLLOW_UP', 'FOLLOWUP'].includes(clean)) return 'FOLLOW_UP';

    // Synonym Mappings for Complaint Types
    if (['QUALITY_DEFECT', 'QUALITY_ISSUE', 'QUALITY'].includes(clean)) return 'QUALITY_DEFECT';
    if (['DELIVERY_DELAY', 'LATE_DELIVERY', 'DELIVERY'].includes(clean)) return 'DELIVERY_DELAY';
    if (['QUANTITY_MISMATCH', 'QUANTITY_SHORTAGE', 'QUANTITY'].includes(clean)) return 'QUANTITY_MISMATCH';
    if (['PRICE_DISCREPANCY', 'BILLING_DISCREPANCY', 'PRICE'].includes(clean)) return 'PRICE_DISCREPANCY';
    if (['PACKAGING_DAMAGE', 'DAMAGED_GOODS', 'PACKAGING'].includes(clean)) return 'PACKAGING_DAMAGE';

    return clean;
};

module.exports = {
    normalizeEnum
};
