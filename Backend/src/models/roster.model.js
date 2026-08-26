const mongoose = require('mongoose');

const rosterSchema = new mongoose.Schema(
    {
        tenant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
            index: true
        },
        shift: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shift',
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        overtimeRule: {
            type: String,
            enum: ['PRE_APPROVED', 'REQUIRES_APPROVAL', 'NO_OVERTIME'],
            default: 'REQUIRES_APPROVAL'
        },
        accumulatedOvertime: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'UPCOMING', 'COMPLETED'],
            default: 'ACTIVE'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true
    }
);

rosterSchema.index({ tenant: 1, employee: 1, startDate: 1 });

module.exports = mongoose.model('Roster', rosterSchema);
