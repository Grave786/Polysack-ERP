const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Supplier code is required'],
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Supplier company name is required'],
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
    paymentTerms: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique index for code and name per tenant
SupplierSchema.index({ code: 1, tenant: 1 }, { unique: true });
SupplierSchema.index({ name: 1, tenant: 1 }, { unique: true });

// Sparse compound unique index for GSTIN per tenant
SupplierSchema.index(
    { gstin: 1, tenant: 1 },
    { unique: true, sparse: true, partialFilterExpression: { gstin: { $type: 'string' } } }
);

module.exports = mongoose.model('Supplier', SupplierSchema);
