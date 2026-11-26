const mongoose = require('mongoose');

const PartyAdvanceSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    partyType: {
        type: String,
        enum: ['CUSTOMER', 'SUPPLIER'],
        required: true
    },
    partyId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    entryType: {
        type: String,
        enum: ['CREDIT', 'ADJUSTMENT'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be greater than 0']
    },
    date: {
        type: Date,
        default: Date.now
    },
    paymentMode: {
        type: String,
        trim: true,
        default: 'UPI'
    },
    reference: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    paymentId: {
        type: String,
        trim: true,
        default: ''
    },
    documentModel: {
        type: String,
        enum: ['Invoice', 'PurchaseOrder', null],
        default: null
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    documentNumber: {
        type: String,
        trim: true,
        default: ''
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

PartyAdvanceSchema.index({ tenant: 1, partyType: 1, partyId: 1, date: -1 });

module.exports = mongoose.model('PartyAdvance', PartyAdvanceSchema);
