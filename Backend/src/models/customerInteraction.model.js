const mongoose = require('mongoose');

const CustomerInteractionSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer reference is required']
    },
    date: {
        type: Date,
        default: Date.now
    },
    interactionType: {
        type: String,
        required: [true, 'Interaction type is required'],
        enum: {
            values: ['CALL', 'EMAIL', 'VISIT', 'FOLLOW_UP', 'MEETING', 'OTHER'],
            message: '{VALUE} is not a valid interaction type.'
        }
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    assignedExecutive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        default: 'OPEN',
        enum: {
            values: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
            message: '{VALUE} is not a valid interaction status.'
        }
    },
    nextFollowUpDate: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

CustomerInteractionSchema.index({ tenant: 1, customer: 1, date: -1 });
CustomerInteractionSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('CustomerInteraction', CustomerInteractionSchema);
