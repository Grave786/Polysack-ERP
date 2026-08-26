import { useState } from 'react';
import { User, ShieldCheck, Lock, Save, KeyRound, Building2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

export default function ProfilePage() {
    const user = useAuthStore((state) => state.user);
    const checkAuth = useAuthStore((state) => state.checkAuth);

    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Profile form state
    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        phone: user?.phone || ''
    });

    // Password form state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Extract initials for avatar
    const getInitials = (nameStr) => {
        if (!nameStr) return 'U';
        const parts = nameStr.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        if (!profileData.name.trim()) {
            toast.error('Name cannot be empty');
            return;
        }

        try {
            setIsUpdatingProfile(true);
            const res = await axiosInstance.put('/users/profile', {
                name: profileData.name.trim(),
                phone: profileData.phone.trim()
            });

            if (res.data?.success) {
                toast.success('Profile details updated successfully!');
                await checkAuth(); // refresh auth session
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            toast.error(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            toast.error('Please enter current and new passwords');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('New password and confirm password do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('New password must be at least 6 characters');
            return;
        }

        try {
            setIsChangingPassword(true);
            const res = await axiosInstance.put('/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (res.data?.success) {
                toast.success('Password changed successfully!');
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });
            }
        } catch (err) {
            console.error('Error changing password:', err);
            toast.error(err.response?.data?.message || 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const roleName = user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || 'User';
    const facilityName = user?.facilityName || user?.facility_id || 'Main Unit';

    return (
        <div className="space-y-6 font-sans">
            {/* Header */}
            <div>
                <h1 className="text-xl font-extrabold text-text-main tracking-tight">
                    User Profile & Account Settings
                </h1>
                <p className="text-xs text-text-muted mt-0.5">
                    Manage your personal account details, credentials, and access security.
                </p>
            </div>

            {/* Main 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: User Info Card (4 Cols) */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-card-bg border border-border rounded-xl p-6 shadow-2xs text-center space-y-4">
                        {/* Avatar Badge */}
                        <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 text-primary text-2xl font-extrabold flex items-center justify-center mx-auto shadow-xs">
                            {getInitials(user?.name)}
                        </div>

                        {/* Name & Email */}
                        <div>
                            <h2 className="text-base font-bold text-text-main">
                                {user?.name || 'User Account'}
                            </h2>
                            <p className="text-xs font-mono text-text-muted mt-0.5">
                                {user?.email || 'user@polysack.com'}
                            </p>
                        </div>

                        {/* Role & Facility Badges */}
                        <div className="pt-3 border-t border-border space-y-2 text-xs">
                            <div className="flex items-center justify-between bg-app-bg p-2.5 rounded-lg border border-border">
                                <span className="flex items-center gap-1.5 text-text-muted font-medium text-[11px]">
                                    <ShieldCheck size={14} className="text-primary" />
                                    ASSIGNED ROLE
                                </span>
                                <span className="font-extrabold text-primary text-[11px]">
                                    {roleName}
                                </span>
                            </div>

                            <div className="flex items-center justify-between bg-app-bg p-2.5 rounded-lg border border-border">
                                <span className="flex items-center gap-1.5 text-text-muted font-medium text-[11px]">
                                    <Building2 size={14} className="text-amber-500" />
                                    FACILITY / UNIT
                                </span>
                                <span className="font-bold text-text-main text-[11px]">
                                    {facilityName}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Edit Profile & Change Password (8 Cols) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Personal Information Form Card */}
                    <form onSubmit={handleProfileSubmit} className="bg-card-bg border border-border rounded-xl p-6 shadow-2xs space-y-4 font-sans text-xs">
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                            <User size={18} className="text-primary" />
                            <h3 className="text-sm font-bold text-text-main">
                                Personal Details
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={profileData.name}
                                    onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs font-semibold text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="+91 9876543210"
                                    value={profileData.phone}
                                    onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                                Registered Email (Read-only)
                            </label>
                            <input
                                type="email"
                                disabled
                                value={user?.email || ''}
                                className="w-full border border-border rounded-md p-2.5 bg-app-bg/60 text-xs font-mono text-text-muted cursor-not-allowed"
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={isUpdatingProfile}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Save size={14} />
                                <span>{isUpdatingProfile ? 'Saving Details...' : 'Save Profile Changes'}</span>
                            </button>
                        </div>
                    </form>

                    {/* Change Password Form Card */}
                    <form onSubmit={handlePasswordSubmit} className="bg-card-bg border border-border rounded-xl p-6 shadow-2xs space-y-4 font-sans text-xs">
                        <div className="flex items-center gap-2 border-b border-border pb-3">
                            <KeyRound size={18} className="text-amber-500" />
                            <h3 className="text-sm font-bold text-text-main">
                                Security & Change Password
                            </h3>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Current Password *
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        New Password *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Confirm New Password *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-app-bg text-xs text-text-main focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={isChangingPassword}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Lock size={14} />
                                <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
