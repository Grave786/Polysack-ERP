/**
 * Shared Finished Bag Weight & Unit Conversion Helper (Frontend)
 * Mirrors Backend/src/utils/bagWeightHelper.js so Sales Order, Work Order, and Dispatch
 * display identical conversions.
 * Priority: (a) Finished Good BOM (Kg/g materials), (b) Saved bag weight, (c) Size x GSM estimate.
 * Never uses bagCapacity (fill capacity) for bag weight.
 */

export const DEFAULT_ALLOWANCE_PCT = 0;

const ALL_SO_UNITS = ['Pcs', 'Kg', 'Roll', 'Bags'];

export const normalizeSoUnit = (unitStr) => {
    if (!unitStr) return 'Pcs';
    const lower = String(unitStr).trim().toLowerCase();
    if (['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'].includes(lower)) return 'Kg';
    if (['roll', 'rolls', 'rl'].includes(lower)) return 'Roll';
    if (['bags', 'bag'].includes(lower)) return 'Bags';
    if (['pcs', 'pc', 'pieces', 'piece', 'nos', 'no', 'units', 'unit'].includes(lower)) return 'Pcs';
    return ALL_SO_UNITS.includes(unitStr) ? unitStr : 'Pcs';
};

export const mapFgUomToOption = (selectedFg) => {
    if (!selectedFg) return 'Pcs';
    const fgUom = (selectedFg.uom && typeof selectedFg.uom === 'object' && (selectedFg.uom.symbol || selectedFg.uom.name || selectedFg.uom.abbreviation))
        ? (selectedFg.uom.symbol || selectedFg.uom.name || selectedFg.uom.abbreviation)
        : (typeof selectedFg.uom === 'string' && !/^[0-9a-fA-F]{24}$/.test(selectedFg.uom) ? selectedFg.uom : (selectedFg.unit || 'Pcs'));
    return normalizeSoUnit(fgUom);
};

const toMeters = (val, unit = 'cm') => {
    const n = Number(val || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const u = String(unit || 'cm').trim().toLowerCase();
    if (u === 'inch' || u === 'inches' || u === 'in') return n * 0.0254;
    if (u === 'm' || u === 'meter' || u === 'meters') return n;
    return n * 0.01;
};

const computeBomWeightKg = (bomDoc, fg = null) => {
    const mats =
        (bomDoc && Array.isArray(bomDoc.items) && bomDoc.items.length > 0 ? bomDoc.items : null) ||
        (bomDoc && Array.isArray(bomDoc.materials) && bomDoc.materials.length > 0 ? bomDoc.materials : null) ||
        (bomDoc && Array.isArray(bomDoc.rawMaterials) && bomDoc.rawMaterials.length > 0 ? bomDoc.rawMaterials : null) ||
        (fg && Array.isArray(fg.materialRequirements) && fg.materialRequirements.length > 0 ? fg.materialRequirements : null) ||
        (fg && Array.isArray(fg.bomItems) && fg.bomItems.length > 0 ? fg.bomItems : null);

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
    }

    return hasWeightItem && totalKg > 0 ? totalKg : null;
};

/**
 * Resolve physical empty bag weight in grams + source + sanity guard metadata.
 */
export const resolveBagWeightSpec = (fg, options = {}) => {
    if (!fg || typeof fg !== 'object') {
        return { weightGrams: null, weightKg: null, isUnrealistic: false, warning: null, source: null };
    }

    const allowancePct = Number.isFinite(Number(options.allowancePct))
        ? Number(options.allowancePct)
        : DEFAULT_ALLOWANCE_PCT;

    let weightGrams = null;
    let source = null;

    // 1. (a) Finished Good BOM (single source of truth)
    const bomKg = computeBomWeightKg(options.bom || fg.bom || fg.activeBom || null, fg);
    if (bomKg !== null && bomKg > 0) {
        weightGrams = Number((bomKg * 1000).toFixed(2));
        source = 'BOM';
    }

    // 2. (b) Saved finished good weight
    if (weightGrams === null) {
        const savedWeight = Number(
            fg.bagWeightGms ||
            fg.tareWeightGram ||
            fg.weightPerBagGrams ||
            fg.avgBagWeightGms ||
            0
        );
        if (Number.isFinite(savedWeight) && savedWeight > 0) {
            weightGrams = Number(savedWeight.toFixed(2));
            source = 'Saved';
        }
    }

    // 3. (c) Computed estimate from dimensions and fabric GSM
    if (weightGrams === null) {
        const gsm = Number(fg.fabricGSM || fg.gsm || fg.fabricGsm || 0);
        const rawW = Number(fg.dimensions?.width || 0);
        const rawL = Number(fg.dimensions?.length || 0);
        const dimUnit = fg.dimensionUnit || fg.dimensions?.unit || 'cm';

        if (gsm > 0 && rawW > 0 && rawL > 0) {
            const widthM = toMeters(rawW, dimUnit);
            const lengthM = toMeters(rawL, dimUnit);
            if (widthM > 0 && lengthM > 0) {
                const areaBothPanelsM2 = 2 * widthM * lengthM;
                const baseFabricGrams = areaBothPanelsM2 * gsm;
                const withAllowanceGrams = baseFabricGrams * (1 + allowancePct);
                const linerWeightGms = Number(fg.linerWeightGms || fg.laminationWeightGms || 0);
                const laminationGsm = Number(fg.laminationGSM || 0);
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

export const resolveEmptyBagWeightGms = (fg, options = {}) => {
    return resolveBagWeightSpec(fg, options).weightGrams;
};

/**
 * Evaluate live unit conversion feedback under a Sales Order line item.
 */
export const getUnitConversionFeedback = (selectedFg, lineUnit, lineQuantity) => {
    if (!selectedFg) return null;
    const fgUom = mapFgUomToOption(selectedFg);
    const selectedUnit = normalizeSoUnit(lineUnit);

    const isCount = (u) => ['Pcs', 'Bags'].includes(u);
    const isWeight = (u) => u === 'Kg';

    if (selectedUnit === 'Roll') {
        if (fgUom !== 'Roll') {
            return {
                type: 'warning',
                message: 'No conversion for this product, dispatch must be in this same unit'
            };
        }
        return null;
    }

    const qty = Number(lineQuantity) || 0;
    const spec = resolveBagWeightSpec(selectedFg);
    const bagWeightGms = spec.weightGrams;

    if (isCount(selectedUnit)) {
        if (!bagWeightGms || bagWeightGms <= 0) {
            return {
                type: 'muted',
                message: 'Weight not available for this product'
            };
        }
        const approxKg = qty > 0 ? Number(((qty * bagWeightGms) / 1000).toFixed(2)) : null;
        const displayGms = Number.isInteger(bagWeightGms) ? bagWeightGms : Number(bagWeightGms.toFixed(1));
        return {
            type: spec.isUnrealistic ? 'warning' : 'hint',
            message: approxKg !== null
                ? `approx. ${approxKg.toLocaleString('en-IN')} Kg (${displayGms} g per bag)`
                : `${displayGms} g per bag`,
            warning: spec.warning
        };
    }

    if (isWeight(selectedUnit)) {
        if (!bagWeightGms || bagWeightGms <= 0) {
            return {
                type: 'warning',
                message: 'Weight not available for this product'
            };
        }
        const approxCount = qty > 0 ? Math.round((qty * 1000) / bagWeightGms) : null;
        const targetLabel = isCount(fgUom) ? fgUom : 'Pcs';
        const displayGms = Number.isInteger(bagWeightGms) ? bagWeightGms : Number(bagWeightGms.toFixed(1));
        return {
            type: spec.isUnrealistic ? 'warning' : 'hint',
            message: approxCount !== null
                ? `approx. ${approxCount.toLocaleString('en-IN')} ${targetLabel} (${displayGms} g per bag)`
                : `${displayGms} g per bag`,
            warning: spec.warning
        };
    }

    return null;
};
