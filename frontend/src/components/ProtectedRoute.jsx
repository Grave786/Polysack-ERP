import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

let isAccessDeniedToastShowing = false;

const showSingleAccessDeniedToast = (msg) => {
    if (!isAccessDeniedToastShowing) {
        isAccessDeniedToastShowing = true;
        toast.error(msg || 'Access Denied: You do not have permission to access this module.');
        setTimeout(() => {
            isAccessDeniedToastShowing = false;
        }, 3000);
    }
};

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
        const userRoleName = (user.roleName || (typeof user.role === 'object' ? user.role?.name : user.role) || '').toLowerCase();
        const isSuperAdmin = Boolean(user.isSuperAdmin || !user.tenant || user.email === 'superadmin@polysack.com' || userRoleName === 'super admin' || userRoleName === 'super_admin');

        // 1. Super Admin Route Scoping
        if (isSuperAdmin) {
            // Super Admin must NOT access operational ERP modules
            if (requiredModule && ['PRODUCTION', 'QUALITY', 'INVENTORY', 'SALES', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS', 'MASTER_DATA'].includes(requiredModule)) {
                return <Navigate to="/403" replace />;
            }
            return <Outlet />;
        }

        // 2. Tenant User Permission Check
        if (requiredModule) {
            const permittedModules = user.permittedModules || [];
            const permissions = user.role?.permissions || user.permissions || [];

            let hasPerm = false;

            if (permittedModules.length > 0) {
                hasPerm = permittedModules.includes(requiredModule);
            }

            if (!hasPerm && Array.isArray(permissions) && permissions.length > 0) {
                hasPerm = permissions.some((p) => {
                    if (typeof p === 'object') {
                        if (requiredAction) {
                            return p.module === requiredModule && p.action === requiredAction;
                        }
                        return p.module === requiredModule;
                    }
                    return String(p).startsWith(requiredModule);
                });
            }

            // Tenant Admin role fallback for all modules
            if (userRoleName.includes('admin') || userRoleName.includes('tenant admin')) {
                hasPerm = true;
            }

            if (!hasPerm) {
                return <Navigate to="/403" replace />;
            }
        }
    }

    return <Outlet />;
}
