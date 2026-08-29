const Notification = require('../models/notification.model');
const { syncLowStockNotifications } = require('../services/notification.service');

/**
 * @desc    Get all notifications for the tenant (with on-the-fly sync of low-stock & pending POs)
 * @route   GET /api/notifications
 * @access  Private (Authenticated users)
 */
const getNotifications = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            // Super Admin has no tenant-scoped notifications
            return res.status(200).json({
                success: true,
                count: 0,
                unreadCount: 0,
                data: []
            });
        }

        const { type, isRead, limit = 50 } = req.query;

        // Auto-sync unalerted low stock raw materials and pending POs
        await syncLowStockNotifications(tenantId);

        const filter = { tenant: tenantId };
        if (type) filter.type = type;
        if (isRead !== undefined) {
            filter.isRead = isRead === 'true' || isRead === true;
        }

        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const [notifications, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ isRead: 1, createdAt: -1 })
                .limit(limitNum)
                .lean(),
            Notification.countDocuments({ tenant: tenantId, isRead: false })
        ]);

        return res.status(200).json({
            success: true,
            count: notifications.length,
            unreadCount,
            data: notifications
        });
    } catch (error) {
        console.error('Error in getNotifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications.',
            error: error.message
        });
    }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private (Authenticated users)
 */
const getUnreadCount = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(200).json({
                success: true,
                unreadCount: 0
            });
        }

        const unreadCount = await Notification.countDocuments({
            tenant: tenantId,
            isRead: false
        });

        return res.status(200).json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Error in getUnreadCount:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch unread count.',
            error: error.message
        });
    }
};

/**
 * @desc    Mark single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private (Authenticated users)
 */
const markAsRead = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, tenant: tenantId },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification marked as read.',
            data: notification
        });
    } catch (error) {
        console.error('Error in markAsRead:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read.',
            error: error.message
        });
    }
};

/**
 * @desc    Mark all notifications as read for current tenant
 * @route   PATCH /api/notifications/read-all
 * @access  Private (Authenticated users)
 */
const markAllAsRead = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        await Notification.updateMany(
            { tenant: tenantId, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        return res.status(200).json({
            success: true,
            message: 'All notifications marked as read.'
        });
    } catch (error) {
        console.error('Error in markAllAsRead:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read.',
            error: error.message
        });
    }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private (Authenticated users)
 */
const deleteNotification = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const result = await Notification.findOneAndDelete({
            _id: req.params.id,
            tenant: tenantId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification dismissed successfully.'
        });
    } catch (error) {
        console.error('Error in deleteNotification:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete notification.',
            error: error.message
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
