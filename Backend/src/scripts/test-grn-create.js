const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GRN = require('../models/grn.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const Location = require('../models/location.model');
const RawMaterial = require('../models/rawMaterial.model');
const Supplier = require('../models/supplier.model');
const User = require('../models/user.model');

async function test() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const po = await PurchaseOrder.findOne({ poNumber: 'PO-2026-1002' });
        if (!po) {
            console.log('PO-2026-1002 not found, finding any SENT_TO_SUPPLIER PO...');
        }
        const activePo = po || await PurchaseOrder.findOne({ status: { $in: ['SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'] } });

        if (!activePo) {
            console.log('No eligible PO found for testing.');
            return;
        }

        console.log(`Found PO: ${activePo.poNumber} | Status: ${activePo.status} | Supplier: ${activePo.supplier}`);

        // Find a receiving location
        const loc = await Location.findOne({ tenant: activePo.tenant, isActive: true });
        if (!loc) {
            console.log('No active location found.');
            return;
        }

        // Test querying GRNs with populate
        const grns = await GRN.find({ tenant: activePo.tenant })
            .populate('purchaseOrder', 'poNumber poDate status')
            .populate('supplier', 'name contactPerson phone')
            .populate('receivingLocation', 'name code type')
            .populate('items.rawMaterial', 'name code uom currentStock')
            .populate('receivedBy', 'name email')
            .limit(5);

        console.log(`Successfully queried ${grns.length} GRNs with all populate paths including supplier!`);

    } catch (err) {
        console.error('Error during GRN populate test:', err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
