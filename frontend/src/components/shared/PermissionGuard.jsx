import { useAuthStore } from '../../store/authStore';

export default function PermissionGuard({
    module,
    action,
    requiredPermission, // e.g. "SALES:CREATE"
    allowedRoles = [], // e.g. ['Tenant Admin', 'Super Admin', 'Biller']
    fallback = null,
    children
}) {
    const user = useAuthStore((state) => state.user);

    if (!user) return fallback;

    const userRoleName = user.roleName || user.role?.name || '';
    const isAdmin = userRoleName.toLowerCase().includes('admin') || userRoleName === 'Super Admin';

    // Admins bypass granular permission checks
    if (isAdmin) {
        return children;
    }

    // Role check if allowedRoles prop is provided
    if (allowedRoles.length > 0) {
        const hasMatchingRole = allowedRoles.some(
            (r) => r.toLowerCase() === userRoleName.toLowerCase()
        );
        if (!hasMatchingRole) return fallback;
    }

    // Parse module and action from requiredPermission string e.g. "SALES:CREATE"
    let targetModule = module;
    let targetAction = action;

    if (requiredPermission && requiredPermission.includes(':')) {
        const parts = requiredPermission.split(':');
        targetModule = parts[0];
        targetAction = parts[1];
    }

    // Check role permissions array
    if (targetModule && targetAction) {
        const permissions = user.role?.permissions || user.permissions || [];
        const hasPerm = Array.isArray(permissions) && permissions.some(
            (p) => (typeof p === 'object' ? p.module === targetModule && p.action === targetAction : p === `${targetModule}:${targetAction}`)
        );

        if (!hasPerm) {
            return fallback;
        }
    }

    return children;
}
