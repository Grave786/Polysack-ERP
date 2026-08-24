const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null
    },
    permissions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission'
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Ensure unique role name per tenant (or system-level role)
RoleSchema.index({ name: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema);