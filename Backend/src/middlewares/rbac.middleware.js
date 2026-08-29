const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const Tenant = require('../models/tenant.model');

// In-memory TTL Cache for Tenant active status & enabledModules (10s TTL for fast live session enforcement)
const tenantStatusCache = new Map();
const CACHE_TTL_MS = 10000;

const DEFAULT_MODULES = [
    'MASTER_DATA', 'PRODUCTION', 'QUALITY', 'INVENTORY',
    'POS', 'SALES', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS'
];

// Helper to normalize tenant ID input (handles strings, ObjectIds, and populated objects)
const normalizeTenantId = (val) => {
    if (!val) return null;
    if (typeof val === 'object') {
        if (val._id) return String(val._id);
        if (val.id) return String(val.id);
    }
    return String(val);
};

const getCachedTenant = async (tenantIdInput) => {
    const tenantId = normalizeTenantId(tenantIdInput);
    if (!tenantId) return null;

    const cached = tenantStatusCache.get(tenantId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
        return cached.tenant;
    }

    const tenant = await Tenant.findById(tenantId).select('isActive enabledModules name companyName').lean();
    
    tenantStatusCache.set(tenantId, {
        tenant,
        expiresAt: now + CACHE_TTL_MS
    });

    return tenant;
};

const getCachedTenantStatus = async (tenantIdInput) => {
    const tenant = await getCachedTenant(tenantIdInput);
    if (!tenant) return true;
    return Boolean(tenant.isActive !== false);
};

// Invalidate tenant cache immediately upon status updates
const clearTenantStatusCache = (tenantIdInput) => {
    const tenantId = normalizeTenantId(tenantIdInput);
    if (tenantId) {
        // console.log(`🚨 [TENANT CACHE CLEARED] Invalidated cache key: ${tenantId}`);
        tenantStatusCache.delete(tenantId);
    } else {
        // console.log(`🚨 [TENANT CACHE CLEARED ALL] Flushed entire tenant status cache`);
        tenantStatusCache.clear();
    }
};

/**
 * Middleware: authenticate
 * Extracts and verifies the JWT Bearer token from the Authorization header.
 * Enforces live check on User.isActive and Tenant.isActive on every single request.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Check for Authorization header and Bearer scheme
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Authorization token missing or malformed.'
            });
        }

        // 2. Extract token string
        const token = authHeader.split(' ')[1];

        // 3. Verify token signature and expiration
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userId = decoded._id || decoded.id;
        const tenantId = normalizeTenantId(decoded.tenant);

        // 4. Live session enforcement: User account active status check
        if (userId) {
            const userDoc = await User.findById(userId).select('isActive').lean();
            if (!userDoc || userDoc.isActive === false) {
                return res.status(401).json({
                    success: false,
                    code: 'ACCOUNT_DEACTIVATED',
                    message: 'Your account is deactivated. Please contact your system administrator.'
                });
            }
        }

        // 5. Live session enforcement: Tenant active status check
        if (tenantId) {
            const isTenantActive = await getCachedTenantStatus(tenantId);
            if (!isTenantActive) {
                return res.status(401).json({
                    success: false,
                    code: 'TENANT_SUSPENDED',
                    message: "Your session has been terminated because your organization's account is suspended."
                });
            }
        }

        // Attach decoded payload (_id, role, tenant) to request object
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Authentication token has expired. Please log in again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token.'
            });
        }

        console.error('Error in authenticate middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.',
            error: error.message
        });
    }
};

/**
 * Middleware Factory: checkPermission
 * @param {string} requiredModule - Module name (e.g., 'INVENTORY', 'PRODUCTION', 'USERS')
 * @param {string} requiredAction - Action name (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 */
const checkPermission = (requiredModule, requiredAction) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required. User payload not found.'
                });
            }

            // 1. Fetch user and heavily populate role and nested permissions
            const user = await User.findById(userId).populate({
                path: 'role',
                populate: {
                    path: 'permissions'
                }
            });

            // 2. Verify user existence and active status
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User account not found.'
                });
            }

            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    code: 'ACCOUNT_DEACTIVATED',
                    message: 'Forbidden: Account is deactivated.'
                });
            }

            // Super Admin bypass check (system-level user without tenant or Super Admin email/role)
            const userRoleName = typeof user.role === 'object' ? user.role?.name : user.role;
            const isSuperAdmin = !user.tenant || user.email === process.env.SUPER_ADMIN_EMAIL || userRoleName === 'SUPER_ADMIN' || userRoleName === 'Super Admin';

            if (isSuperAdmin) {
                req.userDetails = user;
                return next();
            }

            // 3. Platform-level Tenant Module Entitlement Check (Bypassed for core account administration: USERS, ROLES, DASHBOARD)
            const CORE_ACCOUNT_MODULES = ['USERS', 'ROLES', 'DASHBOARD', 'ADMINISTRATION'];
            const targetModules = Array.isArray(requiredModule) ? requiredModule : [requiredModule];
            const requiresPlanEntitlement = targetModules.some((m) => !CORE_ACCOUNT_MODULES.includes(m));

            if (user.tenant && requiresPlanEntitlement) {
                const tenantDoc = await getCachedTenant(user.tenant);
                const enabledModules = (tenantDoc?.enabledModules && tenantDoc.enabledModules.length > 0)
                    ? tenantDoc.enabledModules
                    : DEFAULT_MODULES;

                const isAnyModuleEntitled = targetModules.some((m) => CORE_ACCOUNT_MODULES.includes(m) || enabledModules.includes(m));
                if (!isAnyModuleEntitled) {
                    return res.status(403).json({
                        success: false,
                        code: 'MODULE_DISABLED_FOR_TENANT',
                        message: "This module is not included in your organization's plan. Contact support to enable it."
                    });
                }
            }

            // 4. Verify user has a valid active role (auto-heal if user reference was orphaned)
            if ((!user.role || !user.role.isActive) && user.tenant) {
                const activeRole = await Role.findOne({ tenant: user.tenant, isActive: true }).populate('permissions');
                if (activeRole) {
                    console.log(`✅ [Auto-Heal RBAC] Re-linking user '${user.email}' (${user._id}) to active tenant role '${activeRole.name}' (${activeRole._id})`);
                    await User.updateOne({ _id: user._id }, { role: activeRole._id });
                    user.role = activeRole;
                }
            }

            if (!user.role || !user.role.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: User is not assigned an active role.'
                });
            }

            // 5. Check if role has matching permission for requiredModule and requiredAction
            const permissions = user.role.permissions || [];
            const hasPermission = permissions.some((perm) =>
                targetModules.includes(perm.module) && perm.action === requiredAction
            );

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: `Forbidden: You do not have permission to perform '${requiredAction}' action on '${requiredModule}' module.`
                });
            }

            // Attach populated user details to request object for downstream convenience
            req.userDetails = user;
            next();
        } catch (error) {
            console.error('Error in checkPermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during authorization check.',
                error: error.message
            });
        }
    };
};

/**
 * Middleware Factory: checkTenantModule
 * Specifically blocks API calls to a module if it is not enabled for the tenant.
 */
const checkTenantModule = (moduleKey) => {
    return async (req, res, next) => {
        try {
            const tenantId = req.user?.tenant;
            if (!tenantId) return next(); // Super Admin bypass

            const tenant = await getCachedTenant(tenantId);
            const enabledModules = (tenant?.enabledModules && tenant.enabledModules.length > 0)
                ? tenant.enabledModules
                : DEFAULT_MODULES;

            if (!enabledModules.includes(moduleKey.toUpperCase())) {
                return res.status(403).json({
                    success: false,
                    code: 'MODULE_DISABLED_FOR_TENANT',
                    message: "This module is not included in your organization's plan. Contact support to enable it."
                });
            }

            next();
        } catch (error) {
            console.error('Error in checkTenantModule middleware:', error);
            next();
        }
    };
};

module.exports = {
    authenticate,
    checkPermission,
    checkTenantModule,
    clearTenantStatusCache
};
