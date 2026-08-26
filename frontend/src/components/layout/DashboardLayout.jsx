import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-app-bg font-sans">
            <Topbar onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
            <div className="flex flex-1 overflow-hidden w-full relative">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 box-border">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
