const mongoose = require('mongoose');
const { RAW_MATERIAL_ATTRIBUTE_TYPES } = require('../constants/rawMaterialAttributes.constants');

const RawMaterialAttributeSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    attributeType: {
        type: String,
        required: [true, 'Attribute type is required'],
        enum: RAW_MATERIAL_ATTRIBUTE_TYPES,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Attribute name is required'],
        trim: true
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

// Compound unique index per tenant and attributeType
RawMaterialAttributeSchema.index({ tenant: 1, attributeType: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RawMaterialAttribute', RawMaterialAttributeSchema);
