const mongoose = require('mongoose');

const ProductionLogSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    workOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkOrder',
        required: [true, 'Work Order reference is required']
    },
    stageName: {
        type: String,
        trim: true
    },
    stageSequence: {
        type: Number
    },
    goodOutput: {
        type: Number,
        default: 0,
        min: 0
    },
    goodOutputQty: {
        type: Number,
        default: 0,
        min: 0
    },
    rejectedQty: {
        type: Number,
        default: 0,
        min: 0
    },
    wastageKg: {
        type: Number,
        default: 0,
        min: 0
    },
    returnToStore: {
        type: Number,
        default: 0,
        min: 0
    },
    issuedMaterialKg: {
        type: Number,
        default: 0,
        min: 0
    },
    totalInputKg: {
        type: Number,
        default: 0,
        min: 0
    },
    notes: {
        type: String,
        trim: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

ProductionLogSchema.index({ tenant: 1, createdAt: 1 });
ProductionLogSchema.index({ tenant: 1, date: 1 });
ProductionLogSchema.index({ tenant: 1, workOrder: 1 });

module.exports = mongoose.model('ProductionLog', ProductionLogSchema);
