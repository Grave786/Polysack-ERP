import { useState, useRef } from 'react';
import { Download, BarChart2, Activity, Package, Receipt, Users } from 'lucide-react';
import FinancialSummaryChart from '../components/analytics/FinancialSummaryChart';
import ProductionYieldTab from '../components/analytics/ProductionYieldTab';
import OperatorProductivityTab from '../components/analytics/OperatorProductivityTab';
import InventoryValuationTab from '../components/analytics/InventoryValuationTab';
import GstTaxRegisterTab from '../components/analytics/GstTaxRegisterTab';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState('yield');
    const tabRef = useRef(null);

    const handleExportAuditReport = () => {
        if (tabRef.current?.exportCsv) {
            tabRef.current.exportCsv();
        } else {
            toast.error('Export is currently unavailable for this tab.');
        }
    };

    const tabs = [
        { id: 'pnl', label: 'Financial P&L Summary', icon: BarChart2 },
        { id: 'yield', label: 'Production Yield & Scrap', icon: Activity },
        { id: 'operator-productivity', label: 'Operator Productivity', icon: Users },
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
                        P&L Financial Summaries, Production Yield, Operator Productivity, Material Consumption & GST Register
                    </p>
                </div>

                {/* Primary Action Button (Export Executive Audit Report) */}
                <button
                    type="button"
                    onClick={handleExportAuditReport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs transition-all shadow-md cursor-pointer shrink-0"
                    title="Export full executive audit report in CSV format"
                >
                    <Download size={16} />
                    <span>Export Executive Audit Report (CSV)</span>
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
                {activeTab === 'pnl' && <FinancialSummaryChart ref={tabRef} />}
                {activeTab === 'yield' && <ProductionYieldTab ref={tabRef} />}
                {activeTab === 'operator-productivity' && <OperatorProductivityTab ref={tabRef} />}
                {activeTab === 'valuation' && <InventoryValuationTab ref={tabRef} />}
                {activeTab === 'gst' && <GstTaxRegisterTab ref={tabRef} />}
            </div>
        </div>
    );
}

