const mongoose = require('mongoose');

const FinishedGoodSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Finished Good code is required'],
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: [true, 'Finished Good name is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required']
    },
    uom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UOM',
        required: [true, 'UOM is required']
    },
    defaultLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    fabricGSM: {
        type: Number,
        min: [0, 'Fabric GSM cannot be negative']
    },
    bagShape: {
        type: String,
        enum: {
            values: ['GUSSETED', 'FLAT_TUBE', 'PINCH_BOTTOM', 'BLOCK_BOTTOM'],
            message: '{VALUE} is not a valid bag shape.'
        }
    },
    dimensions: {
        width: { type: Number, min: 0 },
        length: { type: Number, min: 0 }
    },
    bagCapacity: {
        type: Number,
        min: [0, 'Bag capacity cannot be negative']
    },
    pendingQCStock: {
        type: Number,
        default: 0,
        min: [0, 'Pending QC stock cannot be negative']
    },
    currentStock: {
        type: Number,
        default: 0,
        min: [0, 'Current stock cannot be negative']
    },
    pricePerBag: {
        type: Number,
        default: 0,
        min: [0, 'Price per bag cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
FinishedGoodSchema.index({ tenant: 1, code: 1 }, { unique: true });
FinishedGoodSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('FinishedGood', FinishedGoodSchema);
