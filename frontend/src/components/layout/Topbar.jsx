import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import GlobalSearchBar from './GlobalSearchBar';
import { Building2, ChevronDown, ShieldCheck, Bell, BellOff, LogOut, Loader2, Check, Menu, User, Settings, Users, ShoppingCart, CheckCircle, AlertTriangle, CheckCheck, ExternalLink, X } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { hasModulePermission, checkIsSuperAdmin } from '../../utils/permissionUtils';
import toast from 'react-hot-toast';

// Helper to detect 24-character hexadecimal MongoDB ObjectId
const isMongoObjectId = (val) => {
    return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
};

// Helper to compute initials from full name
const getInitials = (name) => {
    if (!name) return 'AU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// Helper to resolve human-readable Role display name
const getRoleDisplayName = (user) => {
    if (user?.roleName) return user.roleName;
    if (user?.role && typeof user.role === 'object' && user.role.name) return user.role.name;
    if (typeof user?.role === 'string' && !isMongoObjectId(user.role)) return user.role;
    return 'Authorized User';
};

export default function Topbar({ onToggleSidebar }) {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const currentFacility = useAuthStore((state) => state.currentFacility);
    const setCurrentFacility = useAuthStore((state) => state.setCurrentFacility);

    // Dropdown States
    const [showFacilityDropdown, setShowFacilityDropdown] = useState(false);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const [locations, setLocations] = useState([]);
    const [isLocationsLoading, setIsLocationsLoading] = useState(false);

    // System Notifications State (Low Stock & PO Approvals)
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isApproving, setIsApproving] = useState(null);

    const facilityRef = useRef(null);
    const notificationRef = useRef(null);
    const profileDropdownRef = useRef(null);

    const userInitials = getInitials(user?.name);
    const roleDisplayName = getRoleDisplayName(user);
    const userEmail = user?.email || 'user@polysack.com';

    // Detect Super Admin to hide tenant-only elements like facility selector and tenant notifications
    const isSuperAdmin = checkIsSuperAdmin(user);

    // Module permission visibility checks
    const canSeeCompanySettings = hasModulePermission(user, 'USERS') || hasModulePermission(user, 'TENANTS');
    const canSeeRoles = hasModulePermission(user, 'ROLES');
    const canSeeUsers = hasModulePermission(user, 'USERS');

    // Helper to format relative timestamps
    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    // Fetch System Notifications (Low Stock alerts & PO Approvals) - strictly for tenant users
    const fetchNotifications = () => {
        if (isSuperAdmin) return;
        axiosInstance.get('/notifications?limit=50')
            .then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setNotifications(res.data.data);
                    setUnreadCount(res.data.unreadCount !== undefined ? res.data.unreadCount : res.data.data.filter(n => !n.isRead).length);
                }
            })
            .catch(() => {
                // Fallback: keep state safe
            });
    };

    useEffect(() => {
        if (isSuperAdmin) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [isSuperAdmin]);

    const handleNotificationClick = async (notif) => {
        try {
            if (!notif.isRead) {
                await axiosInstance.patch(`/notifications/${notif._id}/read`);
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.warn('Could not mark notification as read:', err.message);
        }

        setShowNotificationDropdown(false);

        if (notif.link) {
            navigate(notif.link);
        } else if (notif.type === 'LOW_STOCK') {
            navigate(`/inventory?tab=raw-materials&search=${encodeURIComponent(notif.data?.code || '')}`);
        } else if (notif.type === 'PO_APPROVAL') {
            navigate('/procurement');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await axiosInstance.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (err) {
            toast.error('Failed to mark all as read');
        }
    };

    const handleDismissNotification = async (e, notifId) => {
        e.stopPropagation();
        try {
            await axiosInstance.delete(`/notifications/${notifId}`);
            setNotifications(prev => prev.filter(n => n._id !== notifId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            toast.error('Failed to dismiss notification');
        }
    };

    // Close popovers on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (facilityRef.current && !facilityRef.current.contains(e.target)) {
                setShowFacilityDropdown(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setShowNotificationDropdown(false);
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
                setIsProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleFacilityDropdown = async () => {
        const nextState = !showFacilityDropdown;
        setShowFacilityDropdown(nextState);

        if (nextState && locations.length === 0) {
            setIsLocationsLoading(true);
            try {
                const res = await axiosInstance.get('/locations', { params: { isActive: true } });
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setLocations(res.data.data);
                } else {
                    setLocations([]);
                }
            } catch (err) {
                console.warn('Could not fetch locations for switcher:', err.message);
                setLocations([]);
            } finally {
                setIsLocationsLoading(false);
            }
        }
    };

    const handleSelectLocation = (loc) => {
        const facilityName = typeof loc === 'object' ? loc.name : loc;
        setCurrentFacility(facilityName);
        setShowFacilityDropdown(false);
    };

    const handleApprovePo = async (poId, poNum) => {
        try {
            setIsApproving(poId);
            const res = await axiosInstance.patch(`/purchase-orders/${poId}/status`, { status: 'SENT_TO_SUPPLIER' });
            if (res.data?.success) {
                toast.success(`Purchase Order ${poNum} approved & sent to supplier!`);
                fetchNotifications();
            }
        } catch (err) {
            console.error('Error approving PO:', err);
            toast.error(err.response?.data?.message || 'Failed to approve PO');
        } finally {
            setIsApproving(null);
        }
    };

    const displayFacilityName = currentFacility || user?.facilityName || 'Vapi Unit #1 (GIDC Phase 3)';
    const notificationCount = unreadCount;

    return (
        <header className="h-16 bg-sidebar-bg border-b border-sidebar-hover flex items-center justify-between px-3 sm:px-6 text-sidebar-text-active font-sans gap-2 sm:gap-6 shadow-xs shrink-0 relative z-30">
            {/* Left Group */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="p-1.5 text-sidebar-text hover:text-sidebar-text-active rounded-lg hover:bg-sidebar-hover transition-all cursor-pointer lg:hidden"
                    title="Toggle Navigation"
                >
                    <Menu size={20} />
                </button>

                <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 bg-primary rounded-xl flex items-center justify-center font-extrabold text-sm sm:text-base text-sidebar-bg shadow-sm shrink-0">
                    P
                </div>
                <div className="text-sm sm:text-base font-bold tracking-tight text-sidebar-text-active whitespace-nowrap">
                    PolySack <span className="text-primary font-semibold hidden xs:inline">ERP</span>
                </div>
            </div>

            {/* Middle: Global Search Bar */}
            <div className="hidden md:block flex-1 max-w-xs md:max-w-md">
                <GlobalSearchBar />
            </div>

            {/* Right Group */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Facility Selector (Only rendered for regular Tenant users, hidden for Super Admin) */}
                {!isSuperAdmin && (
                    <div className="relative" ref={facilityRef}>
                        <button
                            type="button"
                            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-sidebar-hover/80 border border-sidebar-hover text-xs font-semibold text-sidebar-text-active hover:border-primary/40 transition-all cursor-pointer shadow-2xs select-none"
                            onClick={handleToggleFacilityDropdown}
                        >
                            <Building2 size={13} className="text-primary shrink-0" />
                            <span className="truncate max-w-[130px]">{displayFacilityName}</span>
                            <ChevronDown size={12} className="text-sidebar-text ml-0.5 shrink-0" />
                        </button>

                        {showFacilityDropdown && (
                            <div className="absolute right-0 mt-2 w-64 bg-card-bg border border-border shadow-2xl rounded-xl z-50 p-3 font-sans text-xs text-text-main">
                                <div className="text-[10px] font-bold text-text-muted mb-2 uppercase tracking-wider px-1">
                                    SELECT OPERATIONAL FACILITY
                                </div>
                                {isLocationsLoading ? (
                                    <div className="flex items-center justify-center py-6 text-text-muted gap-2">
                                        <Loader2 className="animate-spin text-primary" size={16} />
                                        <span>Loading units...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {['Vapi Unit #1 (GIDC Phase 3)', 'Surat Extrusion Plant #2', 'Ahmedabad Lamination Facility'].map((unit) => {
                                            const isSelected = displayFacilityName === unit;
                                            return (
                                                <div
                                                    key={unit}
                                                    onClick={() => handleSelectLocation(unit)}
                                                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                                                        isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-app-bg text-text-main'
                                                    }`}
                                                >
                                                    <span className="truncate">{unit}</span>
                                                    {isSelected && <Check size={14} className="text-primary shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Role Badge */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold shadow-2xs select-none">
                    <ShieldCheck size={13} />
                    <span>Role: {roleDisplayName}</span>
                </div>

                {/* Notification Bell Dropdown (Tenant users only) */}
                {!isSuperAdmin && (
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                            className="p-1.5 sm:p-2 text-sidebar-text hover:text-sidebar-text-active rounded-xl hover:bg-sidebar-hover transition-all cursor-pointer relative"
                            title="Notifications"
                        >
                            <Bell size={17} />
                            {notificationCount > 0 && (
                                <span className="min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-sidebar-bg font-extrabold text-[10px] flex items-center justify-center absolute -top-0.5 -right-0.5 border border-sidebar-bg animate-pulse">
                                    {notificationCount}
                                </span>
                            )}
                        </button>

                        {showNotificationDropdown && (
                            <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-card-bg border border-border shadow-2xl rounded-xl z-50 p-3.5 font-sans text-xs text-text-main">
                                <div className="flex items-center justify-between text-xs font-bold text-text-main mb-2.5 border-b border-border pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="uppercase tracking-wider">SYSTEM NOTIFICATIONS</span>
                                        {unreadCount > 0 && (
                                            <span className="px-2 py-0.5 bg-rose-500/15 text-rose-600 border border-rose-500/30 rounded-full text-[10px] font-extrabold">
                                                {unreadCount} Unread
                                            </span>
                                        )}
                                    </div>

                                    {unreadCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleMarkAllRead}
                                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                            title="Mark all as read"
                                        >
                                            <CheckCheck size={13} />
                                            <span>Mark all read</span>
                                        </button>
                                    )}
                                </div>

                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-7 text-center text-text-muted">
                                        <BellOff size={28} className="mb-2 opacity-40 text-text-muted" />
                                        <span className="font-semibold text-text-main">No notifications</span>
                                        <span className="text-[11px] text-text-muted mt-1">You are all caught up!</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                                        {notifications.map((notif) => {
                                            const isLowStock = notif.type === 'LOW_STOCK';
                                            const isPoApproval = notif.type === 'PO_APPROVAL';

                                            return (
                                                <div
                                                    key={notif._id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={`p-2.5 rounded-lg border transition-all cursor-pointer relative group flex items-start gap-2.5 ${
                                                        notif.isRead
                                                            ? 'bg-card-bg hover:bg-app-bg border-border/80 text-text-muted'
                                                            : isLowStock
                                                            ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/30 text-text-main shadow-2xs'
                                                            : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-text-main shadow-2xs'
                                                    }`}
                                                >
                                                    {/* Left Icon */}
                                                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                                        isLowStock
                                                            ? 'bg-rose-100 text-rose-600 border border-rose-200'
                                                            : isPoApproval
                                                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                            : 'bg-primary/10 text-primary border border-primary/20'
                                                    }`}>
                                                        {isLowStock ? (
                                                            <AlertTriangle size={15} />
                                                        ) : isPoApproval ? (
                                                            <ShoppingCart size={15} />
                                                        ) : (
                                                            <Bell size={15} />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className={`font-bold text-xs truncate ${notif.isRead ? 'text-text-main' : isLowStock ? 'text-rose-950 font-extrabold' : 'text-text-main'}`}>
                                                                {notif.title}
                                                            </span>
                                                            <span className="text-[10px] text-text-muted shrink-0 font-mono">
                                                                {formatTimeAgo(notif.createdAt)}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] text-text-muted mt-0.5 leading-snug line-clamp-2">
                                                            {notif.message}
                                                        </p>

                                                        {/* Low Stock Specific Metric Pills */}
                                                        {isLowStock && notif.data && (
                                                            <div className="flex items-center gap-1.5 mt-1.5 font-mono text-[10px]">
                                                                <span className="px-1.5 py-0.5 bg-rose-200/80 text-rose-900 rounded font-bold">
                                                                    Current: {notif.data.currentStock !== undefined ? notif.data.currentStock.toLocaleString('en-IN') : 0} {notif.data.uom || ''}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 bg-card-bg border border-border text-text-muted rounded">
                                                                    Reorder: {notif.data.reorderLevel !== undefined ? notif.data.reorderLevel.toLocaleString('en-IN') : 0} {notif.data.uom || ''}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* PO Approval Specific Actions */}
                                                        {isPoApproval && (
                                                            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-amber-200/60">
                                                                <span className="text-[10px] text-amber-800 font-semibold truncate">
                                                                    Supplier: {notif.data?.supplierName || 'Assigned Supplier'}
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    disabled={isApproving === (notif.data?.poId || notif._id)}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleApprovePo(notif.data?.poId || notif._id, notif.data?.poNumber || 'PO');
                                                                    }}
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded transition-all cursor-pointer shrink-0 shadow-2xs"
                                                                >
                                                                    {isApproving === (notif.data?.poId || notif._id) ? 'Approving...' : 'Approve PO'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Dismiss button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDismissNotification(e, notif._id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-600 rounded transition-opacity cursor-pointer shrink-0"
                                                        title="Dismiss"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Profile Menu */}
                <div className="relative" ref={profileDropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="flex items-center gap-2 sm:gap-3 border-l border-sidebar-hover pl-2 sm:pl-4 py-1 rounded-lg hover:bg-sidebar-hover/60 transition-all cursor-pointer select-none"
                    >
                        <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-primary text-sidebar-bg font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 select-none">
                            {userInitials}
                        </div>

                        <div className="hidden sm:flex flex-col text-left leading-tight select-none">
                            <span className="text-xs font-bold text-sidebar-text-active truncate max-w-[110px]">
                                {user?.name || 'Authorized User'}
                            </span>
                            <span className="text-[10px] text-sidebar-text font-medium truncate max-w-[110px]">
                                {roleDisplayName}
                            </span>
                        </div>

                        <ChevronDown size={14} className="text-sidebar-text shrink-0 hidden sm:block" />
                    </button>

                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-card-bg border border-border shadow-2xl rounded-xl z-[100] py-2 font-sans text-xs text-text-main divide-y divide-border animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-4 py-3 bg-app-bg/50">
                                <p className="font-bold text-text-main truncate text-xs">
                                    {user?.name || 'User Account'}
                                </p>
                                <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                                    {userEmail}
                                </p>
                                <div className="mt-2 inline-block px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold uppercase tracking-wider">
                                    {roleDisplayName}
                                </div>
                            </div>

                            <div className="py-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        navigate('/profile');
                                    }}
                                    className="w-full px-4 py-2.5 flex items-center gap-2.5 text-text-main hover:bg-app-bg transition-colors font-medium cursor-pointer text-xs"
                                >
                                    <User size={15} className="text-primary" />
                                    <span>My Profile</span>
                                </button>

                                {canSeeCompanySettings && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            navigate('/administration');
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-text-main hover:bg-app-bg transition-colors font-medium cursor-pointer text-xs"
                                    >
                                        <Building2 size={15} className="text-amber-500" />
                                        <span>Company Settings</span>
                                    </button>
                                )}

                                {canSeeRoles && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            navigate('/administration/roles');
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-text-main hover:bg-app-bg transition-colors font-medium cursor-pointer text-xs"
                                    >
                                        <ShieldCheck size={15} className="text-purple-500" />
                                        <span>Roles & Permissions</span>
                                    </button>
                                )}

                                {canSeeUsers && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            navigate('/administration/users');
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-text-main hover:bg-app-bg transition-colors font-medium cursor-pointer text-xs"
                                    >
                                        <Users size={15} className="text-blue-500" />
                                        <span>User Accounts</span>
                                    </button>
                                )}
                            </div>

                            <div className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        logout();
                                    }}
                                    className="w-full px-4 py-2.5 flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors font-bold cursor-pointer text-xs"
                                >
                                    <LogOut size={15} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
