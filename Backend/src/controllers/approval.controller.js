const mongoose = require('mongoose');
const Approval = require('../models/approval.model');
const User = require('../models/user.model');
const PurchaseOrder = require('../models/purchaseOrder.model');
const OrderEnquiry = require('../models/orderEnquiry.model');
const { isTenantAdmin } = require('../middlewares/rbac.middleware');
const {
    getApprovalHandler,
    markApprovalNotificationsRead,
    syncPendingPurchaseOrderApprovals
} = require('../services/approval.service');

/**
 * @desc    Get list of approvals with filtering, tabs and pagination (Tenant Admin only)
 * @route   GET /api/approvals
 * @access  Private (Tenant Admin only)
 */
const getApprovals = async (req, res) => {
    try {
        const isAdmin = await isTenantAdmin(req.user);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Approvals module is restricted to Tenant Admin only.' });
        }

        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        // Idempotently create missing Approvals for any pending POs in isolated try/catch (Requirement 2)
        try {
            await syncPendingPurchaseOrderApprovals(tenantId);
        } catch (syncErr) {
            console.error('[getApprovals] syncPendingPurchaseOrderApprovals error (non-fatal):', syncErr);
        }

        const {
            status,
            type,
            search,
            tab,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {
            tenant: new mongoose.Types.ObjectId(tenantId)
        };

        if (status && status !== 'All') {
            filter.status = status;
        }

        if (type && type !== 'All') {
            filter.type = type;
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { approvalNo: searchRegex },
                { referenceNo: searchRegex },
                { title: searchRegex },
                { summary: searchRegex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        // Fully defensive query using lean(), populating requester and decider, and safely referenceId
        let approvals = [];
        let total = 0;
        let pendingCount = 0;

        try {
            [approvals, total, pendingCount] = await Promise.all([
                Approval.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .populate('requestedBy', 'name email role')
                    .populate('decidedBy', 'name email role')
                    .populate('referenceId')
                    .lean(),
                Approval.countDocuments(filter),
                Approval.countDocuments({
                    tenant: new mongoose.Types.ObjectId(tenantId),
                    status: 'Pending'
                })
            ]);
        } catch (queryErr) {
            console.warn('[getApprovals] Query with referenceId populate encountered issue, falling back to basic fields:', queryErr.message);
            [approvals, total, pendingCount] = await Promise.all([
                Approval.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .populate('requestedBy', 'name email role')
                    .populate('decidedBy', 'name email role')
                    .lean(),
                Approval.countDocuments(filter),
                Approval.countDocuments({
                    tenant: new mongoose.Types.ObjectId(tenantId),
                    status: 'Pending'
                })
            ]);
        }

        return res.status(200).json({
            success: true,
            count: approvals.length,
            total,
            pendingCount,
            pagination: {
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: approvals
        });
    } catch (err) {
        console.error('Error in getApprovals:', err.stack || err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve approval requests.',
            error: err.message,
            stack: err.stack
        });
    }
};

/**
 * @desc    Get count of pending approvals for sidebar badge & topbar count
 * @route   GET /api/approvals/pending-count
 * @access  Private (Authenticated users)
 */
const getPendingCount = async (req, res) => {
    try {
        const isAdmin = await isTenantAdmin(req.user);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Approvals module is restricted to Tenant Admin only.', count: 0 });
        }

        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(200).json({ success: true, count: 0 });
        }

        // Idempotently create missing Approvals in isolated try/catch
        try {
            await syncPendingPurchaseOrderApprovals(tenantId);
        } catch (syncErr) {
            console.error('[getPendingCount] syncPendingPurchaseOrderApprovals error (non-fatal):', syncErr);
        }

        const count = await Approval.countDocuments({
            tenant: new mongoose.Types.ObjectId(tenantId),
            status: 'Pending'
        });

        return res.status(200).json({
            success: true,
            count
        });
    } catch (err) {
        console.error('Error in getPendingCount:', err.stack || err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending approvals count.',
            error: err.message,
            stack: err.stack
        });
    }
};

/**
 * @desc    Get single approval details by ID
 * @route   GET /api/approvals/:id
 * @access  Private (Authenticated users)
 */
const getApprovalById = async (req, res) => {
    try {
        const isAdmin = await isTenantAdmin(req.user);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Approvals module is restricted to Tenant Admin only.' });
        }

        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const idParam = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(idParam)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format.' });
        }
        const targetObjectId = new mongoose.Types.ObjectId(idParam);

        let approval = await Approval.findOne({
            tenant: new mongoose.Types.ObjectId(tenantId),
            $or: [
                { _id: targetObjectId },
                { referenceId: targetObjectId }
            ]
        })
            .populate('requestedBy', 'name email role')
            .populate('decidedBy', 'name email role')
            .populate('referenceId')
            .lean();

        if (!approval) {
            return res.status(404).json({
                success: false,
                message: 'Approval request not found.'
            });
        }

        // Deep populate sub-reference fields conditionally and safely
        try {
            if (approval.referenceId) {
                if (approval.referenceModel === 'PurchaseOrder' || approval.type === 'PO') {
                    const poDoc = await PurchaseOrder.findById(approval.referenceId._id || approval.referenceId)
                        .populate('supplier', 'name companyName contactPerson phone email address city gstin')
                        .populate('deliveryLocation', 'name code type')
                        .populate({ path: 'items.rawMaterial', select: 'name code uom' })
                        .lean();
                    if (poDoc) approval.referenceId = poDoc;
                } else if (approval.referenceModel === 'OrderEnquiry' || approval.type === 'NSL') {
                    const nslDoc = await OrderEnquiry.findById(approval.referenceId._id || approval.referenceId)
                        .populate('customer customerRef', 'companyName code name phone email gstin')
                        .lean();
                    if (nslDoc) approval.referenceId = nslDoc;
                }
            }
        } catch (subPopErr) {
            console.warn('[getApprovalById] Sub-populate error, using top-level doc:', subPopErr.message);
        }

        return res.status(200).json({
            success: true,
            data: approval
        });
    } catch (err) {
        console.error('Error in getApprovalById:', err.stack || err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve approval record.',
            error: err.message,
            stack: err.stack
        });
    }
};

/**
 * @desc    Approve an approval request
 * @route   POST /api/approvals/:id/approve
 * @access  Private (Tenant Admin or APPROVALS:APPROVE permission)
 */
const approveApproval = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const hasAccess = await isTenantAdmin(req.user);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Only Tenant Admins can approve requests.'
            });
        }

        const idParam = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(idParam)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format.' });
        }
        const targetObjectId = new mongoose.Types.ObjectId(idParam);

        // Prevent double decisions: update only if status is strictly "Pending"
        const updatedApproval = await Approval.findOneAndUpdate(
            {
                tenant: new mongoose.Types.ObjectId(tenantId),
                status: 'Pending',
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            },
            {
                $set: {
                    status: 'Approved',
                    decidedBy: new mongoose.Types.ObjectId(req.user._id || req.user.id),
                    decidedAt: new Date(),
                    remarks: req.body.remarks ? req.body.remarks.trim() : 'Approved',
                    nextReminderAt: null
                }
            },
            { new: true }
        );

        if (!updatedApproval) {
            const existing = await Approval.findOne({
                tenant: new mongoose.Types.ObjectId(tenantId),
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            });

            if (!existing) {
                return res.status(404).json({ success: false, message: 'Approval request not found.' });
            }

            return res.status(409).json({
                success: false,
                message: `This approval request was already ${existing.status.toLowerCase()} and cannot be decided again.`
            });
        }

        // Execute registered onApprove handler
        const handler = getApprovalHandler(updatedApproval.type);
        if (handler && handler.onApprove) {
            await handler.onApprove(updatedApproval);
        }

        // Side-effects (non-fatal)
        try {
            await markApprovalNotificationsRead(updatedApproval._id, tenantId);
        } catch (notifErr) {
            console.error('[approveApproval] Notification cleanup error (non-fatal):', notifErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Approval '${updatedApproval.approvalNo}' has been approved.`,
            data: updatedApproval
        });
    } catch (err) {
        console.error('Error in approveApproval:', err.stack || err);
        const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to approve request.',
            error: err.message
        });
    }
};

/**
 * @desc    Reject an approval request (remarks mandatory)
 * @route   POST /api/approvals/:id/reject
 * @access  Private (Tenant Admin or APPROVALS:APPROVE permission)
 */
const rejectApproval = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const remarks = (req.body.remarks || '').trim();
        if (!remarks) {
            return res.status(400).json({
                success: false,
                message: 'Remarks are mandatory when rejecting an approval request.'
            });
        }

        const hasAccess = await isTenantAdmin(req.user);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Only Tenant Admins can reject requests.'
            });
        }

        const idParam = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(idParam)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format.' });
        }
        const targetObjectId = new mongoose.Types.ObjectId(idParam);

        // Prevent double decisions: update only if status is strictly "Pending"
        const updatedApproval = await Approval.findOneAndUpdate(
            {
                tenant: new mongoose.Types.ObjectId(tenantId),
                status: 'Pending',
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            },
            {
                $set: {
                    status: 'Rejected',
                    decidedBy: new mongoose.Types.ObjectId(req.user._id || req.user.id),
                    decidedAt: new Date(),
                    remarks: remarks,
                    nextReminderAt: null
                }
            },
            { new: true }
        );

        if (!updatedApproval) {
            const existing = await Approval.findOne({
                tenant: new mongoose.Types.ObjectId(tenantId),
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            });

            if (!existing) {
                return res.status(404).json({ success: false, message: 'Approval request not found.' });
            }

            return res.status(409).json({
                success: false,
                message: `This approval request was already ${existing.status.toLowerCase()} and cannot be decided again.`
            });
        }

        // Execute registered onReject handler
        const handler = getApprovalHandler(updatedApproval.type);
        if (handler && handler.onReject) {
            await handler.onReject(updatedApproval);
        }

        // Side-effects (non-fatal)
        try {
            await markApprovalNotificationsRead(updatedApproval._id, tenantId);
        } catch (notifErr) {
            console.error('[rejectApproval] Notification cleanup error (non-fatal):', notifErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Approval '${updatedApproval.approvalNo}' has been rejected.`,
            data: updatedApproval
        });
    } catch (err) {
        console.error('Error in rejectApproval:', err.stack || err);
        const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to reject request.',
            error: err.message
        });
    }
};

/**
 * @desc    Cancel an approval request (only original requester, only while Pending)
 * @route   POST /api/approvals/:id/cancel
 * @access  Private (Requester only)
 */
const cancelApproval = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
        }

        const idParam = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(idParam)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format.' });
        }
        const targetObjectId = new mongoose.Types.ObjectId(idParam);

        const isAdmin = await isTenantAdmin(req.user);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Only Tenant Admins can cancel approval requests.' });
        }

        const updatedApproval = await Approval.findOneAndUpdate(
            {
                tenant: new mongoose.Types.ObjectId(tenantId),
                status: 'Pending',
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            },
            {
                $set: {
                    status: 'Cancelled',
                    decidedBy: new mongoose.Types.ObjectId(req.user._id || req.user.id),
                    decidedAt: new Date(),
                    remarks: req.body.remarks ? req.body.remarks.trim() : 'Cancelled by requester',
                    nextReminderAt: null
                }
            },
            { new: true }
        );

        if (!updatedApproval) {
            const existing = await Approval.findOne({
                tenant: new mongoose.Types.ObjectId(tenantId),
                $or: [
                    { _id: targetObjectId },
                    { referenceId: targetObjectId }
                ]
            });

            if (!existing) {
                return res.status(404).json({ success: false, message: 'Approval request not found.' });
            }

            if (String(existing.requestedBy) !== String(req.user._id)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Only the original requester can cancel this approval request.'
                });
            }

            return res.status(409).json({
                success: false,
                message: `Approval request is already ${existing.status.toLowerCase()} and cannot be cancelled.`
            });
        }

        // Mark notifications read (non-fatal)
        try {
            await markApprovalNotificationsRead(updatedApproval._id, tenantId);
        } catch (notifErr) {
            console.error('[cancelApproval] Notification cleanup error (non-fatal):', notifErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Approval request '${updatedApproval.approvalNo}' has been cancelled.`,
            data: updatedApproval
        });
    } catch (err) {
        console.error('Error in cancelApproval:', err.stack || err);
        const statusCode = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to cancel approval request.',
            error: err.message
        });
    }
};

module.exports = {
    getApprovals,
    getPendingCount,
    getApprovalById,
    approveApproval,
    rejectApproval,
    cancelApproval
};
