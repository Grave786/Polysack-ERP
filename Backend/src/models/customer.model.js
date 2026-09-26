const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Customer code is required'],
        trim: true,
        uppercase: true
    },
    companyName: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    contactPerson: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    gstin: {
        type: String,
        uppercase: true,
        trim: true
    },
    panNumber: {
        type: String,
        uppercase: true,
        trim: true
    },
    paymentTerms: {
        type: String,
        trim: true,
        default: 'Net 30'
    },
    creditLimit: {
        type: Number,
        default: 0,
        min: [0, 'Credit limit cannot be negative']
    },
    outstandingAmount: {
        type: Number,
        default: 0,
        min: [0, 'Outstanding amount cannot be negative']
    },
    status: {
        type: String,
        default: 'LEAD',
        enum: {
            values: ['LEAD', 'ACTIVE_CUSTOMER', 'INACTIVE'],
            message: '{VALUE} is not a valid customer status.'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
CustomerSchema.index({ tenant: 1, companyName: 1 }, { unique: true });
CustomerSchema.index({ tenant: 1, code: 1 }, { unique: true });

// Partial filter expression compound unique index for GSTIN per tenant
CustomerSchema.index(
    { tenant: 1, gstin: 1 },
    { unique: true, partialFilterExpression: { gstin: { $type: 'string' } } }
);

module.exports = mongoose.model('Customer', CustomerSchema);
