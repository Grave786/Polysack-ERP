const mongoose = require('mongoose');

const BomItemSchema = new mongoose.Schema({
    rawMaterial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial',
        required: [true, 'Raw material is required in BOM item']
    },
    quantityPerUnit: {
        type: Number,
        required: [true, 'Quantity per unit is required'],
        min: [0.0001, 'Quantity per unit must be greater than 0']
    }
}, { _id: false });

const BomSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood',
        required: [true, 'Finished Good is required']
    },
    name: {
        type: String,
        trim: true
    },
    items: {
        type: [BomItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'BOM must contain at least one item.'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Note: Application-level logic enforces one active BOM per (finishedGood, tenant)
// allowing multiple historical/inactive BOMs to exist.

module.exports = mongoose.model('BOM', BomSchema);
