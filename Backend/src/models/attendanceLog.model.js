const mongoose = require('mongoose');

const AttendanceLogSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: [true, 'Employee reference is required']
    },
    shift: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        required: [true, 'Shift reference is required']
    },
    date: {
        type: Date,
        required: [true, 'Attendance calendar date is required']
    },
    checkIn: {
        type: Date,
        default: null
    },
    checkOut: {
        type: Date,
        default: null
    },
    source: {
        type: String,
        enum: ['BIOMETRIC', 'MANUAL'],
        default: 'MANUAL'
    },
    hoursWorked: {
        type: Number,
        default: 0,
        min: [0, 'Hours worked cannot be negative']
    },
    overtimeHours: {
        type: Number,
        default: 0,
        min: [0, 'Overtime hours cannot be negative']
    },
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY', 'INCOMPLETE'],
        default: 'PRESENT'
    },
    remarks: {
        type: String,
        trim: true
    },
    loggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Logged by user is required']
    }
}, { timestamps: true });

// Compound unique index: one AttendanceLog per employee per calendar date per tenant
AttendanceLogSchema.index({ tenant: 1, employee: 1, date: 1 }, { unique: true });
AttendanceLogSchema.index({ tenant: 1, date: 1 });

module.exports = mongoose.model('AttendanceLog', AttendanceLogSchema);
