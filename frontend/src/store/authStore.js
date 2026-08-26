import { create } from 'zustand';
import Cookies from 'js-cookie';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

const TOKEN_COOKIE_NAME = 'polysack_token';
const USER_STORAGE_KEY = 'polysack_user';

// Helper to base64-decode JWT payload client-side without external library
const decodeJwtPayload = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
};

// Helper to detect 24-character hexadecimal MongoDB ObjectId
const isMongoObjectId = (val) => {
    return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
};

// Asynchronously resolve human-readable Role and Location/Facility names
const resolveUserNames = async (userData) => {
    if (!userData) return userData;
    let resolved = { ...userData };

    // Resolve Role Name via GET /api/roles/:id if role is an ObjectId
    const roleVal = userData.role;
    if (roleVal && typeof roleVal === 'object' && roleVal.name) {
        resolved.roleName = roleVal.name;
    } else if (typeof roleVal === 'string') {
        if (isMongoObjectId(roleVal)) {
            try {
                const res = await axiosInstance.get(`/roles/${roleVal}`);
                if (res.data?.data?.name) {
                    resolved.roleName = res.data.data.name;
                }
            } catch (err) {
                console.warn('⚠️ Could not resolve Role name from ID:', roleVal, err.message);
            }
        } else {
            resolved.roleName = roleVal;
        }
    }

    // Resolve Facility / Location Name via GET /api/locations/:id if facility is an ObjectId
    const facilityVal = userData.facility || userData.facility_id;
    if (facilityVal && typeof facilityVal === 'object' && facilityVal.name) {
        resolved.facilityName = facilityVal.name;
    } else if (typeof facilityVal === 'string') {
        if (isMongoObjectId(facilityVal)) {
            try {
                const res = await axiosInstance.get(`/locations/${facilityVal}`);
                if (res.data?.data?.name) {
                    resolved.facilityName = res.data.data.name;
                }
            } catch (err) {
                console.warn('⚠️ Could not resolve Location name from ID:', facilityVal, err.message);
            }
        } else {
            resolved.facilityName = facilityVal;
        }
    }

    return resolved;
};

export const useAuthStore = create((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    currentFacility: null,

    setCurrentFacility: (facility) => set({ currentFacility: facility }),

    /**
     * Login Action
     * Calls POST /api/auth/login, resolves names for role & facility, sets state & storage
     */
    login: async (email, password) => {
        try {
            set({ isLoading: true });
            const response = await axiosInstance.post('/auth/login', { email, password });
            const { success, message, token, data } = response.data;

            if (success && token) {
                // Asynchronously fetch human-readable role and location names if they are ObjectIds
                const resolvedUser = await resolveUserNames(data);

                // Store JWT token in cookie & localStorage with 1-day expiry
                Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 1, sameSite: 'lax' });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('token', token);
                    localStorage.setItem('polysack_token', token);
                    if (resolvedUser) {
                        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resolvedUser));
                    }
                }

                set({
                    user: resolvedUser,
                    currentFacility: resolvedUser?.facilityName || 'Vapi Unit #1 (GIDC Phase 3)',
                    isAuthenticated: true,
                    isLoading: false
                });

                toast.success(message || 'Logged in successfully!');
                return { success: true };
            } else {
                throw new Error(message || 'Login failed.');
            }
        } catch (error) {
            set({ isLoading: false });
            const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    },

    /**
     * Logout Action
     * Clears cookies, localStorage, resets state
     */
    logout: () => {
        Cookies.remove(TOKEN_COOKIE_NAME);
        Cookies.remove('token');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('polysack_token');
            localStorage.removeItem(USER_STORAGE_KEY);
        }

        set({
            user: null,
            currentFacility: null,
            isAuthenticated: false,
            isLoading: false
        });

        toast.success('Logged out successfully.');
    },

    /**
     * Check Auth on App Mount
     * Validates cookie/localStorage token, restores user session & resolves human-readable names
     */
    checkAuth: async () => {
        const token =
            Cookies.get(TOKEN_COOKIE_NAME) ||
            Cookies.get('token') ||
            (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('polysack_token')));

        if (!token) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        const payload = decodeJwtPayload(token);
        if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
            // Token expired or invalid
            Cookies.remove(TOKEN_COOKIE_NAME);
            Cookies.remove('token');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('polysack_token');
                localStorage.removeItem(USER_STORAGE_KEY);
            }
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        // Restore cached user from localStorage or JWT payload
        let savedUser = null;
        if (typeof window !== 'undefined') {
            const rawUser = localStorage.getItem(USER_STORAGE_KEY);
            if (rawUser) {
                try {
                    savedUser = JSON.parse(rawUser);
                } catch {
                    savedUser = null;
                }
            }
        }

        const initialUser = savedUser || {
            _id: payload._id,
            role: payload.role,
            tenant: payload.tenant
        };

        // Immediately set initial user state so app renders without blocking
        set({
            user: initialUser,
            currentFacility: initialUser.facilityName || 'Vapi Unit #1 (GIDC Phase 3)',
            isAuthenticated: true,
            isLoading: false
        });

        // Fetch fresh populated user from GET /api/auth/me
        try {
            const res = await axiosInstance.get('/auth/me');
            if (res.data?.success && res.data?.data) {
                const freshUser = await resolveUserNames(res.data.data);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
                }
                set({
                    user: freshUser,
                    currentFacility: freshUser.facilityName || 'Vapi Unit #1 (GIDC Phase 3)',
                    isAuthenticated: true,
                    isLoading: false
                });
                return;
            }
        } catch (meErr) {
            if (meErr.response?.status === 401) {
                // Token rejected by backend — clear bad session cleanly without crashing
                Cookies.remove(TOKEN_COOKIE_NAME);
                Cookies.remove('token');
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('polysack_token');
                    localStorage.removeItem(USER_STORAGE_KEY);
                }
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }
            console.warn('Fallback to local user session:', meErr.message);
        }

        // Background resolve names if roleName/facilityName missing or raw ObjectIds
        if (!initialUser.roleName || !initialUser.facilityName) {
            const resolvedUser = await resolveUserNames(initialUser);
            if (typeof window !== 'undefined') {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(resolvedUser));
            }
            set({
                user: resolvedUser,
                currentFacility: resolvedUser.facilityName || 'Vapi Unit #1 (GIDC Phase 3)'
            });
        }
    }
}));
