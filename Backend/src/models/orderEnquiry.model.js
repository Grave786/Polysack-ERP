const mongoose = require('mongoose');

/**
 * OrderEnquiry — Customer job-order enquiry record.
 * Tied to a real Customer master. Shared masters (materialQualityFabric,
 * laminationType, materialColour, fabricGrammage) are stored as string values
 * resolved from RawMaterialAttribute at form-fill time, keeping this document
 * self-contained for historical reporting.
 */
const AttachmentSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    data: { type: String },          // Base64 data-URL (same pattern as Work Order PO)
    size: { type: Number, default: 0 },
    mimeType: { type: String, trim: true }
}, { _id: false });

const OrderEnquirySchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },

    nslNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    customerType: {
        type: String,
        enum: ['Existing', 'New'],
        default: 'Existing'
    },

    // ── Core Link ──────────────────────────────────────────────────────────────
    customerRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: false
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: false
    },

    newCustomerDetails: {
        name: { type: String, trim: true, default: '' },
        company: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' }
    },

    status: {
        type: String,
        enum: ['Open', 'Confirmed', 'Lost'],
        default: 'Open'
    },

    soApprovalStatus: {
        type: String,
        enum: ['Not Requested', 'Pending Approval', 'Approved', 'Rejected'],
        default: 'Not Requested'
    },

    followUps: [{
        date: { type: Date, default: Date.now },
        communicationType: { type: String, trim: true },
        type: { type: String, trim: true },
        notes: { type: String, trim: true },
        nextFollowUpDate: { type: Date }
    }],
    enquiryDate: {
        type: Date,
        default: Date.now
    },

    // ── Contact Details (auto-filled from Customer, overridable) ───────────────
    contactPerson: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    contactDesignation: { type: String, trim: true, default: '' },

    // ── Product Specification ──────────────────────────────────────────────────
    productCategory: {
        type: String,
        enum: {
            values: ['Print', 'Plain'],
            message: '{VALUE} is not a valid product category.'
        },
        required: [true, 'Product category is required']
    },

    // Structured Print Specification
    printSpec: {
        printSides: {
            type: String,
            enum: ['FRONT_ONLY', 'BACK_ONLY', 'BOTH', 'NONE', ''],
            default: 'NONE'
        },
        frontColours: { type: Number, default: 0, min: 0 },
        backColours: { type: Number, default: 0, min: 0 },
        frontColorsQty: { type: Number, default: 0, min: 0 },
        backColorsQty: { type: Number, default: 0, min: 0 },
        frontColorsList: [{ type: String, trim: true }],
        backColorsList: [{ type: String, trim: true }]
    },
    printSides: {
        type: String,
        enum: ['FRONT_ONLY', 'BACK_ONLY', 'BOTH', 'NONE', ''],
        default: ''
    },
    frontColours: { type: Number, default: 0, min: 0 },
    backColours: { type: Number, default: 0, min: 0 },
    frontColorsQty: { type: Number, default: 0, min: 0 },
    backColorsQty: { type: Number, default: 0, min: 0 },
    frontColorsList: [{ type: String, trim: true }],
    backColorsList: [{ type: String, trim: true }],

    // Human-readable / legacy print fields
    jobDescriptionPrintColours: {
        type: String,
        trim: true,
        default: ''
    },

    jobDescriptionPrintSide: {
        type: String,
        trim: true,
        default: ''
    },
    jobDescriptionPrintSideOther: { type: String, trim: true, default: '' },

    // ── Shared Material Master Values (stored as resolved string names) ─────────
    materialQualityFabric: { type: String, trim: true, default: '' },
    fabricLaminationType:  { type: String, trim: true, default: '' },
    materialColour:        { type: String, trim: true, default: '' },
    fabricGrammage:        { type: String, trim: true, default: '' },

    // ── Physical Specs ─────────────────────────────────────────────────────────
    bagWeightGms:    { type: Number, default: null },
    fabricAverage:   { type: String, trim: true, default: '' },
    fabricWidthInch:  { type: Number, default: null },
    fabricLengthInch: { type: Number, default: null },

    // ── Order Quantity & Confirmation ──────────────────────────────────────────
    totalOrderQuantity: { type: Number, default: null },
    orderQuantity:      { type: Number, default: null },
    quantityUnit:       { type: String, trim: true, default: 'Kg' },
    orderConfirmed: {
        type: Boolean,
        default: false
    },
    expectedDeliveryDate: {
        type: Date,
        default: null
    },

    // ── PO Attachments (up to 5 files, Base64) ─────────────────────────────────
    poAttachments: {
        type: [AttachmentSchema],
        default: [],
        validate: {
            validator: (arr) => arr.length <= 5,
            message: 'A maximum of 5 PO attachments are allowed.'
        }
    },

    // ── Description & Remarks ──────────────────────────────────────────────────
    description: { type: String, trim: true, default: '' },
    remarks:     { type: String, trim: true, default: '' },

    // ── Soft Delete ────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true }

}, { timestamps: true });

OrderEnquirySchema.pre('save', async function (next) {
    if (!this.nslNumber) {
        const year = new Date().getFullYear();
        const prefix = `NSL-${year}-`;
        const lastDoc = await this.constructor.findOne({
            nslNumber: { $regex: `^${prefix}\\d{4,}$` }
        }).sort({ nslNumber: -1 });

        let nextNumber = 1;
        if (lastDoc && lastDoc.nslNumber) {
            const parts = lastDoc.nslNumber.split('-');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2], 10);
                if (!isNaN(lastSeq)) {
                    nextNumber = lastSeq + 1;
                }
            }
        }
        const paddedSeq = String(nextNumber).padStart(4, '0');
        this.nslNumber = `${prefix}${paddedSeq}`;
    }

    // Sync customer and customerRef for backwards compatibility
    if (this.customerRef && !this.customer) {
        this.customer = this.customerRef;
    } else if (this.customer && !this.customerRef) {
        this.customerRef = this.customer;
    }

    next();
});

OrderEnquirySchema.index({ tenant: 1, customer: 1, enquiryDate: -1 });
OrderEnquirySchema.index({ tenant: 1, orderConfirmed: 1 });
OrderEnquirySchema.index({ tenant: 1, nslNumber: 1 });

module.exports = mongoose.model('OrderEnquiry', OrderEnquirySchema);
