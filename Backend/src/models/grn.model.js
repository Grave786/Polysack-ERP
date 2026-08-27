const mongoose = require('mongoose');

const GrnItemSchema = new mongoose.Schema({
    rawMaterial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial',
        required: [true, 'Raw material is required in GRN item']
    },
    receivedQuantity: {
        type: Number,
        required: [true, 'Received quantity is required'],
        min: [0.0001, 'Received quantity must be greater than 0']
    },
    batchNumber: {
        type: String,
        trim: true
    }
}, { _id: false });

const GrnSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    grnNumber: {
        type: String,
        required: [true, 'GRN Number is required'],
        trim: true,
        uppercase: true
    },
    purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        required: [true, 'Purchase Order reference is required']
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: [true, 'Supplier is required']
    },
    receivedDate: {
        type: Date,
        default: Date.now
    },
    items: {
        type: [GrnItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'GRN must contain at least one item.'
        }
    },
    receivingLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: [true, 'Receiving Location is required']
    },
    notes: {
        type: String,
        trim: true
    },
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Received by user is required']
    }
}, { timestamps: true });

GrnSchema.index({ grnNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('GRN', GrnSchema);
