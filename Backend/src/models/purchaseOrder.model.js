const mongoose = require('mongoose');

const PoItemSchema = new mongoose.Schema({
    rawMaterial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial',
        required: [true, 'Raw material is required in PO item']
    },
    orderedQuantity: {
        type: Number,
        required: [true, 'Ordered quantity is required'],
        min: [0.0001, 'Ordered quantity must be greater than 0']
    },
    unit: {
        type: String,
        enum: ['Kg', 'Roll', 'Bags', 'Pcs'],
        default: 'Kg'
    },
    receivedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Received quantity cannot be negative']
    },
    ratePerUnit: {
        type: Number,
        required: [true, 'Rate per unit is required'],
        min: [0, 'Rate per unit cannot be negative']
    }
}, { _id: false });

const PurchaseOrderSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    poNumber: {
        type: String,
        required: [true, 'PO Number is required'],
        trim: true,
        uppercase: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: [true, 'Supplier is required']
    },
    poDate: {
        type: Date,
        default: Date.now
    },
    expectedDelivery: {
        type: Date,
        required: [true, 'Expected delivery date is required']
    },
    items: {
        type: [PoItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Purchase Order must contain at least one item.'
        }
    },
    totalValue: {
        type: Number,
        default: 0,
        min: [0, 'Total value cannot be negative']
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: [0, 'Paid amount cannot be negative']
    },
    balanceAmount: {
        type: Number,
        default: 0,
        min: [0, 'Balance amount cannot be negative']
    },
    dueDate: {
        type: Date,
        default: null
    },
    payments: [
        {
            amount: { type: Number, required: true, min: [0.01, 'Payment amount must be greater than 0'] },
            paymentDate: { type: Date, default: Date.now },
            paymentMode: { type: String, default: 'UPI' },
            reference: { type: String, trim: true, default: '' },
            notes: { type: String, trim: true, default: '' },
            recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            recordedAt: { type: Date, default: Date.now }
        }
    ],
    paymentStatus: {
        type: String,
        default: 'UNPAID',
        enum: {
            values: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
            message: '{VALUE} is not a valid payment status.'
        }
    },
    status: {
        type: String,
        default: 'DRAFT',
        enum: {
            values: ['DRAFT', 'PENDING_APPROVAL', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'REJECTED'],
            message: '{VALUE} is not a valid PO status.'
        }
    },
    approvalRemarks: {
        type: String,
        trim: true,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deliveryLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    notes: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

PurchaseOrderSchema.index({ poNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
