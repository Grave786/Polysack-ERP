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
        trim: true
    },
    plantLocation: {
        type: String,
        trim: true,
        default: ''
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
    currentOperators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    currentOperator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
        set: function (val) {
            if (!val || val === '' || val === 'null' || val === 'undefined') return null;
            return val;
        }
    },
    status: {
        type: String,
        default: 'Available',
        trim: true,
        enum: {
            values: ['Available', 'In Use', 'Under Maintenance', 'Out of Service', 'AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'],
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
