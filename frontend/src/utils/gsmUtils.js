/**
 * PolySack ERP - GSM Utility Functions
 * Ensures consistent "GSM" label, parsing and display across Finished Goods and Raw Materials.
 */

/**
 * Format any GSM, GMS or Grams value into standard "X GSM" display string.
 * Examples:
 *   45 -> "45 GSM"
 *   "45" -> "45 GSM"
 *   "4 Grams" -> "4 GSM"
 *   "2.5 Grams" -> "2.5 GSM"
 *   "4 Gms" -> "4 GSM"
 *   "45 GMS" -> "45 GSM"
 *   "45 GSM" -> "45 GSM"
 *   null/undefined/'' -> fallback (default '-')
 */
export const formatGsmDisplay = (val, fallback = '-') => {
    if (val === null || val === undefined || val === '') return fallback;
    const str = String(val).trim();
    if (!str || str === '-') return fallback;

    // Check if it's already purely numeric
    if (!isNaN(Number(str))) {
        return `${Number(str)} GSM`;
    }

    // Replace "Grams", "Gram", "Gms", "Gm", "GMS" with "GSM"
    if (/\b(?:Grams?|Gms?|GMS|GSM)\b/i.test(str)) {
        return str.replace(/\b(?:Grams?|Gms?|GMS|GSM)\b/gi, 'GSM').replace(/\s+/g, ' ').trim();
    }

    // Extract any number from string if it exists
    const match = str.match(/(\d+(?:\.\d+)?)/);
    if (match) {
        return `${match[1]} GSM`;
    }

    return `${str} GSM`;
};

/**
 * Extracts a numeric GSM value from a record, looking at fabricGSM, gsm, fabricGsm,
 * fabricGrammage, or parsing from the item's name/title (supporting both GSM and GMS).
 */
export const extractGsmValue = (record) => {
    if (!record) return null;

    const direct = record.fabricGSM ?? record.gsm ?? record.fabricGsm;
    if (direct !== undefined && direct !== null && direct !== '' && !isNaN(Number(direct))) {
        return Number(direct);
    }

    if (record.fabricGrammage) {
        const num = Number(String(record.fabricGrammage).replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) return num;
    }

    if (typeof record.name === 'string') {
        const match = record.name.match(/(\d+(?:\.\d+)?)\s*(?:GSM|GMS)/i);
        if (match) return Number(match[1]);
    }

    return null;
};
