const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    approvalNo: {
        type: String,
        required: [true, 'Approval number is required'],
        unique: true,
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Approval type is required'],
        enum: ['NSL', 'PO', 'CONTINUATION_WO']
    },
    referenceModel: {
        type: String,
        required: [true, 'Reference model is required'],
        enum: ['OrderEnquiry', 'PurchaseOrder', 'WorkOrder']
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Reference ID is required'],
        refPath: 'referenceModel'
    },
    referenceNo: {
        type: String,
        trim: true,
        default: ''
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    summary: {
        type: String,
        trim: true,
        default: ''
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Requester user is required']
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    decidedAt: {
        type: Date,
        default: null
    },
    remarks: {
        type: String,
        trim: true,
        default: ''
    },
    reminderCount: {
        type: Number,
        default: 0
    },
    lastReminderAt: {
        type: Date,
        default: null
    },
    nextReminderAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

ApprovalSchema.index({ tenant: 1, status: 1, nextReminderAt: 1 });
ApprovalSchema.index({ tenant: 1, type: 1, referenceId: 1, status: 1 });
ApprovalSchema.index(
    { tenant: 1, type: 1, referenceId: 1 },
    { unique: true, partialFilterExpression: { status: 'Pending' } }
);
ApprovalSchema.index({ tenant: 1, approvalNo: 1 });

/**
 * Generate sequential approval number formatted as APR-YYYY-XXXX
 */
ApprovalSchema.statics.generateNextApprovalNo = async function (tenantId) {
    const year = new Date().getFullYear();
    const prefix = `APR-${year}-`;
    const lastDoc = await this.findOne({
        approvalNo: { $regex: `^${prefix}\\d{4,}$` }
    }).sort({ approvalNo: -1 });

    let nextNumber = 1;
    if (lastDoc && lastDoc.approvalNo) {
        const parts = lastDoc.approvalNo.split('-');
        if (parts.length === 3) {
            const lastSeq = parseInt(parts[2], 10);
            if (!isNaN(lastSeq)) {
                nextNumber = lastSeq + 1;
            }
        }
    }
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

module.exports = mongoose.model('Approval', ApprovalSchema);
