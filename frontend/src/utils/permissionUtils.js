/**
 * Permission Utilities for PolySack ERP
 * Single source of truth for checking module permissions and resolving landing routes.
 */

/**
 * Helper to check if a user is a Super Admin
 */
export const checkIsSuperAdmin = (user) => {
    if (!user) return false;
    const userRoleName = (user.roleName || (typeof user.role === 'object' ? user.role?.name : user.role) || '').toLowerCase();
    return Boolean(
        user.isSuperAdmin ||
        !user.tenant ||
        user.email === 'superadmin@polysack.com' ||
        userRoleName === 'super admin' ||
        userRoleName === 'super_admin'
    );
};

/**
 * Helper to check if a user is a Tenant Admin
 */
export const checkIsTenantAdmin = (user) => {
    if (!user) return false;
    const userRoleName = (user.roleName || (typeof user.role === 'object' ? user.role?.name : user.role) || '').toLowerCase();
    return userRoleName.includes('admin') || userRoleName.includes('tenant admin');
};

/**
 * Helper to check if a user has access to a specific module name
 * (e.g. 'DASHBOARD', 'ROLES', 'USERS', 'PRODUCTION', 'INVENTORY', 'PROCUREMENT', etc.)
 */
export const hasModulePermission = (user, moduleName) => {
    if (!user) return false;
    if (checkIsSuperAdmin(user) || checkIsTenantAdmin(user)) return true;

    const permittedModules = user.permittedModules || [];
    if (permittedModules.length > 0) {
        return permittedModules.includes(moduleName);
    }

    const permissions = user.role?.permissions || user.permissions || [];
    if (Array.isArray(permissions) && permissions.length > 0) {
        return permissions.some((p) =>
            typeof p === 'object' ? p.module === moduleName : String(p).startsWith(moduleName)
        );
    }

    return false;
};

/**
 * Priority ordering of modules and their primary route paths
 */
const MODULE_ROUTE_MAP = [
    { module: 'DASHBOARD', route: '/dashboard' },
    { module: 'MASTER_DATA', route: '/master-data' },
    { module: 'PRODUCTION', route: '/production' },
    { module: 'QUALITY', route: '/quality' },
    { module: 'INVENTORY', route: '/inventory' },
    { module: 'SALES', route: '/sales' },
    { module: 'PROCUREMENT', route: '/procurement' },
    { module: 'CRM', route: '/customer-crm' },
    { module: 'DISPATCH', route: '/dispatch' },
    { module: 'HR', route: '/attendance' },
    { module: 'ANALYTICS', route: '/analytics' },
    { module: 'ROLES', route: '/administration/roles' },
    { module: 'USERS', route: '/administration/users' }
];

/**
 * Resolves the primary landing route for a user based on their permitted modules.
 * Returns the first route matching a permitted module, or '/403' if zero modules permitted.
 */
export const getFirstPermittedRoute = (user) => {
    if (!user) return '/login';

    if (checkIsSuperAdmin(user) || checkIsTenantAdmin(user)) return '/dashboard';

    // If user has explicit permission for DASHBOARD
    if (hasModulePermission(user, 'DASHBOARD')) {
        return '/dashboard';
    }

    // Find the first route matching a permitted module in priority order
    for (const item of MODULE_ROUTE_MAP) {
        if (hasModulePermission(user, item.module)) {
            return item.route;
        }
    }

    // Fallback: If user has zero permitted modules
    return '/403';
};
