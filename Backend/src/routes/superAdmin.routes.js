const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { authenticate } = require('../middlewares/rbac.middleware');
const {
    getAllTenants,
    getTenantProfileByTenantId,
    updateTenantProfileByTenantId,
    toggleTenantStatus
} = require('../controllers/superAdmin.controller');

/**
 * Middleware: requireSuperAdmin
 * Ensures strictly system Super Admin users can hit /api/super-admin/* routes
 */
const requireSuperAdmin = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. User payload missing.'
            });
        }

        const user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userRoleName = typeof user.role === 'object' ? user.role?.name : user.role;
        const isSuperAdmin = Boolean(
            !user.tenant ||
            user.email === (process.env.SUPER_ADMIN_EMAIL || 'superadmin@polysack.com') ||
            userRoleName === 'SUPER_ADMIN' ||
            userRoleName === 'Super Admin'
        );

        if (!isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Super Admin access required for system platform routes.'
            });
        }

        req.userDetails = user;
        next();
    } catch (error) {
        console.error('Error in requireSuperAdmin middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authorization.'
        });
    }
};

// All super admin routes require authentication + super admin role check
router.use(authenticate);
router.use(requireSuperAdmin);

// Tenant Management Endpoints
router.get('/tenants', getAllTenants);
router.get('/tenants/:tenantId/company-profile', getTenantProfileByTenantId);
router.patch('/tenants/:tenantId/company-profile', updateTenantProfileByTenantId);
router.put('/tenants/:tenantId/company-profile', updateTenantProfileByTenantId);
router.patch('/tenants/:tenantId/status', toggleTenantStatus);

module.exports = router;
