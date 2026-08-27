const mongoose = require('mongoose');

const QcInspectionSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    inspectionType: {
        type: String,
        enum: ['INBOUND', 'OUTBOUND'],
        default: 'OUTBOUND'
    },
    qcCertificateNumber: {
        type: String,
        required: [true, 'QC Certificate Number is required'],
        trim: true,
        uppercase: true
    },
    // Outbound QC Fields (Production -> Finished Goods)
    workOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkOrder'
    },
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood'
    },
    // Inbound QC Fields (GRN -> Raw Materials)
    grn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GRN'
    },
    po: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder'
    },
    rawMaterial: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawMaterial'
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    receivedQty: {
        type: Number,
        default: 0
    },
    // Shared Inspection Metrics
    sampleSize: {
        type: Number,
        default: 1,
        min: [1, 'Sample size must be at least 1']
    },
    passedQty: {
        type: Number,
        required: [true, 'Passed quantity is required'],
        min: [0, 'Passed quantity cannot be negative']
    },
    rejectedQty: {
        type: Number,
        required: [true, 'Rejected quantity is required'],
        min: [0, 'Rejected quantity cannot be negative']
    },
    tensileStrength: {
        type: Number,
        min: [0, 'Tensile strength cannot be negative']
    },
    gsmTested: {
        type: Number,
        min: [0, 'GSM tested cannot be negative']
    },
    defects: {
        type: String,
        trim: true
    },
    qcStatus: {
        type: String,
        required: [true, 'QC Status is required'],
        enum: {
            values: ['PASSED', 'FAILED', 'PARTIAL'],
            message: '{VALUE} is not a valid QC status.'
        }
    },
    inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Inspected by user is required']
    }
}, { timestamps: true });

QcInspectionSchema.index({ qcCertificateNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('QCInspection', QcInspectionSchema);
