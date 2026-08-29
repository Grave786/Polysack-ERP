const mongoose = require('mongoose');

const DispatchItemSchema = new mongoose.Schema({
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood',
        required: [true, 'Finished Good reference is required in Dispatch item']
    },
    dispatchedQuantity: {
        type: Number,
        required: [true, 'Dispatched quantity is required'],
        min: [0.0001, 'Dispatched quantity must be greater than 0']
    },
    batchNumber: {
        type: String,
        trim: true
    }
}, { _id: false });

const DispatchSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    dispatchNumber: {
        type: String,
        required: [true, 'Dispatch Number is required'],
        trim: true,
        uppercase: true
    },
    salesOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        default: null
    },
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        default: null
    },
    sourceType: {
        type: String,
        enum: ['SALES_ORDER', 'POS_INVOICE'],
        default: 'SALES_ORDER'
    },
    dispatchDate: {
        type: Date,
        default: Date.now
    },
    items: {
        type: [DispatchItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Dispatch must contain at least one item.'
        }
    },
    dispatchLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: [true, 'Dispatch location (source location) is required']
    },
    vehicleNumber: {
        type: String,
        trim: true,
        uppercase: true
    },
    transporter: {
        type: String,
        trim: true
    },
    driverName: {
        type: String,
        trim: true
    },
    driverPhone: {
        type: String,
        trim: true
    },
    deliveryStatus: {
        type: String,
        default: 'IN_TRANSIT',
        enum: {
            values: ['IN_TRANSIT', 'POD_PENDING_APPROVAL', 'DELIVERED', 'RETURNED'],
            message: '{VALUE} is not a valid delivery status.'
        }
    },
    podConfirmedAt: {
        type: Date,
        default: null
    },
    pod: {
        receiverName: { type: String, trim: true },
        receiverPhone: { type: String, trim: true },
        proofDocument: { type: String }, // Document name/reference
        proofImage: { type: String }, // Base64 data URL or image path
        notes: { type: String, trim: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        rejectionReason: { type: String, trim: true },
        rejectedAt: { type: Date }
    },
    notes: {
        type: String,
        trim: true
    },
    dispatchedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Dispatched by user is required']
    }
}, { timestamps: true });

DispatchSchema.pre('validate', function (next) {
    if (!this.salesOrder && !this.invoice) {
        this.invalidate('salesOrder', 'A dispatch must reference either a Sales Order or a POS Invoice.');
    }
    next();
});

DispatchSchema.index({ dispatchNumber: 1, tenant: 1 }, { unique: true });
DispatchSchema.index({ tenant: 1, invoice: 1 });
DispatchSchema.index({ tenant: 1, salesOrder: 1 });

module.exports = mongoose.model('Dispatch', DispatchSchema);
