import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

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
        const isAdmin = userRoleName.includes('admin') || userRoleName === 'super admin';

        // Admins bypass role/permission blocks
        if (!isAdmin) {
            // Check allowedRoles if specified
            if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
                const hasAllowedRole = allowedRoles.some((r) => r.toLowerCase() === userRoleName);
                if (!hasAllowedRole) {
                    toast.error('Access denied: You do not have the required role for this page.');
                    return <Navigate to="/dashboard" replace />;
                }
            }

            // Check requiredModule and requiredAction if specified
            if (requiredModule && requiredAction) {
                const permissions = user.role?.permissions || user.permissions || [];
                const hasPerm = Array.isArray(permissions) && permissions.some(
                    (p) => (typeof p === 'object' ? p.module === requiredModule && p.action === requiredAction : p === `${requiredModule}:${requiredAction}`)
                );

                if (!hasPerm) {
                    toast.error(`Access denied: Required permission '${requiredModule}:${requiredAction}' missing.`);
                    return <Navigate to="/dashboard" replace />;
                }
            }
        }
    }

    return <Outlet />;
}
