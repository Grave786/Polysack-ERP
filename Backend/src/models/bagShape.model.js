const mongoose = require('mongoose');

const BagShapeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Bag Shape name is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique index per tenant
BagShapeSchema.index({ name: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('BagShape', BagShapeSchema);
