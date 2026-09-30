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
    stage: {
        type: String,
        trim: true,
        required: [true, 'Stage identifier is required']
    },
    stageName: {
        type: String,
        trim: true
    },
    stageSequence: {
        type: Number
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false
    },
    date: {
        type: Date,
        required: [true, 'Production date is required'],
        default: Date.now
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.0001, 'Quantity must be greater than 0']
    },
    shift: {
        type: mongoose.Schema.Types.Mixed,
        ref: 'Shift',
        default: null
    },
    remarks: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    loggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Metrics retained for backward compatibility with stage advances
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
    }
}, { timestamps: true });

// Required compound indexes for operator-wise and date-wise performance
ProductionLogSchema.index({ tenant: 1, workOrder: 1, stage: 1, date: 1 });
ProductionLogSchema.index({ tenant: 1, workOrder: 1, operator: 1 });
ProductionLogSchema.index({ tenant: 1, createdAt: 1 });
ProductionLogSchema.index({ tenant: 1, date: 1 });
ProductionLogSchema.index({ tenant: 1, workOrder: 1 });

module.exports = mongoose.model('ProductionLog', ProductionLogSchema);

