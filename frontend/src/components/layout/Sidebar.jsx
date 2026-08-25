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
    Settings
} from 'lucide-react';

const SIDEBAR_SECTIONS = [
    {
        title: 'CORE ERP',
        items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Master Data', path: '/master-data', icon: Database }
        ]
    },
    {
        title: 'OPERATIONS',
        items: [
            { name: 'Production', path: '/production', icon: Factory },
            { name: 'Quality Control', path: '/quality', icon: ShieldCheck },
            { name: 'Inventory & Stock', path: '/inventory', icon: Boxes }
        ]
    },
    {
        title: 'COMMERCIAL',
        items: [
            { name: 'POS Billing Terminal', path: '/pos', icon: CreditCard },
            { name: 'Sales & Billing', path: '/sales', icon: Receipt },
            { name: 'Purchase & GRN', path: '/procurement', icon: ShoppingBag },
            { name: 'Customer CRM', path: '/customer-crm', icon: Contact },
            { name: 'Dispatch & Delivery', path: '/dispatch', icon: Truck }
        ]
    },
    {
        title: 'MANAGEMENT',
        items: [
            { name: 'Attendance & HR', path: '/attendance', icon: UserCheck },
            { name: 'Analytics & Reports', path: '/analytics', icon: BarChart3 },
            { name: 'Administration', path: '/administration', icon: Settings }
        ]
    }
];

export default function Sidebar() {
    return (
        <aside className="w-64 min-w-64 max-w-64 shrink-0 bg-sidebar-bg border-r border-sidebar-hover h-full flex flex-col overflow-y-auto overflow-x-hidden text-sidebar-text font-sans">
            <nav className="p-3 space-y-4">
                {SIDEBAR_SECTIONS.map((section) => (
                    <div key={section.title} className="space-y-1">
                        <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-text-muted mb-1 truncate">
                            {section.title}
                        </div>
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
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
                ))}
            </nav>

            <div className="p-4 border-t border-sidebar-hover text-center text-xs text-text-muted mt-auto shrink-0">
                PolySack ERP v1.0.0
            </div>
        </aside>
    );
}
