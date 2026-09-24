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
    baseName: {
        type: String,
        trim: true,
        default: ''
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
        trim: true,
        default: ''
    },
    dimensions: {
        width: { type: Number, min: 0 },
        length: { type: Number, min: 0 },
        unit: { type: String, enum: ['cm', 'inch'], default: 'cm' }
    },
    dimensionUnit: {
        type: String,
        enum: ['cm', 'inch'],
        default: 'cm'
    },
    bagCapacity: {
        type: Number,
        min: [0, 'Bag capacity cannot be negative']
    },
    laminationType: {
        type: String,
        trim: true,
        default: 'UNLAMINATED'
    },
    printingSpec: {
        type: String,
        trim: true,
        default: 'UNPRINTED'
    },
    meshCount: {
        type: String,
        trim: true,
        default: '10x10'
    },
    tareWeightGram: {
        type: Number,
        min: 0,
        default: 0
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
    bagType: {
        type: String,
        trim: true,
        default: 'Laminated PP Woven Sack'
    },
    colorAndPrint: {
        type: String,
        trim: true,
        default: 'Milky White (2-Color Flexo)'
    },
    printSpec: {
        printSides: {
            type: String,
            enum: ['FRONT_ONLY', 'BACK_ONLY', 'BOTH', 'NONE'],
            default: 'NONE'
        },
        frontColours: { type: Number, default: 0, min: 0 },
        backColours: { type: Number, default: 0, min: 0 }
    },
    printSides: {
        type: String,
        enum: ['FRONT_ONLY', 'BACK_ONLY', 'BOTH', 'NONE', ''],
        default: 'NONE'
    },
    frontColours: { type: Number, default: 0, min: 0 },
    backColours: { type: Number, default: 0, min: 0 },
    warehouseLocation: {
        type: String,
        trim: true,
        default: 'Finished Goods Warehouse - Bay 1'
    },
    storageBayLocation: {
        type: String,
        trim: true,
        default: ''
    },
    pricePerBag: {
        type: Number,
        default: 0,
        min: [0, 'Price per bag cannot be negative']
    },
    retailPrice: {
        type: Number,
        default: 0,
        min: [0, 'Retail price cannot be negative']
    },
    wholesalePrice: {
        type: Number,
        default: 0,
        min: [0, 'Wholesale price cannot be negative']
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
