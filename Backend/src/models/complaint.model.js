const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    ticketNumber: {
        type: String,
        required: [true, 'Ticket Number is required'],
        trim: true,
        uppercase: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer reference is required']
    },
    relatedSalesOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        default: null
    },
    relatedInvoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        default: null
    },
    date: {
        type: Date,
        default: Date.now
    },
    complaintType: {
        type: String,
        required: [true, 'Complaint type is required'],
        enum: {
            values: [
                'QUALITY_DEFECT',
                'DELIVERY_DELAY',
                'QUANTITY_MISMATCH',
                'PRICE_DISCREPANCY',
                'PACKAGING_DAMAGE',
                'OTHER'
            ],
            message: '{VALUE} is not a valid complaint type.'
        }
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },
    assignedExecutive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        default: 'Open Ticket',
        enum: ['Open Ticket', 'Under Investigation', 'Resolved / CAPA Issued', 'Closed']
    },
    resolutionNotes: {
        type: String,
        trim: true
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

ComplaintSchema.index({ ticketNumber: 1, tenant: 1 }, { unique: true });
ComplaintSchema.index({ tenant: 1, customer: 1 });
ComplaintSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('Complaint', ComplaintSchema);
