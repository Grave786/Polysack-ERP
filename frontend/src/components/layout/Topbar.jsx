import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import GlobalSearchBar from './GlobalSearchBar';
import { Building2, ChevronDown, ShieldCheck, Bell, BellOff, LogOut, Loader2, Check, Menu, User, Settings, Users } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

// Helper to detect 24-character hexadecimal MongoDB ObjectId
const isMongoObjectId = (val) => {
    return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
};

// Helper to compute initials from full name (e.g., "Rajesh Sharma" -> "RS")
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

    const notificationCount = 0;

    const facilityRef = useRef(null);
    const notificationRef = useRef(null);
    const profileDropdownRef = useRef(null);

    const userInitials = getInitials(user?.name);
    const roleDisplayName = getRoleDisplayName(user);
    const userEmail = user?.email || 'user@polysack.com';

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

    // Fetch tenant locations when opening facility switcher dropdown
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

    const displayFacilityName = currentFacility || user?.facilityName || 'Vapi Unit #1 (GIDC Phase 3)';

    return (
        <header className="h-16 bg-sidebar-bg border-b border-sidebar-hover flex items-center justify-between px-3 sm:px-6 text-sidebar-text-active font-sans gap-2 sm:gap-6 shadow-xs shrink-0 relative z-30">
            {/* Left Group: Hamburger Toggle (below lg) + Brand Logo */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Hamburger Toggle Button (mobile/tablet only) */}
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

            {/* Middle: Functional Global Search Bar (Hidden on mobile, visible from md) */}
            <div className="hidden md:block flex-1 max-w-xs md:max-w-md">
                <GlobalSearchBar />
            </div>

            {/* Right Group: Facility Selector, Role Badge, Notifications & User Avatar */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Facility Selector Pill (Hidden below lg) */}
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

                    {/* Facility Switcher Dropdown Popover */}
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
                            ) : locations.length === 0 ? (
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
                            ) : (
                                <div className="space-y-1 max-h-56 overflow-y-auto">
                                    {locations.map((loc) => {
                                        const isSelected = displayFacilityName === loc.name;
                                        return (
                                            <div
                                                key={loc._id}
                                                onClick={() => handleSelectLocation(loc)}
                                                className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                                                    isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-app-bg text-text-main'
                                                }`}
                                            >
                                                <div>
                                                    <div className="font-semibold truncate">{loc.name}</div>
                                                    {loc.code && <div className="text-[10px] text-text-muted">{loc.code}</div>}
                                                </div>
                                                {isSelected && <Check size={14} className="text-primary shrink-0" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Role Badge Pill (Hidden below md) */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold shadow-2xs select-none">
                    <ShieldCheck size={13} />
                    <span>Role: {roleDisplayName}</span>
                </div>

                {/* Notification Bell Dropdown */}
                <div className="relative" ref={notificationRef}>
                    <button
                        type="button"
                        onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                        className="p-1.5 sm:p-2 text-sidebar-text hover:text-sidebar-text-active rounded-xl hover:bg-sidebar-hover transition-all cursor-pointer relative"
                        title="Notifications"
                    >
                        <Bell size={17} />
                        {notificationCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-primary absolute top-1.5 right-1.5 border border-sidebar-bg" />
                        )}
                    </button>

                    {/* Notification Dropdown Popover */}
                    {showNotificationDropdown && (
                        <div className="absolute right-0 mt-2 w-72 bg-card-bg border border-border shadow-2xl rounded-xl z-50 p-4 font-sans text-xs text-text-main">
                            <div className="text-xs font-bold text-text-main mb-3 uppercase tracking-wider border-b border-border pb-2">
                                SYSTEM NOTIFICATIONS
                            </div>
                            <div className="flex flex-col items-center justify-center py-6 text-center text-text-muted">
                                <BellOff size={28} className="mb-2 opacity-40 text-text-muted" />
                                <span className="font-semibold text-text-main">No new notifications</span>
                                <span className="text-[11px] text-text-muted mt-1">You are all caught up!</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Clickable Profile Dropdown Block */}
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

                    {/* Professional Profile Dropdown Menu */}
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-card-bg border border-border shadow-2xl rounded-xl z-[100] py-2 font-sans text-xs text-text-main divide-y divide-border animate-in fade-in zoom-in-95 duration-100">
                            {/* Profile Header Summary */}
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

                            {/* Navigation Options */}
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
                            </div>

                            {/* Logout Action */}
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
