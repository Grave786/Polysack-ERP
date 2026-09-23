const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false // Exclude password by default
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null // Null indicates system-level user (e.g., Super Admin)
    },
    facility: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    facility_id: {
        type: String // Preserved for legacy string compatibility during migration
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique index for tenant-scoped user emails
UserSchema.index({ tenant: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);