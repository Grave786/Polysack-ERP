const mongoose = require('mongoose');

const UomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'UOM name is required'],
        trim: true
    },
    symbol: {
        type: String,
        required: [true, 'UOM symbol is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    type: {
        type: String,
        required: [true, 'UOM type is required'],
        enum: {
            values: ['WEIGHT', 'LENGTH', 'VOLUME', 'COUNT'],
            message: '{VALUE} is not a valid UOM type. Must be WEIGHT, LENGTH, VOLUME, or COUNT'
        }
    },
    isBaseUnit: {
        type: Boolean,
        default: false
    },
    conversionFactor: {
        type: Number,
        default: 1,
        min: [0.000001, 'Conversion factor must be greater than 0']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
UomSchema.index({ name: 1, tenant: 1 }, { unique: true });
UomSchema.index({ symbol: 1, tenant: 1 }, { unique: true });

// Pre-save validation: ensure only one base unit per (tenant, type)
UomSchema.pre('save', async function (next) {
    if (this.isBaseUnit) {
        const existingBase = await this.constructor.findOne({
            tenant: this.tenant,
            type: this.type,
            isBaseUnit: true,
            _id: { $ne: this._id }
        });

        if (existingBase) {
            const err = new Error(
                `A base unit already exists for type '${this.type}' in this tenant: '${existingBase.name}' (${existingBase.symbol}). Only one base unit is allowed per type per tenant.`
            );
            err.name = 'ValidationError';
            return next(err);
        }
    }
    next();
});

module.exports = mongoose.model('UOM', UomSchema);
