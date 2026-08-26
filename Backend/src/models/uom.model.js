const mongoose = require('mongoose');

const UomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'UOM name is required'],
        trim: true
    },
    abbreviation: {
        type: String,
        trim: true
    },
    symbol: {
        type: String,
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    type: {
        type: String,
        default: 'COUNT',
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

// Sync abbreviation and symbol before validation
UomSchema.pre('validate', function (next) {
    if (!this.abbreviation && this.symbol) {
        this.abbreviation = this.symbol;
    }
    if (!this.symbol && this.abbreviation) {
        this.symbol = this.abbreviation;
    }
    next();
});

// Compound unique indexes per tenant
UomSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('UOM', UomSchema);
