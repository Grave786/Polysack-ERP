/**
 * Pre-seeded standard attribute options for Raw Material master data.
 * Used for tenant seeding and default attribute options.
 */

const RAW_MATERIAL_ATTRIBUTE_TYPES = [
    'materialDescription',
    'materialQualityFabric',
    'materialQualityBags',
    'laminationType',
    'fabricGrammage',
    'materialColour',
    'qualityThreadYarn',
    'threadColour',
    'fabricSize'
];

const RAW_MATERIAL_ATTRIBUTE_LABELS = {
    materialDescription: 'Material Description',
    materialQualityFabric: 'Material Quality-Fabric',
    materialQualityBags: 'Material Quality-Bags',
    laminationType: 'Material Quality-Fabric (Lamination Type)',
    fabricGrammage: 'Fabric Grammage',
    materialColour: 'Material Colour',
    qualityThreadYarn: 'Quality-Thread-Yarn',
    threadColour: 'Thread Colour',
    fabricSize: 'Fabric Size (Fabric Width)'
};

const DEFAULT_RAW_MATERIAL_ATTRIBUTES = {
    materialDescription: [
        'PP Woven Fabric Roll',
        'PP Woven Bags',
        'Ink',
        'NBA',
        'Thread',
        'Liner',
        'Narrow Fabrics (Niwar)',
        'Machine',
        'Machine Spare Parts'
    ],
    materialQualityFabric: [
        'Natural',
        'Silver tone',
        'Pearl',
        'Janta',
        'Silver',
        'Gold',
        'Paper bags',
        'Not applicable'
    ],
    materialQualityBags: [
        'Natural',
        'Silver tone',
        'Pearl',
        'Janta',
        'Silver',
        'Gold',
        'Paper bags',
        'Not applicable'
    ],
    laminationType: [
        'Lam',
        'Unlam',
        'BOPP LAM',
        'Pure Lam'
    ],
    fabricGrammage: [
        '2.5 Grams',
        '3 Grams',
        '3.5 Grams',
        '4 Grams',
        '4.5 Grams',
        '5 Grams',
        'Not Applicable'
    ],
    materialColour: [
        'Red',
        'Blue',
        'Green',
        'Orange',
        'Yellow',
        'Black',
        'Purple',
        'Pale Yellow (Golden)',
        'Milky White',
        'Transparent (Natural)',
        'Not Applicable'
    ],
    qualityThreadYarn: [
        'Roto-PP',
        'Shivalik-Twisted',
        'Multi Filament',
        'Not applicable'
    ],
    threadColour: [
        'Red',
        'Blue',
        'Green',
        'Orange',
        'Yellow',
        'Black',
        'Purple',
        'Pale Yellow (Golden)',
        'Milky White',
        'Transparent (Natural)',
        'Not Applicable'
    ],
    fabricSize: [
        '12 Inch',
        '15 Inch',
        '17 Inch',
        '19 Inch',
        '20 Inch',
        '22 Inch',
        '24 Inch',
        '26 Inch',
        '28 Inch',
        '30 Inch',
        '32 Inch',
        'Not Applicable'
    ]
};

module.exports = {
    RAW_MATERIAL_ATTRIBUTE_TYPES,
    RAW_MATERIAL_ATTRIBUTE_LABELS,
    DEFAULT_RAW_MATERIAL_ATTRIBUTES
};
