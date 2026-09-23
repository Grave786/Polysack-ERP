import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' ,
    headers: {
        'Content-Type': 'application/json'
    }
});

let is403ToastActive = false;
const showSingle403Toast = (msg) => {
    if (!is403ToastActive) {
        is403ToastActive = true;
        toast.error(msg || 'Access Denied: You do not have permission to access this module.', { id: 'global-403-toast' });
        setTimeout(() => {
            is403ToastActive = false;
        }, 3000);
    }
};

// Request Interceptor: Attach Bearer JWT token dynamically from localStorage or Cookies before EVERY single request
axiosInstance.interceptors.request.use(
    (config) => {
        const token =
            (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('polysack_token'))) ||
            Cookies.get('polysack_token') ||
            Cookies.get('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Catch 401 & 403 errors
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const errCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message || 'An error occurred while processing your request.';
        const isTenantSuspended = errCode === 'TENANT_SUSPENDED' || errorMessage?.toLowerCase()?.includes('suspended');

        if (isTenantSuspended) {
            Cookies.remove('polysack_token');
            Cookies.remove('token');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('polysack_token');
                localStorage.removeItem('polysack_user');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login?suspended=true';
                }
            }
            return Promise.reject(error);
        }

        if (status === 401) {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
            const isAuthUrl = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/me') || currentPath === '/login';

            if (!isAuthUrl) {
                console.warn('⚠️ 401 Unauthorized detected on protected route:', error.config?.url);
                toast.error(errorMessage || 'Session expired. Please log in again.');
                Cookies.remove('polysack_token');
                Cookies.remove('token');
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('polysack_token');
                    localStorage.removeItem('polysack_user');
                    window.location.href = '/login';
                }
            }
        } else if (status === 403) {
            showSingle403Toast(errorMessage || 'Access Denied: You do not have permission to access this module.');
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
