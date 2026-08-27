const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Location name is required'],
        trim: true
    },
    code: {
        type: String,
        required: [true, 'Location code is required'],
        trim: true,
        uppercase: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    type: {
        type: String,
        required: [true, 'Location type is required'],
        set: (val) => val ? String(val).trim().toUpperCase().replace(/[-\s]+/g, '_') : val,
        enum: {
            values: ['FACTORY', 'WAREHOUSE', 'GODOWN', 'DISPATCH_ZONE', 'PRODUCTION_FLOOR'],
            message: '{VALUE} is not a valid location type.'
        }
    },
    address: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique indexes per tenant
LocationSchema.index({ name: 1, tenant: 1 }, { unique: true });
LocationSchema.index({ code: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Location', LocationSchema);
