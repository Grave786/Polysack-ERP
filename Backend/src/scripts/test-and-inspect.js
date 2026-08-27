const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;

const WorkOrderStageSchema = new mongoose.Schema({
    stageName: String,
    sequence: Number,
    status: String,
    goodOutputQty: Number,
    rejectedQty: Number,
    startedAt: Date,
    completedAt: Date
}, { _id: true });

const WorkOrderSchema = new mongoose.Schema({
    tenant: mongoose.Schema.Types.ObjectId,
    workOrderNumber: String,
    customer: mongoose.Schema.Types.ObjectId,
    finishedGood: mongoose.Schema.Types.ObjectId,
    bom: mongoose.Schema.Types.ObjectId,
    targetQuantity: Number,
    completedQuantity: Number,
    progressPercentage: Number,
    priority: String,
    status: String,
    stages: [WorkOrderStageSchema]
}, { timestamps: true });

const WorkOrder = mongoose.model('WorkOrder', WorkOrderSchema);

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        // 1. Inspect WO-2026-8202 and WO-2026-8203
        console.log('\n======================================================');
        console.log('PART 1: RAW STAGES ARRAY FOR WO-2026-8202 AND WO-2026-8203');
        console.log('======================================================');

        const existingWos = await WorkOrder.find({ workOrderNumber: { $in: ['WO-2026-8202', 'WO-2026-8203'] } }).lean();
        
        for (const wo of existingWos) {
            console.log(`\n--- WORK ORDER: ${wo.workOrderNumber} (Status: ${wo.status}, Total Stages: ${wo.stages?.length}) ---`);
            wo.stages.forEach((s, idx) => {
                console.log(`Index ${idx} | ID: ${s._id} | Seq: ${s.sequence} | Name: ${s.stageName.padEnd(22)} | Status: ${s.status.padEnd(10)} | Good: ${s.goodOutputQty} | Defect: ${s.rejectedQty}`);
            });
        }

        // 2. Create a BRAND NEW Work Order WO-2026-TEST-8-STAGE
        console.log('\n======================================================');
        console.log('PART 2: CREATING BRAND NEW WORK ORDER (WO-2026-TEST-8-STAGE)');
        console.log('======================================================');

        // Delete test work order if exists
        await WorkOrder.deleteOne({ workOrderNumber: 'WO-2026-TEST-8-STAGE' });

        const now = new Date();
        const ALL_STAGE_NAMES = [
            'TAPE_EXTRUSION',
            'CIRCULAR_WEAVING',
            'EXTRUSION_LAMINATION',
            'FLEXO_PRINTING',
            'CUTTING_SEWING',
            'STITCHING',
            'HANDLE_ATTACHMENT',
            'BALING_PACKING'
        ];

        const startingIndex = 3; // FLEXO_PRINTING
        const newStages = ALL_STAGE_NAMES.map((stageName, index) => {
            const sequence = index + 1;
            if (index < startingIndex) {
                return { stageName, sequence, status: 'SKIPPED', goodOutputQty: 0, rejectedQty: 0 };
            } else if (index === startingIndex) {
                return { stageName, sequence, status: 'ACTIVE', startedAt: now, goodOutputQty: 0, rejectedQty: 0 };
            } else {
                return { stageName, sequence, status: 'PENDING', goodOutputQty: 0, rejectedQty: 0 };
            }
        });

        // Pick tenant, customer, finishedGood, bom from WO-2026-8203 or first WO
        const sampleWo = existingWos[0] || await WorkOrder.findOne();
        
        const testWo = new WorkOrder({
            tenant: sampleWo.tenant,
            workOrderNumber: 'WO-2026-TEST-8-STAGE',
            customer: sampleWo.customer,
            finishedGood: sampleWo.finishedGood,
            bom: sampleWo.bom,
            targetQuantity: 1000,
            completedQuantity: 0,
            progressPercentage: 0,
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            stages: newStages
        });

        await testWo.save();
        console.log('Created WO-2026-TEST-8-STAGE with 8 stages.');

        // Function to simulate controller advanceStage
        async function advanceStage(numGoodQty, numRejectedQty) {
            const wo = await WorkOrder.findOne({ workOrderNumber: 'WO-2026-TEST-8-STAGE' });
            const activeStageIndex = wo.stages.findIndex(s => s.status === 'ACTIVE');
            if (activeStageIndex === -1) throw new Error('No ACTIVE stage');

            const currentStage = wo.stages[activeStageIndex];
            currentStage.goodOutputQty = numGoodQty;
            currentStage.rejectedQty = numRejectedQty;
            currentStage.status = 'COMPLETED';
            currentStage.completedAt = new Date();

            let nextStageIndex = -1;
            for (let i = activeStageIndex + 1; i < wo.stages.length; i++) {
                if (wo.stages[i] && wo.stages[i].status !== 'SKIPPED') {
                    nextStageIndex = i;
                    break;
                }
            }

            if (nextStageIndex === -1 || currentStage.sequence === 8) {
                wo.completedQuantity += numGoodQty;
                if (wo.completedQuantity >= wo.targetQuantity) {
                    wo.status = 'COMPLETED';
                }
            } else {
                const nextStage = wo.stages[nextStageIndex];
                nextStage.status = 'ACTIVE';
                nextStage.startedAt = new Date();
            }

            const activeOrCompleted = wo.stages.filter(s => s.status !== 'SKIPPED');
            const completedCount = activeOrCompleted.filter(s => s.status === 'COMPLETED').length;
            wo.progressPercentage = Math.min(100, Math.round((completedCount / activeOrCompleted.length) * 100));

            await wo.save();
            return wo;
        }

        // Advance 1: Flexo Printing (Good 1000, Defect 0)
        console.log('\n--- ADVANCING STAGE 4: FLEXO_PRINTING (Good: 1000, Defect: 0) ---');
        await advanceStage(1000, 0);

        // Advance 2: Cutting & Sewing (Good 950, Defect 50)
        console.log('--- ADVANCING STAGE 5: CUTTING_SEWING (Good: 950, Defect: 50) ---');
        await advanceStage(950, 50);

        // Advance 3: Stitching (Good 900, Defect 50)
        console.log('--- ADVANCING STAGE 6: STITCHING (Good: 900, Defect: 50) ---');
        await advanceStage(900, 50);

        // Advance 4: Handle Attachment (Good 880, Defect 20)
        console.log('--- ADVANCING STAGE 7: HANDLE_ATTACHMENT (Good: 880, Defect: 20) ---');
        await advanceStage(880, 20);

        // Advance 5: Baling & Packing (Good 850, Defect 30)
        console.log('--- ADVANCING STAGE 8: BALING_PACKING (Good: 850, Defect: 30) ---');
        await advanceStage(850, 30);

        // 3. Fetch final state from DB and print raw stages array
        console.log('\n======================================================');
        console.log('PART 3: RAW STAGES ARRAY FOR WO-2026-TEST-8-STAGE FROM DATABASE AFTER ALL ADVANCES');
        console.log('======================================================');

        const finalWo = await WorkOrder.findOne({ workOrderNumber: 'WO-2026-TEST-8-STAGE' }).lean();
        console.log(`WORK ORDER: ${finalWo.workOrderNumber} (Status: ${finalWo.status}, Progress: ${finalWo.progressPercentage}%)`);
        finalWo.stages.forEach((s, idx) => {
            console.log(`Index ${idx} | ID: ${s._id} | Seq: ${s.sequence} | Name: ${s.stageName.padEnd(22)} | Status: ${s.status.padEnd(10)} | Good: ${s.goodOutputQty} | Defect: ${s.rejectedQty}`);
        });

    } catch (err) {
        console.error('Error during run:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
