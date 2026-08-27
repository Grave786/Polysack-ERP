import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ShieldX, LayoutDashboard, LogOut, User } from 'lucide-react';
import { getFirstPermittedRoute } from '../utils/permissionUtils';

export default function Forbidden403Page() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);

    const userName = user?.name || user?.username || user?.email?.split('@')[0] || 'User';
    const userRole = user?.roleName || (typeof user?.role === 'object' ? user.role?.name : user?.role) || (user?.isSuperAdmin ? 'Super Admin' : 'Staff');

    const customMessage = location.state?.message;

    const handleLogout = async () => {
        if (typeof logout === 'function') {
            await logout();
        }
        navigate('/login', { replace: true });
    };

    const handleGoHome = () => {
        const target = getFirstPermittedRoute(user);
        if (target === '/403') {
            navigate('/login', { replace: true });
        } else {
            navigate(target, { replace: true });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-sidebar-bg p-6 font-sans">
            <div className="w-full max-w-md bg-sidebar-hover border border-sidebar-hover rounded-2xl p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
                {/* Access Denied Shield Icon */}
                <div className="w-16 h-16 mx-auto bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 shadow-inner">
                    <ShieldX size={34} />
                </div>

                {/* Heading & Message */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-sidebar-text-active tracking-tight">
                        403 — Access Denied
                    </h2>
                    <p className="text-xs text-sidebar-text leading-relaxed max-w-xs mx-auto">
                        {customMessage || "You don't have permission to view this page. Contact your administrator if you believe this is a mistake."}
                    </p>
                </div>

                {/* Logged in User Badge */}
                <div className="p-3.5 bg-sidebar-bg/70 border border-sidebar-hover rounded-xl flex items-center justify-between text-xs text-sidebar-text text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                            <User size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase font-bold text-sidebar-text/70 tracking-wider">
                                Logged in as
                            </div>
                            <div className="font-bold text-sidebar-text-active truncate text-xs">
                                {userName}
                            </div>
                        </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold text-[11px]">
                        {userRole}
                    </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-lg text-xs transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <LayoutDashboard size={16} />
                        <span>Go to Main Page</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="py-2.5 px-4 bg-sidebar-bg border border-sidebar-hover hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 text-sidebar-text-active font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </div>

                {/* Footer Note */}
                <div className="pt-4 border-t border-sidebar-hover/60 text-[11px] text-sidebar-text/60">
                    PolySack ERP Security Guard • Role Based Access Control
                </div>
            </div>
        </div>
    );
}
