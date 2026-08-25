const mongoose = require('mongoose');

const MachineSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Machine code is required'],
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: [true, 'Machine name is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    section: {
        type: String,
        required: [true, 'Production section is required'],
        enum: {
            values: ['EXTRUSION', 'WEAVING', 'LAMINATION', 'PRINTING', 'SEWING', 'BALING'],
            message: '{VALUE} is not a valid production section.'
        }
    },
    capacityPerHour: {
        type: Number,
        min: [0, 'Capacity per hour cannot be negative']
    },
    capacityUnit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UOM',
        default: null
    },
    defaultLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    currentOperator: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        default: 'IDLE',
        enum: {
            values: ['RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'],
            message: '{VALUE} is not a valid machine status.'
        }
    },
    efficiency: {
        type: Number,
        default: 0,
        min: [0, 'Efficiency percentage cannot be negative'],
        max: [100, 'Efficiency percentage cannot exceed 100']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
MachineSchema.index({ code: 1, tenant: 1 }, { unique: true });
MachineSchema.index({ name: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Machine', MachineSchema);
