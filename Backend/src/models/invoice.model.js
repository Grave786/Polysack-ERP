const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood',
        required: [true, 'Finished Good reference is required in Invoice item']
    },
    description: {
        type: String,
        required: [true, 'Description is required in Invoice item'],
        trim: true
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.0001, 'Quantity must be greater than 0']
    },
    ratePerUnit: {
        type: Number,
        required: [true, 'Rate per unit is required'],
        min: [0, 'Rate per unit cannot be negative']
    },
    taxableValue: {
        type: Number,
        required: [true, 'Taxable value is required'],
        min: [0, 'Taxable value cannot be negative']
    }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    invoiceNumber: {
        type: String,
        required: [true, 'Invoice Number is required'],
        trim: true,
        uppercase: true
    },
    salesOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        default: null
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    customerType: {
        type: String,
        enum: ['WALK_IN', 'REGISTERED'],
        default: 'REGISTERED'
    },
    walkInCustomer: {
        name: { type: String, trim: true },
        gstin: { type: String, trim: true, uppercase: true },
        phone: { type: String, trim: true }
    },
    paymentMode: {
        type: String,
        enum: ['CASH', 'UPI', 'CARD', 'OTHER'],
        default: 'CASH'
    },
    invoiceDate: {
        type: Date,
        default: Date.now
    },
    items: {
        type: [InvoiceItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Invoice must contain at least one item.'
        }
    },
    gstRate: {
        type: Number,
        default: 18,
        min: [0, 'GST rate cannot be negative'],
        max: [28, 'GST rate cannot exceed 28%']
    },
    gstAmount: {
        type: Number,
        default: 0,
        min: [0, 'GST amount cannot be negative']
    },
    cgstAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    sgstAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    igstAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    grandTotal: {
        type: Number,
        default: 0,
        min: [0, 'Grand total cannot be negative']
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: [0, 'Paid amount cannot be negative']
    },
    dueAmount: {
        type: Number,
        default: 0,
        min: [0, 'Due amount cannot be negative']
    },
    paymentStatus: {
        type: String,
        default: 'UNPAID',
        enum: {
            values: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
            message: '{VALUE} is not a valid payment status.'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

InvoiceSchema.index({ invoiceNumber: 1, tenant: 1 }, { unique: true });
InvoiceSchema.index({ tenant: 1, invoiceDate: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
