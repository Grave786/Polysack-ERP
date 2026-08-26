import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Database,
    Factory,
    ShieldCheck,
    Boxes,
    CreditCard,
    Receipt,
    ShoppingBag,
    Contact,
    Truck,
    UserCheck,
    BarChart3,
    Settings,
    User,
    Users,
    X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const SIDEBAR_SECTIONS = [
    {
        title: 'CORE ERP',
        items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Master Data', path: '/master-data', icon: Database, module: 'MASTER_DATA' }
        ]
    },
    {
        title: 'OPERATIONS',
        items: [
            { name: 'Production', path: '/production', icon: Factory, module: 'PRODUCTION', blockedRoles: ['biller', 'sales operator'] },
            { name: 'Quality Control', path: '/quality', icon: ShieldCheck, module: 'QUALITY' },
            { name: 'Inventory & Stock', path: '/inventory', icon: Boxes, module: 'INVENTORY' }
        ]
    },
    {
        title: 'COMMERCIAL',
        items: [
            { name: 'POS Billing Terminal', path: '/pos', icon: CreditCard, module: 'SALES', blockedRoles: ['production manager', 'qa inspector'] },
            { name: 'Sales & Billing', path: '/sales', icon: Receipt, module: 'SALES' },
            { name: 'Purchase & GRN', path: '/procurement', icon: ShoppingBag, module: 'PROCUREMENT' },
            { name: 'Customer CRM', path: '/customer-crm', icon: Contact, module: 'CRM' },
            { name: 'Dispatch & Delivery', path: '/dispatch', icon: Truck, module: 'DISPATCH' }
        ]
    },
    {
        title: 'MANAGEMENT',
        items: [
            { name: 'Attendance & HR', path: '/attendance', icon: UserCheck, module: 'HR' },
            { name: 'Analytics & Reports', path: '/analytics', icon: BarChart3, module: 'ANALYTICS' },
            { name: 'Administration', path: '/administration', icon: Settings, module: 'USERS' },
            { name: 'Roles & Permissions', path: '/administration/roles', icon: ShieldCheck, module: 'ROLES', allowedRoles: ['tenant admin', 'super admin'] },
            { name: 'User Accounts', path: '/administration/users', icon: Users, module: 'USERS', allowedRoles: ['tenant admin', 'super admin'] }
        ]
    }
];

export default function Sidebar({ isOpen, onClose }) {
    const user = useAuthStore((state) => state.user);

    const userRoleName = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
    const isAdmin = userRoleName.includes('admin') || userRoleName === 'super admin';

    const isItemVisible = (item) => {
        // Admin roles see all sidebar items
        if (isAdmin) return true;

        // Block specific roles if blockedRoles array is specified
        if (item.blockedRoles && item.blockedRoles.includes(userRoleName)) {
            return false;
        }

        // Allow specific roles if allowedRoles array is specified
        if (item.allowedRoles) {
            return item.allowedRoles.includes(userRoleName);
        }

        // Permission module check
        if (item.module) {
            const permissions = user?.role?.permissions || user?.permissions || [];
            if (Array.isArray(permissions) && permissions.length > 0) {
                return permissions.some((p) => (typeof p === 'object' ? p.module === item.module : String(p).startsWith(item.module)));
            }
        }

        return true;
    };

    return (
        <>
            {/* Mobile / Tablet Backdrop Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity animate-in fade-in duration-150"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Shell */}
            <aside
                className={`fixed lg:static top-0 left-0 h-full z-50 lg:z-auto w-64 min-w-64 max-w-64 shrink-0 bg-sidebar-bg border-r border-sidebar-hover flex flex-col overflow-y-auto overflow-x-hidden text-sidebar-text font-sans transform transition-transform duration-200 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                {/* Mobile Close Button in Sidebar Header */}
                <div className="p-3 flex items-center justify-between lg:hidden border-b border-sidebar-hover">
                    <span className="text-xs font-bold text-sidebar-text-active uppercase tracking-wider">
                        Navigation Menu
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-sidebar-text hover:text-sidebar-text-active rounded-md transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="p-3 space-y-4 flex-1">
                    {SIDEBAR_SECTIONS.map((section) => {
                        const visibleItems = section.items.filter(isItemVisible);
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={section.title} className="space-y-1">
                                <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-text-muted mb-1 truncate">
                                    {section.title}
                                </div>
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.name}
                                            to={item.path}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap overflow-hidden transition-all duration-150 ${
                                                    isActive
                                                        ? 'bg-primary text-sidebar-bg font-bold shadow-xs'
                                                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
                                                }`
                                            }
                                        >
                                            <Icon className="shrink-0" size={17} />
                                            <span className="truncate flex-1">{item.name}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
