const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    type: {
        type: String,
        required: [true, 'Notification type is required'],
        enum: ['LOW_STOCK', 'PO_APPROVAL', 'STOCK_ALERT', 'DISPATCH_ALERT', 'SYSTEM']
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'HIGH'
    },
    module: {
        type: String,
        enum: ['INVENTORY', 'PROCUREMENT', 'PRODUCTION', 'SALES', 'QUALITY', 'SYSTEM'],
        default: 'INVENTORY'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    link: {
        type: String,
        default: ''
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Compound indexes for efficient querying
NotificationSchema.index({ tenant: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ tenant: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
