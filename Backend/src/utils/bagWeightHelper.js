/**
 * Shared Finished Bag Weight & Unit Conversion Helper (Backend)
 * Single source of truth for empty bag weight in grams/kg across SO, WO, and Dispatch.
 * Priority: (a) Finished Good BOM (Kg/g materials), (b) Saved bag weight, (c) Size x GSM estimate.
 * Never uses bagCapacity (fill capacity) for physical bag weight.
 */

const DEFAULT_ALLOWANCE_PCT = 0;

/**
 * Convert dimension value to meters.
 */
const toMeters = (val, unit = 'cm') => {
    const n = Number(val || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const u = String(unit || 'cm').trim().toLowerCase();
    if (u === 'inch' || u === 'inches' || u === 'in') return n * 0.0254;
    if (u === 'm' || u === 'meter' || u === 'meters') return n;
    return n * 0.01; // default cm
};

/**
 * Sum per-bag BOM material quantities in Kg (converts g -> Kg; ignores non-weight units like Mtr, Gaze, Pcs).
 */
const computeBomWeightKg = (bomDoc, fgDoc = null) => {
    const mats =
        (bomDoc && Array.isArray(bomDoc.items) && bomDoc.items.length > 0 ? bomDoc.items : null) ||
        (bomDoc && Array.isArray(bomDoc.materials) && bomDoc.materials.length > 0 ? bomDoc.materials : null) ||
        (bomDoc && Array.isArray(bomDoc.rawMaterials) && bomDoc.rawMaterials.length > 0 ? bomDoc.rawMaterials : null) ||
        (fgDoc && Array.isArray(fgDoc.materialRequirements) && fgDoc.materialRequirements.length > 0 ? fgDoc.materialRequirements : null) ||
        (fgDoc && Array.isArray(fgDoc.bomItems) && fgDoc.bomItems.length > 0 ? fgDoc.bomItems : null);

    if (!mats || mats.length === 0) return null;

    let totalKg = 0;
    let hasWeightItem = false;

    for (const m of mats) {
        const qty = Number(m?.quantityPerUnit ?? m?.quantity ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const rm = m?.rawMaterial && typeof m.rawMaterial === 'object' ? m.rawMaterial : null;
        const rawUnit =
            (rm?.uom && typeof rm.uom === 'object' ? (rm.uom.symbol || rm.uom.abbreviation || rm.uom.name) : rm?.uom) ||
            m?.unit ||
            m?.uom ||
            'kg';

        const u = String(rawUnit || 'kg').trim().toLowerCase();
        if (['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(u)) {
            totalKg += qty;
            hasWeightItem = true;
        } else if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) {
            totalKg += qty / 1000;
            hasWeightItem = true;
        }
        // Ignore non-weight units (Mtr, Gaze, Pcs, Roll, etc.)
    }

    return hasWeightItem && totalKg > 0 ? totalKg : null;
};

/**
 * Resolve physical empty bag weight in grams + source + sanity guard metadata.
 *
 * @param {Object} fgDoc - FinishedGood document
 * @param {Object|null} bomDoc - Optional BOM document
 * @param {Object} options - { allowancePct?: number }
 * @returns {{ weightGrams: number|null, weightKg: number|null, isUnrealistic: boolean, warning: string|null, source: 'BOM'|'Saved'|'Estimated'|null }}
 */
const resolveBagWeightSpec = (fgDoc, bomDoc = null, options = {}) => {
    if (!fgDoc || typeof fgDoc !== 'object') {
        return { weightGrams: null, weightKg: null, isUnrealistic: false, warning: null, source: null };
    }

    const allowancePct = Number.isFinite(Number(options.allowancePct))
        ? Number(options.allowancePct)
        : DEFAULT_ALLOWANCE_PCT;

    let weightGrams = null;
    let source = null;

    // 1. (a) Finished Good BOM (single source of truth)
    const bomKg = computeBomWeightKg(bomDoc, fgDoc);
    if (bomKg !== null && bomKg > 0) {
        weightGrams = Number((bomKg * 1000).toFixed(2));
        source = 'BOM';
    }

    // 2. (b) Saved finished good weight (bagWeightGms, tareWeightGram, weightPerBagGrams, avgBagWeightGms)
    if (weightGrams === null) {
        const savedWeight = Number(
            fgDoc.bagWeightGms ||
            fgDoc.tareWeightGram ||
            fgDoc.weightPerBagGrams ||
            fgDoc.avgBagWeightGms ||
            0
        );
        if (Number.isFinite(savedWeight) && savedWeight > 0) {
            weightGrams = Number(savedWeight.toFixed(2));
            source = 'Saved';
        }
    }

    // 3. (c) Computed estimate from dimensions (m) and fabric GSM
    if (weightGrams === null) {
        const gsm = Number(fgDoc.fabricGSM || fgDoc.gsm || fgDoc.fabricGsm || 0);
        const rawW = Number(fgDoc.dimensions?.width || 0);
        const rawL = Number(fgDoc.dimensions?.length || 0);
        const dimUnit = fgDoc.dimensionUnit || fgDoc.dimensions?.unit || 'cm';

        if (gsm > 0 && rawW > 0 && rawL > 0) {
            const widthM = toMeters(rawW, dimUnit);
            const lengthM = toMeters(rawL, dimUnit);
            if (widthM > 0 && lengthM > 0) {
                const areaBothPanelsM2 = 2 * widthM * lengthM;
                const baseFabricGrams = areaBothPanelsM2 * gsm;
                const withAllowanceGrams = baseFabricGrams * (1 + allowancePct);
                const linerWeightGms = Number(fgDoc.linerWeightGms || fgDoc.laminationWeightGms || 0);
                const laminationGsm = Number(fgDoc.laminationGSM || 0);
                const extraLaminationGrams = laminationGsm > 0 ? areaBothPanelsM2 * laminationGsm : 0;

                const totalGrams = Number((withAllowanceGrams + linerWeightGms + extraLaminationGrams).toFixed(2));
                if (totalGrams > 0) {
                    weightGrams = totalGrams;
                    source = 'Estimated';
                }
            }
        }
    }

    if (weightGrams === null || weightGrams <= 0) {
        return { weightGrams: null, weightKg: null, isUnrealistic: false, warning: null, source: null };
    }

    const isUnrealistic = weightGrams < 5 || weightGrams > 2000;
    return {
        weightGrams,
        weightKg: Number((weightGrams / 1000).toFixed(6)),
        isUnrealistic,
        warning: isUnrealistic ? 'Please check the BOM or bag weight in Master Data' : null,
        source
    };
};

/**
 * Convenience wrapper returning empty bag weight in grams (or null).
 */
const resolveEmptyBagWeightGms = (fgDoc, bomDoc = null, options = {}) => {
    return resolveBagWeightSpec(fgDoc, bomDoc, options).weightGrams;
};

/**
 * Convenience wrapper returning empty bag weight in Kg (or null).
 */
const getAvgBagWeightKg = (fgDoc, bomDoc = null, options = {}) => {
    return resolveBagWeightSpec(fgDoc, bomDoc, options).weightKg;
};

module.exports = {
    DEFAULT_ALLOWANCE_PCT,
    resolveBagWeightSpec,
    resolveEmptyBagWeightGms,
    getAvgBagWeightKg
};
