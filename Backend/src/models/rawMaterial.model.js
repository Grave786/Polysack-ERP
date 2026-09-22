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
    preferredSupplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    defaultLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    warehouseLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    materialGrade: {
        type: String,
        trim: true,
        default: 'Virgin Grade 100'
    },
    baseName: {
        type: String,
        trim: true,
        default: ''
    },
    color: {
        type: String,
        trim: true,
        default: 'Natural White'
    },
    // Client-specified Raw Material Master fields
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
    fabricGrammage: {
        type: String,
        trim: true,
        default: ''
    },
    materialColour: {
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
    fabricSize: {
        type: String,
        trim: true,
        default: ''
    },
    // Packing Slip & Roll Specifications
    rollNumber: {
        type: String,
        trim: true,
        maxlength: [25, 'Roll Number cannot exceed 25 characters']
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
    fabricLength: {
        type: Number,
        default: null,
        min: [1, 'Fabric Length must be at least 1 Meter'],
        max: [50000, 'Fabric Length cannot exceed 50000 Meters']
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
    },
    hsnCode: {
        type: String,
        trim: true,
        default: '39012000'
    },
    moq: {
        type: Number,
        default: 1000,
        min: [0, 'MOQ cannot be negative']
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
    lastPurchasePrice: {
        type: Number,
        default: 0,
        min: [0, 'Last purchase price cannot be negative']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isLowStockAlerted: {
        type: Boolean,
        default: false
    },
    lastLowStockAlertAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Compound unique indexes per tenant
RawMaterialSchema.index({ tenant: 1, code: 1 }, { unique: true });
RawMaterialSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RawMaterial', RawMaterialSchema);
