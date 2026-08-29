import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { isTenantModuleEnabled, checkIsSuperAdmin, checkIsTenantAdmin } from '../utils/permissionUtils';

export default function ProtectedRoute({ allowedRoles, requiredModule, requiredAction }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);
    const user = useAuthStore((state) => state.user);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-sidebar-bg text-primary font-sans text-sm font-semibold">
                Verifying authorization credentials...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user) {
        const isSuperAdmin = checkIsSuperAdmin(user);

        // 1. Super Admin Route Scoping
        if (isSuperAdmin) {
            // Super Admin must NOT access operational ERP modules
            if (requiredModule && ['PRODUCTION', 'QUALITY', 'INVENTORY', 'SALES', 'POS', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS', 'MASTER_DATA'].includes(requiredModule)) {
                return <Navigate to="/403" state={{ message: "Super Admin accounts do not access operational tenant modules directly." }} replace />;
            }
            return <Outlet />;
        }

        // 2. Tenant Module Entitlement Check (Platform-Level Plan Enforcement)
        if (requiredModule && !isTenantModuleEnabled(user, requiredModule)) {
            return (
                <Navigate
                    to="/403"
                    state={{ message: "This module is not included in your organization's plan. Contact support to enable it." }}
                    replace
                />
            );
        }

        // 3. Tenant User Permission Check (User RBAC)
        if (requiredModule) {
            if (checkIsTenantAdmin(user)) {
                return <Outlet />;
            }

            const permittedModules = user.permittedModules || [];
            const permissions = user.role?.permissions || user.permissions || [];

            let hasPerm = false;

            if (permittedModules.length > 0) {
                if (permittedModules.includes(requiredModule)) hasPerm = true;
                if (requiredModule === 'POS' && permittedModules.includes('SALES')) hasPerm = true;
            }

            if (!hasPerm && Array.isArray(permissions) && permissions.length > 0) {
                hasPerm = permissions.some((p) => {
                    const m = typeof p === 'object' ? p.module : String(p);
                    if (m === requiredModule) return true;
                    if (requiredModule === 'POS' && m.startsWith('SALES')) return true;
                    return m.startsWith(requiredModule);
                });
            }

            if (!hasPerm) {
                return <Navigate to="/403" state={{ message: "You don't have permission to access this module." }} replace />;
            }
        }
    }

    return <Outlet />;
}
