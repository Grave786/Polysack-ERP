const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    companyName: {
        type: String,
        trim: true
    },
    gstin: {
        type: String,
        trim: true,
        uppercase: true
    },
    stateCode: {
        type: String,
        trim: true
    },
    stateName: {
        type: String,
        trim: true
    },
    registeredAddress: {
        line1: { type: String, trim: true },
        line2: { type: String, trim: true },
        city: { type: String, trim: true },
        pincode: { type: String, trim: true }
    },
    pan: {
        type: String,
        trim: true,
        uppercase: true
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    contactPhone: {
        type: String,
        trim: true
    },
    logoUrl: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    enabledModules: {
        type: [String],
        default: [
            'MASTER_DATA',
            'PRODUCTION',
            'QUALITY',
            'INVENTORY',
            'POS',
            'SALES',
            'PROCUREMENT',
            'CRM',
            'DISPATCH',
            'HR',
            'ANALYTICS'
        ]
    },
    productionSettings: {
        activeStartingStage: {
            type: String,
            default: 'FLEXO_PRINTING',
            enum: [
                'TAPE_EXTRUSION',
                'CIRCULAR_WEAVING',
                'EXTRUSION_LAMINATION',
                'FLEXO_PRINTING',
                'CUTTING_SEWING',
                'STITCHING',
                'HANDLE_ATTACHMENT',
                'BALING_PACKING'
            ]
        },
        stageConfigs: [{
            stageName: { type: String, required: true },
            isEnabled: { type: Boolean, default: true }
        }]
    }
}, { timestamps: true });

// Pre-save hook to validate GSTIN/PAN and derive stateCode from GSTIN
TenantSchema.pre('save', function (next) {
    if (this.gstin) {
        const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/;
        if (!gstinRegex.test(this.gstin)) {
            return next(new Error('Invalid GSTIN format. Expected format: 24AAAAA0000A1Z5'));
        }

        const derivedStateCode = this.gstin.substring(0, 2);

        if (this.stateCode && this.stateCode !== derivedStateCode) {
            return next(new Error(`GSTIN state code prefix (${derivedStateCode}) does not match the provided stateCode (${this.stateCode}).`));
        }

        this.stateCode = derivedStateCode;
    }

    if (this.pan) {
        const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
        if (!panRegex.test(this.pan)) {
            return next(new Error('Invalid PAN format. Expected format: AAAAA0000A'));
        }
    }

    next();
});

module.exports = mongoose.model('Tenant', TenantSchema);
