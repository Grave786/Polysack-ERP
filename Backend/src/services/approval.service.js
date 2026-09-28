const mongoose = require('mongoose');
const Approval = require('../models/approval.model');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const OrderEnquiry = require('../models/orderEnquiry.model');

// Default reminder interval (2 hours)
const REMINDER_INTERVAL_HOURS = 2;

/**
 * Approval Handler Registry
 * Extensible for new approval types (e.g., PO, Discount, WorkOrder)
 */
const approvalRegistry = {
    NSL: {
        onApprove: async (approval, session) => {
            const query = { _id: approval.referenceId, tenant: approval.tenant };
            const update = {
                $set: {
                    status: 'Approved',
                    soApprovalStatus: 'Approved',
                    approvalRemarks: approval.remarks || 'Approved by Admin'
                }
            };
            if (session) {
                await OrderEnquiry.updateOne(query, update, { session });
            } else {
                await OrderEnquiry.updateOne(query, update);
            }
        },
        onReject: async (approval, session) => {
            const query = { _id: approval.referenceId, tenant: approval.tenant };
            const updateDoc = {
                status: 'Rejected',
                soApprovalStatus: 'Rejected',
                approvalRemarks: approval.remarks || 'Rejected by Admin'
            };
            if (approval.remarks) {
                updateDoc.remarks = `Rejected: ${approval.remarks}`;
            }
            const update = { $set: updateDoc };
            if (session) {
                await OrderEnquiry.updateOne(query, update, { session });
            } else {
                await OrderEnquiry.updateOne(query, update);
            }
        }
    },
    PO: {
        onApprove: async (approval, session) => {
            const PurchaseOrder = require('../models/purchaseOrder.model');
            const query = { _id: approval.referenceId, tenant: approval.tenant };
            const update = {
                $set: {
                    status: 'SENT_TO_SUPPLIER',
                    approvalRemarks: approval.remarks || 'Approved'
                }
            };
            if (session) {
                await PurchaseOrder.updateOne(query, update, { session });
            } else {
                await PurchaseOrder.updateOne(query, update);
            }
        },
        onReject: async (approval, session) => {
            const PurchaseOrder = require('../models/purchaseOrder.model');
            const query = { _id: approval.referenceId, tenant: approval.tenant };
            const updateDoc = {
                status: 'CANCELLED',
                approvalRemarks: approval.remarks || 'Rejected'
            };
            if (approval.remarks) {
                updateDoc.notes = `Rejected: ${approval.remarks}`;
            }
            const update = { $set: updateDoc };
            if (session) {
                await PurchaseOrder.updateOne(query, update, { session });
            } else {
                await PurchaseOrder.updateOne(query, update);
            }
        }
    }
};

/**
 * Register custom approval handlers dynamically
 */
const registerApprovalHandler = (type, handlers) => {
    approvalRegistry[type] = handlers;
};

/**
 * Get registered handlers for an approval type
 */
const getApprovalHandler = (type) => {
    return approvalRegistry[type] || null;
};

/**
/**
 * Notify all active Tenant Admins about a new pending approval (Requirement 3: Tenant Admin only)
 */
const notifyApprovers = async (tenantId, approval) => {
    try {
        if (!tenantId || !approval) return;

        const notifData = {
            tenant: new mongoose.Types.ObjectId(tenantId),
            type: 'APPROVAL_REQUEST',
            module: 'APPROVALS',
            title: `New Approval Request: ${approval.referenceNo || approval.approvalNo}`,
            message: `${approval.title || 'Approval Request'} (${approval.summary || 'Details pending'}) is waiting for approval.`,
            priority: 'HIGH',
            link: `/approvals?id=${approval._id}`,
            data: {
                approvalId: approval._id,
                approvalNo: approval.approvalNo,
                referenceNo: approval.referenceNo,
                type: approval.type,
                targetRole: 'Tenant Admin'
            },
            isRead: false
        };

        await Notification.create(notifData);
    } catch (err) {
        console.error('[Approval Notification] Failed to notify approvers:', err.message);
    }
};

/**
 * Notify the requester when their approval request has been decided (Disabled per Requirement 3)
 */
const notifyRequesterDecision = async () => {
    // Disabled: No notification goes to the requester per Requirement 3
    return;
};

/**
 * Create or retrieve an approval request for a Purchase Order
 */
const createPoApprovalRequest = async (poDoc, creatorUser) => {
    try {
        if (!poDoc || !poDoc.tenant) return null;
        const tenantId = poDoc.tenant;

        // Check if an approval already exists while Pending
        const existing = await Approval.findOne({
            tenant: new mongoose.Types.ObjectId(tenantId),
            type: 'PO',
            referenceId: new mongoose.Types.ObjectId(poDoc._id),
            status: 'Pending'
        });
        if (existing) return existing;

        const PurchaseOrder = require('../models/purchaseOrder.model');
        const populatedPo = await PurchaseOrder.findById(poDoc._id).populate('supplier', 'name companyName').lean();
        const supplierName = populatedPo?.supplier?.companyName || populatedPo?.supplier?.name || 'Supplier';
        const formattedTotal = Number(poDoc.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
        const summary = `${supplierName} | ₹${formattedTotal}`;

        const approvalNo = await Approval.generateNextApprovalNo(tenantId);
        const requestedBy = poDoc.createdBy || creatorUser?._id;

        // Fallback user if missing
        let validRequester = requestedBy;
        if (!validRequester) {
            const adminUser = await User.findOne({ tenant: tenantId, isActive: true }).sort({ createdAt: 1 }).lean();
            validRequester = adminUser?._id;
        }

        const approval = await Approval.create({
            tenant: new mongoose.Types.ObjectId(tenantId),
            approvalNo,
            type: 'PO',
            referenceModel: 'PurchaseOrder',
            referenceId: poDoc._id,
            referenceNo: poDoc.poNumber,
            title: `PO Approval: ${poDoc.poNumber}`,
            summary,
            requestedBy: validRequester,
            status: 'Pending',
            reminderCount: 0,
            nextReminderAt: new Date(Date.now() + REMINDER_INTERVAL_HOURS * 60 * 60 * 1000)
        });

        // Reuse / update existing PO notification if one was created, otherwise create new
        const existingNotif = await Notification.findOne({
            tenant: new mongoose.Types.ObjectId(tenantId),
            $or: [
                { 'data.poId': poDoc._id },
                { 'data.approvalId': approval._id }
            ]
        });

        if (existingNotif) {
            existingNotif.data = {
                ...existingNotif.data,
                approvalId: approval._id,
                approvalNo: approval.approvalNo,
                referenceNo: approval.referenceNo,
                type: 'PO',
                poId: poDoc._id,
                poNumber: poDoc.poNumber
            };
            existingNotif.link = `/approvals?id=${approval._id}`;
            existingNotif.title = `PO Pending Approval: ${poDoc.poNumber}`;
            existingNotif.isRead = false;
            await existingNotif.save();
        } else {
            await notifyApprovers(tenantId, approval);
        }

        return approval;
    } catch (err) {
        console.error('[Approval Service] Error creating PO approval request:', err.message);
        return null;
    }
};

/**
 * Idempotent function to sync missing Approval records for POs currently in PENDING_APPROVAL status.
 * Called inside GET /approvals for the tenant (cheap, safe to run repeatedly).
 */
const syncPendingPurchaseOrderApprovals = async (tenantId) => {
    try {
        if (!tenantId) return;
        const PurchaseOrder = require('../models/purchaseOrder.model');

        // Only scan POs with status 'PENDING_APPROVAL' for this tenant
        const pendingPOs = await PurchaseOrder.find({
            tenant: new mongoose.Types.ObjectId(tenantId),
            status: 'PENDING_APPROVAL'
        }).lean();

        for (const po of pendingPOs) {
            const hasPendingApproval = await Approval.findOne({
                tenant: new mongoose.Types.ObjectId(tenantId),
                type: 'PO',
                referenceId: po._id,
                status: 'Pending'
            });

            if (!hasPendingApproval) {
                await createPoApprovalRequest(po, null);
            }
        }
    } catch (err) {
        console.error('[Approval Service] Error syncing pending PO approvals:', err.message);
    }
};

/**
 * Mark all notifications for this approval as read/resolved
 */
const markApprovalNotificationsRead = async (approvalId, tenantId) => {
    try {
        if (!approvalId || !tenantId) return;
        const approval = await Approval.findById(approvalId).lean();
        const orConditions = [
            { 'data.approvalId': new mongoose.Types.ObjectId(approvalId) }
        ];
        if (approval?.referenceId) {
            orConditions.push({ 'data.poId': approval.referenceId });
            orConditions.push({ 'data.referenceId': approval.referenceId });
        }
        await Notification.updateMany(
            {
                tenant: new mongoose.Types.ObjectId(tenantId),
                $or: orConditions
            },
            {
                $set: { isRead: true, readAt: new Date() }
            }
        );
    } catch (err) {
        console.error('[Approval Notification] Failed to mark notifications as read:', err.message);
    }
};

/**
 * Server-side Reminder Scheduler
 * Runs every 5 minutes.
 * Atomically claims pending approvals with nextReminderAt <= now using findOneAndUpdate.
 * Refreshes the existing notification or creates a new one if none exists.
 */
let reminderIntervalTimer = null;

const runApprovalReminderCheck = async () => {
    try {
        const now = new Date();
        // Find candidate approvals that are ready for a reminder
        const pendingCandidates = await Approval.find({
            status: 'Pending',
            nextReminderAt: { $lte: now }
        }).select('_id tenant approvalNo referenceNo summary title reminderCount referenceId').lean();

        for (const candidate of pendingCandidates) {
            try {
                const nextReminderTime = new Date(now.getTime() + REMINDER_INTERVAL_HOURS * 60 * 60 * 1000);

                // Atomic claim prevents duplicate reminders across concurrent runs or processes
                const claimed = await Approval.findOneAndUpdate(
                    {
                        _id: candidate._id,
                        status: 'Pending',
                        nextReminderAt: { $lte: now }
                    },
                    {
                        $set: {
                            lastReminderAt: now,
                            nextReminderAt: nextReminderTime
                        },
                        $inc: { reminderCount: 1 }
                    },
                    { new: true }
                );

                if (!claimed) {
                    // Already claimed or decided
                    continue;
                }

                const reminderNum = claimed.reminderCount;
                const refLabel = claimed.referenceNo || claimed.approvalNo;
                const reminderText = `Reminder #${reminderNum}: ${refLabel} is waiting for your approval`;
                const reminderTitle = `Reminder #${reminderNum}: ${refLabel}`;

                // Update existing notification or create if not present
                const existingNotif = await Notification.findOne({
                    tenant: claimed.tenant,
                    $or: [
                        { 'data.approvalId': claimed._id },
                        { 'data.poId': claimed.referenceId },
                        { 'data.referenceNo': claimed.referenceNo }
                    ]
                });

                if (existingNotif) {
                    existingNotif.isRead = false;
                    existingNotif.readAt = null;
                    existingNotif.title = reminderTitle;
                    existingNotif.message = reminderText;
                    existingNotif.priority = 'HIGH';
                    if (!existingNotif.data?.approvalId) {
                        existingNotif.data = { ...existingNotif.data, approvalId: claimed._id };
                    }
                    existingNotif.link = `/approvals?id=${claimed._id}`;
                    await existingNotif.save();
                } else {
                    await Notification.create({
                        tenant: claimed.tenant,
                        type: 'APPROVAL_REMINDER',
                        module: 'APPROVALS',
                        title: reminderTitle,
                        message: reminderText,
                        priority: 'HIGH',
                        link: `/approvals?id=${claimed._id}`,
                        data: {
                            approvalId: claimed._id,
                            approvalNo: claimed.approvalNo,
                            referenceNo: claimed.referenceNo,
                            type: claimed.type,
                            poId: claimed.referenceId
                        },
                        isRead: false
                    });
                }
            } catch (itemErr) {
                console.error(`[Approval Reminder Job] Error processing approval ${candidate._id}:`, itemErr.message);
            }
        }
    } catch (err) {
        console.error('[Approval Reminder Job] Error in scheduler execution:', err.message);
    }
};

const startApprovalReminderScheduler = () => {
    if (reminderIntervalTimer) {
        clearInterval(reminderIntervalTimer);
    }
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    // Initial run after short delay to let DB warm up
    setTimeout(runApprovalReminderCheck, 10000);
    reminderIntervalTimer = setInterval(runApprovalReminderCheck, FIVE_MINUTES_MS);
    console.log('✅ Approval reminder scheduler initialized (every 5 minutes).');
};

module.exports = {
    REMINDER_INTERVAL_HOURS,
    approvalRegistry,
    registerApprovalHandler,
    getApprovalHandler,
    createPoApprovalRequest,
    syncPendingPurchaseOrderApprovals,
    notifyApprovers,
    notifyRequesterDecision,
    markApprovalNotificationsRead,
    runApprovalReminderCheck,
    startApprovalReminderScheduler
};
