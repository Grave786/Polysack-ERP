/**
 * Configurable tax rule for charges (mirrors Backend/src/utils/gstHelper.js).
 * When true (default), Freight, Insurance, and Other Charges are added to taxableValue
 * and taxed at the same GST rate as the goods.
 */
export const TAX_CHARGES_WITH_GOODS = true;

export const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

/**
 * Compute full Charges, Discount, Taxable Value, Tax, Round-off, Grand Total, and validation error.
 */
export const computeDocumentTotals = ({
    itemsSubtotal = 0,
    discountType = 'FIXED',
    discountValue = 0,
    freightAmount = 0,
    insuranceAmount = 0,
    otherChargesAmount = 0,
    otherChargesLabel = '',
    gstTreatment = 'TAXABLE',
    gstRate = 18,
    autoRoundOff = true
} = {}) => {
    const cleanSubtotal = Math.max(0, round2(itemsSubtotal));
    const normDiscountType = String(discountType || 'FIXED').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FIXED';
    const rawDiscountVal = Number(discountValue || 0);
    const freight = Number(freightAmount || 0);
    const insurance = Number(insuranceAmount || 0);
    const otherCharges = Number(otherChargesAmount || 0);

    let validationError = '';
    if (rawDiscountVal < 0) validationError = 'Discount cannot be negative.';
    else if (normDiscountType === 'PERCENT' && rawDiscountVal > 100) validationError = 'Discount percentage cannot exceed 100%.';
    else if (freight < 0) validationError = 'Freight charges cannot be negative.';
    else if (insurance < 0) validationError = 'Insurance charges cannot be negative.';
    else if (otherCharges < 0) validationError = 'Other charges cannot be negative.';

    const discountAmount = normDiscountType === 'PERCENT'
        ? round2((cleanSubtotal * Math.max(0, rawDiscountVal)) / 100)
        : round2(Math.max(0, rawDiscountVal));

    if (!validationError && discountAmount > cleanSubtotal + 0.001) {
        validationError = 'Discount amount cannot exceed items subtotal.';
    }

    const isExempt = String(gstTreatment || 'TAXABLE').toUpperCase() === 'EXEMPT';
    const effectiveGstRate = isExempt ? 0 : Math.max(0, Number(gstRate ?? 18));

    const netGoods = Math.max(0, round2(cleanSubtotal - discountAmount));
    const totalCharges = round2(Math.max(0, freight) + Math.max(0, insurance) + Math.max(0, otherCharges));
    const taxableValue = TAX_CHARGES_WITH_GOODS
        ? round2(netGoods + totalCharges)
        : netGoods;

    const taxAmount = isExempt ? 0 : round2((taxableValue * effectiveGstRate) / 100);
    const preRoundTotal = TAX_CHARGES_WITH_GOODS
        ? round2(taxableValue + taxAmount)
        : round2(taxableValue + taxAmount + totalCharges);

    const useAutoRoundOff = autoRoundOff !== false;
    const grandTotal = useAutoRoundOff ? Math.round(preRoundTotal) : preRoundTotal;
    const roundOff = useAutoRoundOff ? round2(grandTotal - preRoundTotal) : 0;

    return {
        itemsSubtotal: cleanSubtotal,
        discountType: normDiscountType,
        discountValue: round2(rawDiscountVal),
        discountAmount,
        freightAmount: round2(freight),
        insuranceAmount: round2(insurance),
        otherChargesAmount: round2(otherCharges),
        otherChargesLabel: String(otherChargesLabel || '').trim(),
        taxableValue,
        gstTreatment: isExempt ? 'EXEMPT' : 'TAXABLE',
        gstRate: effectiveGstRate,
        taxAmount,
        gstAmount: taxAmount,
        autoRoundOff: useAutoRoundOff,
        roundOff,
        grandTotal,
        validationError
    };
};
