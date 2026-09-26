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
    },
    receivedRolls: {
        type: Number,
        default: 0
    },
    fabricAverage: {
        type: Number,
        default: null
    }
}, { _id: false });

const RollSpecificationSchema = new mongoose.Schema({
    rollNumber: {
        type: String,
        required: [true, 'Roll Number is required'],
        trim: true,
        maxlength: [50, 'Roll Number cannot exceed 50 characters']
    },
    fabricLength: {
        type: Number,
        default: null,
        min: [1, 'Fabric Length must be at least 1 Meter'],
        max: [50000, 'Fabric Length cannot exceed 50000 Meters']
    },
    width: {
        type: Number,
        default: null,
        min: [0, 'Width cannot be negative']
    },
    grossWeight: {
        type: Number,
        default: null,
        min: [0.01, 'Gross Weight must be at least 0.01 Kg'],
        max: [10000, 'Gross Weight cannot exceed 10000 Kg']
    },
    netWeight: {
        type: Number,
        default: null,
        min: [0.01, 'Net Weight must be at least 0.01 Kg'],
        max: [10000, 'Net Weight cannot exceed 10000 Kg']
    },
    fabricAverage: {
        type: Number,
        default: null
    },
    totalQuantityKg: {
        type: Number,
        default: null,
        min: [0, 'Total quantity in Kgs cannot be negative']
    },
    totalQuantityPcs: {
        type: Number,
        default: null,
        min: [0, 'Total quantity in Pcs cannot be negative']
    }
}, { _id: true });

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
    rolls: {
        type: [RollSpecificationSchema],
        default: []
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
