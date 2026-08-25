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
    ratePerUnit: {
        type: Number,
        required: [true, 'Rate per unit is required'],
        min: [0, 'Rate per unit cannot be negative']
    },
    dispatchedQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Dispatched quantity cannot be negative']
    }
}, { _id: false });

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
    status: {
        type: String,
        default: 'DRAFT',
        enum: {
            values: ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'CANCELLED'],
            message: '{VALUE} is not a valid SO status.'
        }
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
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

SalesOrderSchema.index({ soNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);
