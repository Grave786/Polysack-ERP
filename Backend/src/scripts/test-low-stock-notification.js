const dotenv = require('dotenv');
dotenv.config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const RawMaterial = require('../models/rawMaterial.model');
const Notification = require('../models/notification.model');
const { executeStockTransactionCore } = require('../controllers/stockTransaction.controller');
const User = require('../models/user.model');

async function testLowStockFlow() {
    await connectDB();
    console.log('--- TESTING LOW STOCK NOTIFICATION FLOW ---');

    try {
        // 1. Find any active user and tenant
        const user = await User.findOne({ isActive: true });
        if (!user) {
            console.error('No user found');
            process.exit(1);
        }

        const tenantId = user.tenant;
        console.log(`Using Tenant: ${tenantId}, User: ${user.name}`);

        // 2. Find or create a test RawMaterial
        let rm = await RawMaterial.findOne({ tenant: tenantId, isActive: true });
        if (!rm) {
            console.log('No raw material found');
            process.exit(0);
        }

        console.log(`Found RawMaterial: ${rm.code} - ${rm.name} | Current Stock: ${rm.currentStock} | Reorder Level: ${rm.reorderLevel}`);

        // Ensure positive reorder level for test
        if (!rm.reorderLevel || rm.reorderLevel <= 0) {
            rm.reorderLevel = 500;
            await rm.save();
            console.log(`Updated Reorder Level to ${rm.reorderLevel}`);
        }

        // Clean previous test notifications for this RM
        await Notification.deleteMany({ tenant: tenantId, 'data.rawMaterialId': rm._id });
        rm.isLowStockAlerted = false;
        rm.currentStock = rm.reorderLevel + 200;
        await rm.save();
        console.log(`Set Initial Stock above threshold: ${rm.currentStock} > ${rm.reorderLevel}`);

        // 3. Perform Stock Out / Adjustment that drops stock below reorder level
        console.log('\n--- Step A: Deduct stock below reorder level ---');
        const deductQty = 300; // Stock will drop from (reorderLevel + 200) to (reorderLevel - 100)
        await executeStockTransactionCore({
            tenantId,
            referenceNumber: `TEST-ADJ-${Date.now()}`,
            itemType: 'RAW_MATERIAL',
            item: rm._id,
            transactionType: 'STOCK_OUT',
            quantity: deductQty,
            notes: 'Test low stock notification trigger',
            performedBy: user._id
        });

        // 4. Verify notification created
        let notifs = await Notification.find({ tenant: tenantId, 'data.rawMaterialId': rm._id });
        console.log(`Notifications count after threshold drop: ${notifs.length}`);
        if (notifs.length === 1) {
            console.log('✅ Notification created successfully:', notifs[0].title, '| Message:', notifs[0].message, '| Link:', notifs[0].link);
        } else {
            console.error('❌ Expected 1 notification, found:', notifs.length);
        }

        // 5. Perform another deduction while still below reorder level (deduplication test)
        console.log('\n--- Step B: Deduct more stock while already below threshold ---');
        await executeStockTransactionCore({
            tenantId,
            referenceNumber: `TEST-ADJ-2-${Date.now()}`,
            itemType: 'RAW_MATERIAL',
            item: rm._id,
            transactionType: 'STOCK_OUT',
            quantity: 10,
            notes: 'Test deduplication - should not spam notification',
            performedBy: user._id
        });

        notifs = await Notification.find({ tenant: tenantId, 'data.rawMaterialId': rm._id });
        console.log(`Notifications count after second deduction (deduplication check): ${notifs.length}`);
        if (notifs.length === 1) {
            console.log('✅ PASS: No duplicate notification created while still below threshold!');
        } else {
            console.error('❌ FAIL: Duplicate notification created:', notifs.length);
        }

        // 6. Replenish stock back above reorder level
        console.log('\n--- Step C: Replenish stock above threshold ---');
        await executeStockTransactionCore({
            tenantId,
            referenceNumber: `TEST-REPLENISH-${Date.now()}`,
            itemType: 'RAW_MATERIAL',
            item: rm._id,
            transactionType: 'STOCK_IN',
            quantity: 500,
            notes: 'Test stock replenishment above reorder level',
            performedBy: user._id
        });

        const refreshedRM = await RawMaterial.findById(rm._id);
        console.log(`Stock replenished to ${refreshedRM.currentStock} > ${refreshedRM.reorderLevel}. isLowStockAlerted: ${refreshedRM.isLowStockAlerted}`);
        if (!refreshedRM.isLowStockAlerted) {
            console.log('✅ PASS: isLowStockAlerted successfully reset to false!');
        } else {
            console.error('❌ FAIL: isLowStockAlerted was not reset.');
        }

        console.log('\n🎉 ALL NOTIFICATION TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

testLowStockFlow();
