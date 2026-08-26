import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import GlobalSearchBar from './GlobalSearchBar';
import { Building2, ChevronDown, ShieldCheck, Bell, BellOff, LogOut, Loader2, Check, Menu } from 'lucide-react';
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
    return 'Admin';
};

export default function Topbar({ onToggleSidebar }) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const currentFacility = useAuthStore((state) => state.currentFacility);
    const setCurrentFacility = useAuthStore((state) => state.setCurrentFacility);

    // Facility dropdown state
    const [showFacilityDropdown, setShowFacilityDropdown] = useState(false);
    const [locations, setLocations] = useState([]);
    const [isLocationsLoading, setIsLocationsLoading] = useState(false);

    // Notification dropdown state
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const notificationCount = 0; // TODO: Connect to backend GET /api/notifications endpoint when available

    const facilityRef = useRef(null);
    const notificationRef = useRef(null);

    const userInitials = getInitials(user?.name);
    const roleDisplayName = getRoleDisplayName(user);

    // Close popovers on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (facilityRef.current && !facilityRef.current.contains(e.target)) {
                setShowFacilityDropdown(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setShowNotificationDropdown(false);
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
        <header className="h-16 bg-sidebar-bg border-b border-sidebar-hover flex items-center justify-between px-3 sm:px-6 text-sidebar-text-active font-sans gap-2 sm:gap-6 shadow-xs shrink-0">
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

                {/* User Info Block & Avatar */}
                <div className="flex items-center gap-2 sm:gap-3 border-l border-sidebar-hover pl-2 sm:pl-4">
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

                    {/* Working Logout Button */}
                    <button
                        onClick={logout}
                        className="p-1.5 rounded-lg bg-sidebar-hover text-sidebar-text hover:text-rose-400 border border-sidebar-hover transition-all cursor-pointer"
                        title="Sign Out"
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </header>
    );
}
