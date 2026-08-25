import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg font-sans">
            <Topbar />
            <div className="flex flex-1 overflow-hidden w-full">
                <Sidebar />
                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto p-8 box-border">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
