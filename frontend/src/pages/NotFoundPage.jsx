import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Database,
    Factory,
    Boxes,
    Receipt,
    ShoppingBag,
    Contact,
    Building2,
    ArrowLeft,
    Home,
    LogIn,
    Compass
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { hasModulePermission, checkIsSuperAdmin, getFirstPermittedRoute } from '../utils/permissionUtils';

const QUICK_LINKS = [
    {
        name: 'Master Data',
        path: '/master-data',
        icon: Database,
        module: 'MASTER_DATA',
        desc: 'Products, raw materials & specifications'
    },
    {
        name: 'Production',
        path: '/production',
        icon: Factory,
        module: 'PRODUCTION',
        desc: 'Work orders, job cards & stages'
    },
    {
        name: 'Inventory & Stock',
        path: '/inventory',
        icon: Boxes,
        module: 'INVENTORY',
        desc: 'Stock ledger, bins & low stock alerts'
    },
    {
        name: 'Sales & Billing',
        path: '/sales',
        icon: Receipt,
        module: 'SALES',
        desc: 'Sales orders, invoices & receivables'
    },
    {
        name: 'Purchase & GRN',
        path: '/procurement',
        icon: ShoppingBag,
        module: 'PROCUREMENT',
        desc: 'Purchase orders, vendors & inward GRN'
    },
    {
        name: 'Customer CRM',
        path: '/customer-crm',
        icon: Contact,
        module: 'CRM',
        desc: 'Client leads, inquiries & history'
    }
];

export default function NotFoundPage({ isEmbedded = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // Set page title and manage noindex robots meta
    useEffect(() => {
        const prevTitle = document.title;
        document.title = '404 - Page Not Found | PolySack ERP';

        let robotsMeta = document.querySelector('meta[name="robots"]');
        let wasCreated = false;
        let prevContent = '';

        if (!robotsMeta) {
            robotsMeta = document.createElement('meta');
            robotsMeta.name = 'robots';
            robotsMeta.content = 'noindex, nofollow';
            document.head.appendChild(robotsMeta);
            wasCreated = true;
        } else {
            prevContent = robotsMeta.content;
            robotsMeta.content = 'noindex, nofollow';
        }

        return () => {
            document.title = prevTitle || 'PolySack ERP';
            if (wasCreated && robotsMeta && robotsMeta.parentNode) {
                robotsMeta.parentNode.removeChild(robotsMeta);
            } else if (robotsMeta && prevContent) {
                robotsMeta.content = prevContent;
            }
        };
    }, []);

    const isSuperAdmin = checkIsSuperAdmin(user);

    // Filter quick links by user permissions (matches sidebar)
    let visibleLinks = [];
    if (isSuperAdmin) {
        visibleLinks = [
            {
                name: 'System Dashboard',
                path: '/dashboard',
                icon: LayoutDashboard,
                desc: 'Platform health & tenant metrics'
            },
            {
                name: 'Tenant Accounts',
                path: '/administration/tenants',
                icon: Building2,
                desc: 'Organizations & tenant provisions'
            }
        ];
    } else if (user) {
        visibleLinks = QUICK_LINKS.filter((item) => hasModulePermission(user, item.module));
    }

    const handlePrimaryAction = () => {
        if (isAuthenticated && user) {
            const target = getFirstPermittedRoute(user) || '/dashboard';
            navigate(target);
        } else {
            navigate('/');
        }
    };

    return (
        <div
            className={`relative w-full overflow-hidden font-sans flex flex-col items-center justify-between ${
                isEmbedded
                    ? 'min-h-[calc(100vh-140px)] py-4 sm:py-6 px-2 sm:px-4'
                    : 'min-h-screen p-4 sm:p-8 bg-slate-50/70'
            }`}
        >
            <style>{`
                @keyframes polysackFloat {
                    0%, 100% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-8px);
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .polysack-float {
                        animation: none !important;
                    }
                }
                .polysack-float {
                    animation: polysackFloat 3.8s ease-in-out infinite;
                }
            `}</style>

            {/* Subtle Woven Grid Texture */}
            <div
                className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                    backgroundImage:
                        'radial-gradient(#0f172a 1px, transparent 1px), radial-gradient(#d97706 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    backgroundPosition: '0 0, 12px 12px'
                }}
                aria-hidden="true"
            />

            {/* Ambient Navy / Amber Radial Glow */}
            <div
                className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 sm:w-[32rem] sm:h-[32rem] bg-gradient-to-tr from-amber-200/25 via-sky-200/20 to-indigo-200/20 rounded-full blur-3xl pointer-events-none"
                aria-hidden="true"
            />

            {/* Top Brand Bar for Standalone Mode (Logged-out) */}
            {!isEmbedded && (
                <div className="w-full max-w-4xl flex items-center justify-between pb-6 relative z-10">
                    <Link to="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500 shadow-sm group-hover:scale-105 transition-transform">
                            <Boxes size={20} />
                        </div>
                        <div>
                            <span className="text-base font-black text-slate-900 tracking-tight block leading-tight">
                                PolySack <span className="text-amber-600">ERP</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block">
                                Packaging Manufacturing Engine
                            </span>
                        </div>
                    </Link>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                        <LogIn size={13} />
                        <span>Client Login</span>
                    </Link>
                </div>
            )}

            {/* Main Centered 404 Card Container */}
            <div className="w-full max-w-3xl my-auto relative z-10 flex flex-col items-center">
                <div className="w-full bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm hover:shadow-md transition-shadow text-center space-y-6">
                    {/* Module Context / Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold tracking-wide uppercase">
                        <Compass size={13} className="text-amber-600" />
                        <span>HTTP 404 • Resource Routing Exception</span>
                    </div>

                    {/* Large 404 with Animated Inline Sack Illustration */}
                    <div className="flex items-center justify-center gap-2 sm:gap-4 select-none my-1">
                        <span className="text-7xl sm:text-8xl md:text-9xl font-black bg-gradient-to-br from-slate-900 via-slate-800 to-amber-600 bg-clip-text text-transparent tracking-tighter drop-shadow-xs">
                            4
                        </span>

                        {/* Middle '0' replaced with an illustrated PolySack bag */}
                        <div className="polysack-float relative flex items-center justify-center w-16 h-20 sm:w-22 sm:h-26 md:w-26 md:h-30">
                            <svg
                                viewBox="0 0 80 100"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full drop-shadow-md"
                                aria-label="Woven packaging sack illustration"
                            >
                                <defs>
                                    <pattern id="sack404Grid" width="6" height="6" patternUnits="userSpaceOnUse">
                                        <path d="M0 3h6M3 0v6" stroke="#94a3b8" strokeWidth="0.5" strokeOpacity="0.45" />
                                    </pattern>
                                    <linearGradient id="sack404Grad" x1="10" y1="10" x2="70" y2="90" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#ffffff" />
                                        <stop offset="60%" stopColor="#f8fafc" />
                                        <stop offset="100%" stopColor="#e2e8f0" />
                                    </linearGradient>
                                    <linearGradient id="sack404Band" x1="10" y1="45" x2="70" y2="55" gradientUnits="userSpaceOnUse">
                                        <stop offset="0%" stopColor="#f59e0b" />
                                        <stop offset="100%" stopColor="#d97706" />
                                    </linearGradient>
                                </defs>

                                {/* Contact Floor Shadow */}
                                <ellipse cx="40" cy="94" rx="26" ry="4" fill="#0f172a" fillOpacity="0.14" />

                                {/* Sack Outline and Body */}
                                <path
                                    d="M16 20 C16 16 22 14 40 14 C58 14 64 16 64 20 L68 86 C68 90 62 92 40 92 C18 92 12 90 12 86 Z"
                                    fill="url(#sack404Grad)"
                                    stroke="#cbd5e1"
                                    strokeWidth="1.5"
                                />

                                {/* Woven Mesh Overlay */}
                                <path
                                    d="M16 20 C16 16 22 14 40 14 C58 14 64 16 64 20 L68 86 C68 90 62 92 40 92 C18 92 12 90 12 86 Z"
                                    fill="url(#sack404Grid)"
                                />

                                {/* Industrial Amber Printed Brand Band */}
                                <path d="M13.5 44 L66.5 44 L66.8 60 L13.2 60 Z" fill="url(#sack404Band)" />

                                {/* Brand Panel Label Block */}
                                <rect x="23" y="48" width="34" height="8" rx="2" fill="#ffffff" fillOpacity="0.9" />
                                <path d="M29 50h4a2 2 0 0 1 0 4h-4v-4zm0 2h3" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" />
                                <path d="M39 51h8M39 53h5" stroke="#78350f" strokeWidth="1" strokeLinecap="round" />

                                {/* Top Stitched Hem (Orange + Dark twine) */}
                                <path d="M18 20 C22 17 32 16 40 16 C48 16 58 17 62 20" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 2" />
                                <path d="M17 23 C22 20 32 19 40 19 C48 19 58 20 63 23" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />

                                {/* Bottom Fold Heavy-Duty Stitch Line */}
                                <path d="M15 87 L65 87" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 2" />
                                <path d="M14 90 L66 90" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />

                                {/* Subtle Fold Crease */}
                                <path d="M38 22 C37 42 36 68 37 88" stroke="#94a3b8" strokeWidth="0.75" strokeOpacity="0.45" />
                            </svg>
                        </div>

                        <span className="text-7xl sm:text-8xl md:text-9xl font-black bg-gradient-to-br from-amber-600 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tighter drop-shadow-xs">
                            4
                        </span>
                    </div>

                    {/* Heading and Explanatory Subtext */}
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Page Not Found
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                            The page you are looking for does not exist, was moved, or you may have typed the wrong address.
                        </p>
                    </div>

                    {/* Requested URL Chip */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500 pt-1">
                        <span>Requested path:</span>
                        <code className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300/80 font-mono text-[11px] font-bold text-slate-800 select-all">
                            {location.pathname}
                        </code>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handlePrimaryAction}
                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                        >
                            {isAuthenticated ? <LayoutDashboard size={16} /> : <Home size={16} />}
                            <span>{isAuthenticated ? 'Back to Dashboard' : 'Go to Home'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-4 py-2.5 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-semibold border border-slate-300 rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                        >
                            <ArrowLeft size={16} />
                            <span>Go Back</span>
                        </button>

                        {!isAuthenticated && (
                            <Link
                                to="/login"
                                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                            >
                                <LogIn size={16} />
                                <span>Client Login</span>
                            </Link>
                        )}
                    </div>

                    {/* Quick Navigation Shortcuts Row (Logged-In Users Only) */}
                    {isAuthenticated && visibleLinks.length > 0 && (
                        <div className="w-full pt-6 mt-6 border-t border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Quick Module Shortcuts
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    Authorized Navigation
                                </span>
                            </div>
                            <div
                                className={`grid grid-cols-2 ${
                                    visibleLinks.length > 4
                                        ? 'sm:grid-cols-3'
                                        : 'sm:grid-cols-2 md:grid-cols-4'
                                } gap-2.5 sm:gap-3`}
                            >
                                {visibleLinks.map((item) => {
                                    const IconComponent = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className="bg-slate-50/70 hover:bg-amber-50/50 p-3 rounded-xl border border-slate-200/90 hover:border-amber-400 hover:shadow-xs transition-all group flex flex-col justify-between text-left space-y-1.5 cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 group-hover:border-amber-300 group-hover:bg-amber-100 text-slate-700 group-hover:text-amber-800 flex items-center justify-center transition-colors">
                                                    <IconComponent size={14} />
                                                </div>
                                                <span className="text-[10px] text-slate-400 group-hover:text-amber-700 font-mono">
                                                    →
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                                                    {item.name}
                                                </div>
                                                {item.desc && (
                                                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                                        {item.desc}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Standalone Footer */}
            <div className="w-full pt-6 text-center text-[11px] text-slate-500 relative z-10">
                © 2026 PolySack ERP. All Rights Reserved. Designed &amp; Developed by Requin Solutions Pvt. Ltd
            </div>
        </div>
    );
}

export { NotFoundPage as NotFound };
