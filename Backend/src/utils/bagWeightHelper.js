/**
 * Shared Finished Bag Weight & Unit Conversion Helper (Backend)
 * Single source of truth for empty bag weight in grams/kg across SO, WO, and Dispatch.
 * Never uses bagCapacity (fill capacity) for physical bag weight.
 */

const DEFAULT_ALLOWANCE_PCT = 0.05; // 5% stitching & margin allowance

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
 * Resolve physical empty bag weight in grams + sanity guard metadata.
 *
 * @param {Object} fgDoc - FinishedGood document
 * @param {Object|null} bomDoc - Optional BOM document fallback
 * @param {Object} options - { allowancePct?: number }
 * @returns {{ weightGrams: number|null, weightKg: number|null, isUnrealistic: boolean, warning: string|null, source: string|null }}
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

    // 1. Saved finished good weight (bagWeightGms, tareWeightGram, weightPerBagGrams, avgBagWeightGms)
    const savedWeight = Number(
        fgDoc.bagWeightGms ||
        fgDoc.tareWeightGram ||
        fgDoc.weightPerBagGrams ||
        fgDoc.avgBagWeightGms ||
        0
    );
    if (Number.isFinite(savedWeight) && savedWeight > 0) {
        weightGrams = Number(savedWeight.toFixed(2));
        source = 'saved';
    }

    // 2. Computed from dimensions (m) and fabric GSM:
    //    2 * width(m) * length(m) * fabricGSM * (1 + allowancePct) + liner/lamination weight
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
                    source = 'spec';
                }
            }
        }
    }

    // 3. BOM fallback if provided
    if (weightGrams === null && bomDoc && Array.isArray(bomDoc.materials || bomDoc.rawMaterials || bomDoc.items)) {
        const mats = bomDoc.materials || bomDoc.rawMaterials || bomDoc.items;
        let totalBomWeight = 0;
        for (const m of mats) {
            totalBomWeight += Number(m.quantity || m.quantityPerUnit || 0);
        }
        if (totalBomWeight >= 0.005 && totalBomWeight <= 2.0) {
            weightGrams = Number((totalBomWeight * 1000).toFixed(2));
            source = 'bom';
        } else if (totalBomWeight >= 5 && totalBomWeight <= 2000) {
            weightGrams = Number(totalBomWeight.toFixed(2));
            source = 'bom';
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
        warning: isUnrealistic ? 'Please check the bag size, GSM or weight in Master Data' : null,
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
