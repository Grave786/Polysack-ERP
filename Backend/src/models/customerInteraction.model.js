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
        default: null
    },
    customerName: {
        type: String,
        trim: true
    },
    enquiryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderEnquiry',
        default: null
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderEnquiry',
        default: null
    },
    date: {
        type: Date,
        default: Date.now
    },
    interactionType: {
        type: String,
        required: [true, 'Interaction type is required'],
        default: 'Phone Call',
        enum: [
            'Phone Call', 'Email Communication', 'In-Person Meeting', 'Site Visit', 'WhatsApp', 'Other / Escalation',
            'Phone', 'Call', 'CALL', 'Email', 'EMAIL', 'Meeting', 'MEETING', 'Visit', 'VISIT', 'Factory Visit',
            'WhatsApp Communication', 'FOLLOW_UP', 'Other', 'OTHER'
        ]
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    assignedExecutive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        default: 'OPEN',
        enum: [
            'OPEN', 'IN_PROGRESS', 'CLOSED', 'RESOLVED',
            'Open (Requires Follow-up)', 'In Progress', 'Closed (Resolved)', 'Resolved', 'Resolved / Complete',
            'Open', 'Closed', 'in_progress', 'open', 'closed', 'resolved'
        ]
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
