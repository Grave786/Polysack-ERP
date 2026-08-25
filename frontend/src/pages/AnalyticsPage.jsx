import { Construction } from 'lucide-react';

export default function AnalyticsPage() {
    return (
        <div className="space-y-5 font-sans">
            <div>
                <h1 className="text-xl font-extrabold text-text-main tracking-tight">Analytics & Financial Audit Reports</h1>
                <p className="text-xs text-text-muted mt-0.5">Executive P&L summary, production yield, valuation, and GST tax register.</p>
            </div>

            <div className="flex flex-col items-center justify-center p-16 bg-card-bg border border-border rounded-xl text-center shadow-xs">
                <Construction className="text-primary mb-3" size={40} />
                <h3 className="text-base font-bold text-text-main mb-1">Executive Analytics & Reports</h3>
                <p className="text-xs text-text-muted max-w-sm">Coming Soon — Financial P&L, scrap yield, stock valuation, and GST tax register reports.</p>
            </div>
        </div>
    );
}
