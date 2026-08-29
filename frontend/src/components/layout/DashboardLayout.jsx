import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex flex-col h-screen w-full max-w-full overflow-x-hidden bg-app-bg font-sans">
            <Topbar onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
            <div className="flex flex-1 overflow-hidden w-full max-w-full relative">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 box-border max-w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
