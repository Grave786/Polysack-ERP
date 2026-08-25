import { useAuthStore } from '../store/authStore';

export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);

    return (
        <div className="space-y-6 font-sans">
            <div>
                <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
                    Welcome, {user?.name || 'Authorized User'}!
                </h1>
                <p className="text-sm text-text-muted mt-1">
                    PolySack Manufacturing ERP Engine — Enterprise Centralized Theme Portal
                </p>
            </div>

            <div className="bg-card-bg border border-border rounded-xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-text-main">
                    Session & Environment Context
                </h3>
                <ul className="text-sm text-text-muted space-y-2 list-disc list-inside">
                    <li><strong>User ID:</strong> {user?._id || 'N/A'}</li>
                    <li><strong>Email:</strong> {user?.email || 'N/A'}</li>
                    <li><strong>Role:</strong> <span className="text-primary font-semibold">{user?.role || 'N/A'}</span></li>
                    <li><strong>Tenant Context:</strong> {user?.tenant || 'N/A'}</li>
                    <li>
                        <strong>API Base URL:</strong>{' '}
                        <code className="bg-app-bg text-primary border border-border px-2 py-0.5 rounded font-mono text-xs">
                            {import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}
                        </code>
                    </li>
                </ul>
            </div>
        </div>
    );
}
