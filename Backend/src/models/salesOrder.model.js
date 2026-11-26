const mongoose = require('mongoose');

const SoItemSchema = new mongoose.Schema({
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood',
        required: [true, 'Finished Good is required in Sales Order item']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.0001, 'Quantity must be greater than 0']
    },
    unit: {
        type: String,
        default: 'Pcs',
        trim: true
    },
    ratePerUnit: {
        type: Number,
        required: [true, 'Rate per unit is required'],
        min: [0, 'Rate per unit cannot be negative']
    },
    dispatchedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Dispatched quantity cannot be negative']
    },
    plannedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Planned quantity cannot be negative']
    }
});

const SalesOrderSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    soNumber: {
        type: String,
        required: [true, 'SO Number is required'],
        trim: true,
        uppercase: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required']
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    deliveryDue: {
        type: Date,
        required: [true, 'Delivery due date is required']
    },
    items: {
        type: [SoItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Sales Order must contain at least one item.'
        }
    },
    totalValue: {
        type: Number,
        default: 0,
        min: [0, 'Total value cannot be negative']
    },
    gstTreatment: {
        type: String,
        enum: ['TAXABLE', 'EXEMPT'],
        default: 'TAXABLE'
    },
    exemptionReason: {
        type: String,
        trim: true,
        default: ''
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
    grandTotal: {
        type: Number,
        default: 0,
        min: [0, 'Grand total cannot be negative']
    },
    status: {
        type: String,
        default: 'DRAFT',
        enum: {
            values: ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'FULLY_DISPATCHED', 'DELIVERED', 'CANCELLED'],
            message: '{VALUE} is not a valid SO status.'
        }
    },
    productionStatus: {
        type: String,
        default: 'Not Planned',
        enum: ['Not Planned', 'Partially Planned', 'Fully Planned', 'In Production', 'Production Completed']
    },
    dispatchLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    notes: {
        type: String,
        trim: true
    },
    sourceEnquiry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderEnquiry',
        default: null
    },
    nslNumber: {
        type: String,
        trim: true,
        default: ''
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    cancellationReason: {
        type: String,
        trim: true,
        default: ''
    },
    statusHistory: [
        {
            from: { type: String, trim: true, default: '' },
            to: { type: String, trim: true, required: true },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            changedByName: { type: String, trim: true, default: '' },
            changedAt: { type: Date, default: Date.now },
            remark: { type: String, trim: true, default: '' }
        }
    ],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

SalesOrderSchema.index({ soNumber: 1, tenant: 1 }, { unique: true });
SalesOrderSchema.index({ tenant: 1, sourceEnquiry: 1 });
SalesOrderSchema.index({ tenant: 1, status: 1, productionStatus: 1 });

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);
