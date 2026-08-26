import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
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
                <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Module-specific Protected Routes */}
                    <Route element={<ProtectedRoute allowedRoles={['Tenant Admin', 'Super Admin', 'Production Manager', 'Operator']} />}>
                        <Route path="/production" element={<ProductionPage />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRoles={['Tenant Admin', 'Super Admin', 'Sales Operator', 'Biller']} />}>
                        <Route path="/pos" element={<PosPage />} />
                    </Route>

                    <Route path="/master-data" element={<MasterDataPage />} />
                    <Route path="/quality" element={<QualityPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/procurement" element={<ProcurementPage />} />
                    <Route path="/customer-crm" element={<CustomerCrmPage />} />
                    <Route path="/dispatch" element={<DispatchPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/administration" element={<AdministrationPage />} />
                    <Route path="/administration/roles" element={<RolesManagementPage />} />
                    <Route path="/administration/users" element={<UserManagementPage />} />
                    <Route path="/roles" element={<RolesManagementPage />} />
                    <Route path="/users" element={<UserManagementPage />} />

                    {/* Fallback inside dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
            </Route>

            {/* Global Root Fallback */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
