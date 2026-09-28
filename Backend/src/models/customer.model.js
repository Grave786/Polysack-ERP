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
    sourceLeadId: {
        type: String,
        trim: true
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

// Atomic per-tenant counter schema for customer codes
const CustomerCounterSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        unique: true
    },
    seq: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

CustomerCounterSchema.index({ tenant: 1 }, { unique: true });

const CustomerCounter = mongoose.models.CustomerCounter || mongoose.model('CustomerCounter', CustomerCounterSchema);

/**
 * Shared helper: Find highest existing CUST number for tenant across ALL records (including soft-deleted).
 */
const getHighestExistingCustomerNumber = async (tenantObjectId) => {
    // Explicitly query without isActive filter so soft-deleted records are included (Requirement 1a & 2)
    const existingDocs = await mongoose.model('Customer').find(
        { tenant: tenantObjectId, code: { $regex: /^CUST-\d+$/ } },
        { code: 1 }
    ).lean();

    let maxNum = 0;
    for (const doc of existingDocs) {
        if (!doc.code) continue;
        const match = /^CUST-(\d+)$/.exec(doc.code);
        if (match) {
            const val = parseInt(match[1], 10);
            if (!isNaN(val) && val > maxNum) {
                maxNum = val;
            }
        }
    }
    return maxNum;
};

/**
 * Shared helper: Atomically generate sequential customer code per tenant.
 * Format: "CUST-" + 3-digit zero-padded number (CUST-001 ... CUST-999), then CUST-1000+.
 * Includes soft-deleted customers when checking highest code, and catches counter up if behind.
 */
const generateNextCustomerCode = async (tenantId) => {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const maxExisting = await getHighestExistingCustomerNumber(tenantObjectId);

    // Atomically ensure counter exists and is at least maxExisting
    let counter = await CustomerCounter.findOne({ tenant: tenantObjectId });
    if (!counter) {
        try {
            counter = await CustomerCounter.findOneAndUpdate(
                { tenant: tenantObjectId },
                { $setOnInsert: { seq: maxExisting } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (e) {
            counter = await CustomerCounter.findOne({ tenant: tenantObjectId });
        }
    } else if (counter.seq < maxExisting) {
        // Atomic catch-up: counter is behind existing records (Requirement 2)
        await CustomerCounter.updateOne(
            { tenant: tenantObjectId, seq: { $lt: maxExisting } },
            { $set: { seq: maxExisting } }
        );
    }

    const updated = await CustomerCounter.findOneAndUpdate(
        { tenant: tenantObjectId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    let seq = updated.seq;
    if (seq <= maxExisting) {
        seq = maxExisting + 1;
        await CustomerCounter.updateOne(
            { tenant: tenantObjectId },
            { $set: { seq } }
        );
    }

    const formattedSeq = seq < 1000 ? String(seq).padStart(3, '0') : String(seq);
    return `CUST-${formattedSeq}`;
};

/**
 * Preview next customer code without incrementing sequence
 */
const peekNextCustomerCode = async (tenantId) => {
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const maxExisting = await getHighestExistingCustomerNumber(tenantObjectId);
    const counter = await CustomerCounter.findOne({ tenant: tenantObjectId }).lean();

    const currentSeq = counter ? Math.max(counter.seq, maxExisting) : maxExisting;
    const nextNum = currentSeq + 1;
    const formattedSeq = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);
    return `CUST-${formattedSeq}`;
};

const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);

Customer.CustomerCounter = CustomerCounter;
Customer.generateNextCustomerCode = generateNextCustomerCode;
Customer.peekNextCustomerCode = peekNextCustomerCode;

module.exports = Customer;
module.exports.Customer = Customer;
module.exports.CustomerCounter = CustomerCounter;
module.exports.generateNextCustomerCode = generateNextCustomerCode;
module.exports.peekNextCustomerCode = peekNextCustomerCode;

