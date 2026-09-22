const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
    fileName: { type: String, trim: true },
    fileData: { type: String },   // base64 encoded
    fileType: { type: String, trim: true }
}, { _id: false });

const MaterialReceiptSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    receiptNumber: {
        type: String,
        required: [true, 'Receipt Number is required'],
        trim: true,
        uppercase: true
    },

    // ─── Basic Info ────────────────────────────────────────────────────
    date: {
        type: Date,
        default: Date.now
    },
    invoiceNumber: {
        type: String,
        trim: true,
        default: ''
    },
    invoiceAttachments: {
        type: [AttachmentSchema],
        default: [],
        validate: {
            validator: (v) => v.length <= 3,
            message: 'Maximum 3 invoice attachments allowed.'
        }
    },

    // ─── Company / Customer ────────────────────────────────────────────
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer / Company is required']
    },

    // ─── Material Classification ───────────────────────────────────────
    materialDescription: {
        type: String,
        trim: true,
        default: ''
    },
    materialQualityFabric: {
        type: String,
        trim: true,
        default: ''
    },
    fabricGrammage: {
        type: String,
        trim: true,
        default: ''
    },
    materialQualityBags: {
        type: String,
        trim: true,
        default: ''
    },
    laminationType: {
        type: String,
        trim: true,
        default: ''
    },
    fabricColour: {
        type: String,
        trim: true,
        default: ''
    },
    qualityThreadYarn: {
        type: String,
        trim: true,
        default: ''
    },
    threadColour: {
        type: String,
        trim: true,
        default: ''
    },
    fabricAverage: {
        type: String,
        trim: true,
        default: ''
    },

    // ─── Bag Size ──────────────────────────────────────────────────────
    bagWidth: {
        type: Number,
        default: null,
        min: [0, 'Bag width cannot be negative']
    },
    bagLength: {
        type: Number,
        default: null,
        min: [0, 'Bag length cannot be negative']
    },
    bagDimensionUnit: {
        type: String,
        enum: ['cm', 'inch'],
        default: 'cm'
    },
    bagWeight: {
        type: Number,
        default: null,
        min: [0, 'Bag weight cannot be negative']
    },

    // ─── Quantities ────────────────────────────────────────────────────
    totalQuantityKg: {
        type: Number,
        default: null,
        min: [0, 'Quantity in Kg cannot be negative']
    },
    totalQuantityPcs: {
        type: Number,
        default: null,
        min: [0, 'Quantity in Pcs cannot be negative']
    },

    // ─── Invoice Financials ────────────────────────────────────────────
    basicPrice: {
        type: Number,
        default: 0,
        min: [0, 'Basic price cannot be negative']
    },
    gstPercent: {
        type: Number,
        default: 0,
        min: [0, 'GST % cannot be negative'],
        max: [100, 'GST % cannot exceed 100']
    },
    freight: {
        type: Number,
        default: 0,
        min: [0, 'Freight cannot be negative']
    },
    advancePaid: {
        type: Number,
        default: 0,
        min: [0, 'Advance paid cannot be negative']
    },
    // Auto-calculated: basicPrice + (basicPrice * gstPercent / 100) + freight - advancePaid
    totalInvoiceAmount: {
        type: Number,
        default: 0
    },

    // ─── Transport ────────────────────────────────────────────────────
    vehicleNumber: {
        type: String,
        trim: true,
        default: ''
    },
    transporterName: {
        type: String,
        trim: true,
        default: ''
    },

    // ─── Receipt Copy Attachments ──────────────────────────────────────
    materialReceiptAttachments: {
        type: [AttachmentSchema],
        default: [],
        validate: {
            validator: (v) => v.length <= 3,
            message: 'Maximum 3 material receipt attachments allowed.'
        }
    },

    // ─── Print / Plain ────────────────────────────────────────────────
    printOrPlain: {
        type: String,
        enum: ['PRINT', 'PLAIN'],
        default: 'PLAIN'
    }

}, { timestamps: true });

// Compound unique index per tenant
MaterialReceiptSchema.index({ tenant: 1, receiptNumber: 1 }, { unique: true });

module.exports = mongoose.model('MaterialReceipt', MaterialReceiptSchema);
