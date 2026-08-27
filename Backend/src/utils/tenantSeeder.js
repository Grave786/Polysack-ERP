const UOM = require('../models/uom.model');
const Location = require('../models/location.model');
const Shift = require('../models/shift.model');
const Category = require('../models/category.model');
const BagShape = require('../models/bagShape.model');

/**
 * Seed default master data for a newly onboarded tenant.
 * Ensures UOMs, Locations, Shifts, and Categories are populated immediately.
 * 
 * @param {ObjectId|string} tenantId - The newly created tenant's ObjectId
 */
const seedTenantMasterData = async (tenantId) => {
    try {
        if (!tenantId) return;

        // 1. Seed Standard Default UOMs
        const defaultUOMs = [
            { name: 'Kilogram', symbol: 'KG', type: 'WEIGHT', precision: 2, isActive: true },
            { name: 'Pieces', symbol: 'PCS', type: 'COUNT', precision: 0, isActive: true },
            { name: 'Bags', symbol: 'BAG', type: 'COUNT', precision: 0, isActive: true },
            { name: 'Meters', symbol: 'MTR', type: 'LENGTH', precision: 2, isActive: true },
            { name: 'Rolls', symbol: 'ROLL', type: 'COUNT', precision: 0, isActive: true },
            { name: 'Metric Tonnes', symbol: 'MT', type: 'WEIGHT', precision: 3, isActive: true }
        ];

        for (const uomData of defaultUOMs) {
            await UOM.updateOne(
                { tenant: tenantId, symbol: uomData.symbol },
                { $setOnInsert: { ...uomData, tenant: tenantId } },
                { upsert: true }
            );
        }

        // 2. Seed Standard Default Locations
        const defaultLocations = [
            { name: 'Main Plant Warehouse', code: 'WH-MAIN', type: 'WAREHOUSE', city: 'Surat', state: 'Gujarat', isActive: true },
            { name: 'Raw Material Storage', code: 'RM-STORE', type: 'WAREHOUSE', city: 'Surat', state: 'Gujarat', isActive: true },
            { name: 'Extrusion Floor #1', code: 'PROD-EXT-01', type: 'PRODUCTION_FLOOR', city: 'Surat', state: 'Gujarat', isActive: true },
            { name: 'Finished Goods Yard', code: 'FG-STORE', type: 'GODOWN', city: 'Surat', state: 'Gujarat', isActive: true }
        ];

        for (const locData of defaultLocations) {
            await Location.updateOne(
                { tenant: tenantId, code: locData.code },
                { $setOnInsert: { ...locData, tenant: tenantId } },
                { upsert: true }
            );
        }

        // 3. Seed Standard Default Shifts
        const defaultShifts = [
            { name: 'Shift A (Morning)', shiftCode: 'SHIFT-A', startTime: '06:00', endTime: '14:00', standardHours: 8, gracePeriodMinutes: 15, isActive: true },
            { name: 'Shift B (Evening)', shiftCode: 'SHIFT-B', startTime: '14:00', endTime: '22:00', standardHours: 8, gracePeriodMinutes: 15, isActive: true },
            { name: 'Night Shift', shiftCode: 'SHIFT-N', startTime: '22:00', endTime: '06:00', standardHours: 8, gracePeriodMinutes: 15, isActive: true }
        ];

        for (const shiftData of defaultShifts) {
            await Shift.updateOne(
                { tenant: tenantId, shiftCode: shiftData.shiftCode },
                { $setOnInsert: { ...shiftData, tenant: tenantId } },
                { upsert: true }
            );
        }

        // 4. Seed Standard Default Categories
        const defaultCategories = [
            { name: 'PP Granules & Resin', type: 'RAW_MATERIAL', description: 'Polypropylene Homopolymer & Copolymer Resins', isActive: true },
            { name: 'Masterbatch & Pigments', type: 'RAW_MATERIAL', description: 'Color masterbatch, UV, and additive concentrates', isActive: true },
            { name: 'Calcium Filler Masterbatch', type: 'RAW_MATERIAL', description: 'CaCO3 compounding filler masterbatch', isActive: true },
            { name: 'Stitching Thread & Inks', type: 'RAW_MATERIAL', description: 'HDPE/PP thread spools and flexo printing inks', isActive: true },
            { name: 'Unlaminated PP Woven Bags', type: 'FINISHED_GOODS', description: 'Standard PP Woven Sacks for Cement & Grains', isActive: true },
            { name: 'BOPP Laminated Bags', type: 'FINISHED_GOODS', description: 'High definition printed BOPP laminated bags', isActive: true },
            { name: 'FIBC Jumbo Bags', type: 'FINISHED_GOODS', description: 'Flexible Intermediate Bulk Containers (1 Tonne+)', isActive: true },
            { name: 'Lenomesh Bags', type: 'FINISHED_GOODS', description: 'Mesh packaging bags for produce and vegetables', isActive: true }
        ];

        for (const catData of defaultCategories) {
            await Category.updateOne(
                { tenant: tenantId, name: catData.name },
                { $setOnInsert: { ...catData, tenant: tenantId } },
                { upsert: true }
            );
        }

        // 5. Seed Standard Default Bag Shapes
        const defaultBagShapes = [
            { name: 'Gusseted', description: 'Gusseted side-fold bag shape', isActive: true },
            { name: 'Flat / Tubular', description: 'Flat or tubular bag shape', isActive: true },
            { name: 'Block Bottom', description: 'Block bottom self-standing bag shape', isActive: true },
            { name: 'Pinch Bottom', description: 'Pinch bottom sealed bag shape', isActive: true },
            { name: 'Valve', description: 'Internal or external valve bag shape', isActive: true }
        ];

        for (const shapeData of defaultBagShapes) {
            await BagShape.updateOne(
                { tenant: tenantId, name: shapeData.name },
                { $setOnInsert: { ...shapeData, tenant: tenantId } },
                { upsert: true }
            );
        }

        console.log(`✅ Default master data (UOM, Locations, Shifts, Categories, Bag Shapes) seeded for Tenant ID: ${tenantId}`);
    } catch (error) {
        console.error('Error seeding tenant default master data:', error);
    }
};

module.exports = { seedTenantMasterData };
