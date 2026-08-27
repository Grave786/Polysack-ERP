const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GRN = require('../models/grn.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const Supplier = require('../models/supplier.model');
const User = require('../models/user.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');

async function backfill() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const unpopulatedGrns = await GRN.find({ supplier: { $exists: false } }).populate('purchaseOrder');
        console.log(`Found ${unpopulatedGrns.length} legacy GRNs missing supplier field.`);

        let updatedCount = 0;
        for (const grn of unpopulatedGrns) {
            if (grn.purchaseOrder && grn.purchaseOrder.supplier) {
                grn.supplier = grn.purchaseOrder.supplier;
                await grn.save();
                updatedCount++;
            }
        }

        console.log(`Backfilled supplier field on ${updatedCount} GRN documents successfully.`);
    } catch (err) {
        console.error('Error during GRN supplier backfill:', err);
    } finally {
        await mongoose.disconnect();
    }
}

backfill();
