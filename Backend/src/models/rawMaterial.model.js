const mongoose = require('mongoose');

const RawMaterialSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Raw Material code is required'],
        trim: true,
        uppercase: true
    },
    name: {
        type: String,
        required: [true, 'Raw Material name is required'],
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
    defaultSupplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    defaultLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    currentStock: {
        type: Number,
        default: 0,
        min: [0, 'Current stock cannot be negative']
    },
    reorderLevel: {
        type: Number,
        default: 0,
        min: [0, 'Reorder level cannot be negative']
    },
    pricePerUnit: {
        type: Number,
        default: 0,
        min: [0, 'Price per unit cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
RawMaterialSchema.index({ tenant: 1, code: 1 }, { unique: true });
RawMaterialSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RawMaterial', RawMaterialSchema);
