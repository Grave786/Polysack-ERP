const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    shiftCode: {
        type: String,
        required: [true, 'Shift Code is required'],
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: [true, 'Shift Name is required'],
        trim: true
    },
    startTime: {
        type: String,
        required: [true, 'Start Time is required (format HH:mm, e.g. 06:00)'],
        trim: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid 24-hour time format (HH:mm)']
    },
    endTime: {
        type: String,
        required: [true, 'End Time is required (format HH:mm, e.g. 14:00)'],
        trim: true,
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid 24-hour time format (HH:mm)']
    },
    standardHours: {
        type: Number,
        default: 8,
        min: [0.5, 'Standard hours must be at least 0.5 hours']
    },
    gracePeriodMinutes: {
        type: Number,
        default: 15,
        min: [0, 'Grace period minutes cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

ShiftSchema.index({ shiftCode: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Shift', ShiftSchema);
