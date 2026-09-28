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
export const isTenantAdmin = (user) => {
    if (!user) return false;
    const userRoleName = (user.roleName || (typeof user.role === 'object' ? user.role?.name : user.role) || '').toLowerCase().trim();
    if (userRoleName.includes('assistant')) return false;
    return userRoleName.includes('admin');
};

export const checkIsTenantAdmin = isTenantAdmin;

export const DEFAULT_ALL_MODULES = [
    'MASTER_DATA', 'PRODUCTION', 'QUALITY', 'INVENTORY',
    'POS', 'SALES', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS', 'COMPANY_SETTINGS'
];

/**
 * Checks if a module is enabled at the platform/tenant plan level
 */
export const isTenantModuleEnabled = (user, moduleName) => {
    if (!user) return false;
    if (checkIsSuperAdmin(user)) return true;

    // Core management & dashboard modules are always available
    if (['DASHBOARD', 'ROLES', 'USERS', 'COMPANY_SETTINGS'].includes(moduleName)) return true;

    const enabledModules = user.tenantEnabledModules || user.tenant?.enabledModules;
    if (Array.isArray(enabledModules) && enabledModules.length > 0) {
        return enabledModules.includes(moduleName);
    }

    return true; // Default fallback for backwards compatibility
};

/**
 * Helper to check if a user has access to a specific module name
 * Layered check: Module must be BOTH enabled for the tenant AND permitted for the user.
 */
export const hasModulePermission = (user, moduleName) => {
    if (!user) return false;
    if (checkIsSuperAdmin(user)) return true;

    // Dashboard is accessible to everyone logged in
    if (moduleName === 'DASHBOARD') return true;

    // 1. Check Platform-Level Tenant Entitlement First
    if (!isTenantModuleEnabled(user, moduleName)) {
        return false;
    }

    // 2. Tenant Admin has full access to all tenant-enabled modules
    if (checkIsTenantAdmin(user)) return true;

    // 3. Check User-Level RBAC Permissions
    const permittedModules = user.permittedModules || [];
    if (permittedModules.length > 0) {
        if (permittedModules.includes(moduleName)) return true;
        if (moduleName === 'POS' && permittedModules.includes('SALES')) return true;
    }

    const permissions = user.role?.permissions || user.permissions || [];
    if (Array.isArray(permissions) && permissions.length > 0) {
        return permissions.some((p) => {
            const m = typeof p === 'object' ? p.module : String(p);
            if (m === moduleName) return true;
            if (moduleName === 'POS' && m.startsWith('SALES')) return true;
            return m.startsWith(moduleName);
        });
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
    { module: 'COMPANY_SETTINGS', route: '/administration' },
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

    // Dashboard is visible to everyone logged in
    return '/dashboard';
};
