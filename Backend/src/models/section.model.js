const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Section name is required'],
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

// Compound unique index per tenant (case-insensitive via collation or unique trim)
SectionSchema.index({ name: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Section', SectionSchema);
