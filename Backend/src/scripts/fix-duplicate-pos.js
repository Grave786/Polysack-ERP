require('dotenv').config({ path: 'c:/Users/BAPS/OneDrive/Desktop/Polysack-ERP/Backend/.env' });
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/purchaseOrder.model');

async function fixDuplicatePOs() {
    try {
        console.log('Connecting to MongoDB Atlas via IPv4...');
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('✅ Connected to MongoDB Atlas successfully.');

        // 1. Convert PO-2026-1002 status to PENDING_APPROVAL
        const po1002 = await PurchaseOrder.findOne({ poNumber: 'PO-2026-1002' });
        if (po1002) {
            po1002.status = 'PENDING_APPROVAL';
            await po1002.save();
            console.log(`✅ PO-2026-1002 updated to status: '${po1002.status}'`);
        } else {
            console.log('⚠️ PO-2026-1002 not found.');
        }

        // 2. Consolidate/Cancel redundant draft POs (PO-2026-1003 to PO-2026-1006)
        const duplicatePos = await PurchaseOrder.find({
            poNumber: { $in: ['PO-2026-1003', 'PO-2026-1004', 'PO-2026-1005', 'PO-2026-1006'] }
        });

        for (const po of duplicatePos) {
            po.status = 'CANCELLED';
            await po.save();
            console.log(`✅ Cancelled duplicate PO ${po.poNumber} (Status: '${po.status}')`);
        }

        console.log('--- PO MIGRATION SCRIPT FINISHED CLEANLY ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration script error:', err);
        process.exit(1);
    }
}

fixDuplicatePOs();
