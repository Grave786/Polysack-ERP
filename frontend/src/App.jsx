import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { getFirstPermittedRoute } from './utils/permissionUtils';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MasterDataPage from './pages/MasterDataPage';
import ProductionPage from './pages/ProductionPage';
import InventoryPage from './pages/InventoryPage';
import QualityPage from './pages/QualityPage';
import PosPage from './pages/PosPage';
import SalesPage from './pages/SalesPage';
import ProcurementPage from './pages/ProcurementPage';
import CustomerCrmPage from './pages/CustomerCrmPage';
import DispatchPage from './pages/DispatchPage';
import AttendancePage from './pages/AttendancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdministrationPage from './pages/AdministrationPage';
import UserManagementPage from './pages/UserManagementPage';
import RolesManagementPage from './pages/RolesManagementPage';
import ProfilePage from './pages/ProfilePage';
import Forbidden403Page from './pages/Forbidden403Page';

function DefaultRouteRedirect() {
    const user = useAuthStore((state) => state.user);
    const targetRoute = getFirstPermittedRoute(user);
    if (targetRoute === '/403') {
        return <Navigate to="/403" state={{ message: 'No modules assigned — contact your administrator.' }} replace />;
    }
    return <Navigate to={targetRoute} replace />;
}

export default function App() {
    const checkAuth = useAuthStore((state) => state.checkAuth);
    const isLoading = useAuthStore((state) => state.isLoading);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-sidebar-bg text-primary font-sans text-sm font-semibold">
                Initializing PolySack ERP Engine...
            </div>
        );
    }

    return (
        <Routes>
            {/* Public Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Group Routes */}
            <Route element={<ProtectedRoute />}>
                <Route path="/403" element={<Forbidden403Page />} />
                <Route element={<DashboardLayout />}>
                    <Route element={<ProtectedRoute requiredModule="DASHBOARD" />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                    </Route>
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Module-specific Protected Routes */}
                    <Route element={<ProtectedRoute requiredModule="PRODUCTION" />}>
                        <Route path="/production" element={<ProductionPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="SALES" />}>
                        <Route path="/pos" element={<PosPage />} />
                        <Route path="/sales" element={<SalesPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="MASTER_DATA" />}>
                        <Route path="/master-data" element={<MasterDataPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="QUALITY" />}>
                        <Route path="/quality" element={<QualityPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="INVENTORY" />}>
                        <Route path="/inventory" element={<InventoryPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="PROCUREMENT" />}>
                        <Route path="/procurement" element={<ProcurementPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="CRM" />}>
                        <Route path="/customer-crm" element={<CustomerCrmPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="DISPATCH" />}>
                        <Route path="/dispatch" element={<DispatchPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="HR" />}>
                        <Route path="/attendance" element={<AttendancePage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="ANALYTICS" />}>
                        <Route path="/analytics" element={<AnalyticsPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="USERS" />}>
                        <Route path="/administration" element={<AdministrationPage />} />
                        <Route path="/administration/tenants" element={<AdministrationPage />} />
                        <Route path="/administration/users" element={<UserManagementPage />} />
                        <Route path="/users" element={<UserManagementPage />} />
                    </Route>

                    <Route element={<ProtectedRoute requiredModule="ROLES" />}>
                        <Route path="/administration/roles" element={<RolesManagementPage />} />
                        <Route path="/roles" element={<RolesManagementPage />} />
                    </Route>

                    {/* Fallback inside dashboard layout */}
                    <Route path="*" element={<DefaultRouteRedirect />} />
                </Route>
            </Route>

            {/* Global Root Fallback */}
            <Route path="/" element={<DefaultRouteRedirect />} />
        </Routes>
    );
}
