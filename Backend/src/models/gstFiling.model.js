const mongoose = require('mongoose');

const GstFilingSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    financialYear: {
        type: String,
        required: [true, 'Financial Year is required'],
        trim: true
    },
    month: {
        type: String, // format "YYYY-MM", e.g. "2026-04"
        required: [true, 'Month key (YYYY-MM) is required'],
        trim: true
    },
    returnType: {
        type: String,
        enum: ['GSTR-1', 'GSTR-3B'],
        required: [true, 'Return Type is required']
    },
    status: {
        type: String,
        enum: ['Filed'],
        default: 'Filed'
    },
    filedDate: {
        type: Date,
        default: Date.now
    },
    arnNumber: {
        type: String,
        trim: true,
        default: ''
    },
    taxPaid: {
        type: Number,
        default: 0,
        min: 0
    },
    filedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

GstFilingSchema.index({ tenant: 1, month: 1, returnType: 1 }, { unique: true });

module.exports = mongoose.model('GstFiling', GstFilingSchema);
