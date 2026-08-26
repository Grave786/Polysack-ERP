import { useState } from 'react';
import { Download, BarChart2, Activity, Package, Receipt, Printer } from 'lucide-react';
import FinancialSummaryChart from '../components/analytics/FinancialSummaryChart';
import ProductionYieldTab from '../components/analytics/ProductionYieldTab';
import InventoryValuationTab from '../components/analytics/InventoryValuationTab';
import GstTaxRegisterTab from '../components/analytics/GstTaxRegisterTab';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('pnl');

    const handleExportAuditReport = () => {
        toast.success('Opening print dialog for A4 Executive Audit Report...');
        setTimeout(() => {
            window.print();
        }, 500);
    };

    const tabs = [
        { id: 'pnl', label: 'Financial P&L Summary', icon: BarChart2 },
        { id: 'yield', label: 'Production Yield & Scrap', icon: Activity },
        { id: 'valuation', label: 'Inventory Valuation', icon: Package },
        { id: 'gst', label: 'Sales & GST Tax Register', icon: Receipt }
    ];

    return (
        <div className="space-y-5 font-sans">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card-bg p-4 rounded-xl border border-border shadow-xs">
                <div>
                    <h1 className="text-xl font-extrabold text-text-main tracking-tight">
                        Executive Analytics & Financial Audit Reports
                    </h1>
                    <p className="text-xs text-text-muted mt-0.5">
                        P&L Financial Summaries, Production Yield, Material Consumption & GST Register
                    </p>
                </div>

                {/* Primary Action Button (Export A4 HTML Audit Report) */}
                <button
                    type="button"
                    onClick={handleExportAuditReport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
                >
                    <Download size={16} />
                    <span>Export A4 HTML Executive Audit Report</span>
                </button>
            </div>

            {/* Sub-Navigation Tabs Bar */}
            <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs transition-all cursor-pointer select-none shrink-0 ${
                                isActive
                                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                                    : 'bg-card-bg text-text-muted hover:text-text-main border border-border font-semibold'
                            }`}
                        >
                            <Icon size={16} className={isActive ? 'text-slate-950' : 'text-text-muted'} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Active Tab Component Render */}
            <div className="pt-2">
                {activeTab === 'pnl' && <FinancialSummaryChart />}
                {activeTab === 'yield' && <ProductionYieldTab />}
                {activeTab === 'valuation' && <InventoryValuationTab />}
                {activeTab === 'gst' && <GstTaxRegisterTab />}
            </div>
        </div>
    );
}
