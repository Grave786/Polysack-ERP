const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    employeeCode: {
        type: String,
        required: [true, 'Employee Code is required'],
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: [true, 'Employee Name is required'],
        trim: true
    },
    department: {
        type: String,
        required: [true, 'Department is required'],
        set: (val) => val ? String(val).trim().toUpperCase().replace(/[-\s]+/g, '_') : val,
        enum: {
            values: [
                'PRODUCTION',
                'EXTRUSION',
                'WEAVING',
                'LAMINATION',
                'PRINTING',
                'SEWING',
                'BALING',
                'QUALITY',
                'MAINTENANCE',
                'LOGISTICS',
                'ADMINISTRATION',
                'OTHER'
            ],
            message: '{VALUE} is not a valid department.'
        }
    },
    designation: {
        type: String,
        trim: true
    },
    dateOfJoining: {
        type: Date,
        default: Date.now
    },
    shiftAssignment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        required: [true, 'Default shift assignment is required']
    },
    facility: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: [true, 'Facility / Location is required']
    },
    linkedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    monthlySalary: {
        type: Number,
        default: 0,
        min: [0, 'Monthly salary cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

EmployeeSchema.index({ employeeCode: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
