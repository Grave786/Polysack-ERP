import { Construction } from 'lucide-react';

export default function CustomerCrmPage() {
    return (
        <div className="space-y-5 font-sans">
            <div>
                <h1 className="text-xl font-extrabold text-text-main tracking-tight">Customer CRM & Complaints</h1>
                <p className="text-xs text-text-muted mt-0.5">Manage customer interactions, follow-ups, and quality complaints.</p>
            </div>

            <div className="flex flex-col items-center justify-center p-16 bg-card-bg border border-border rounded-xl text-center shadow-xs">
                <Construction className="text-primary mb-3" size={40} />
                <h3 className="text-base font-bold text-text-main mb-1">Customer CRM & Complaints</h3>
                <p className="text-xs text-text-muted max-w-sm">Coming Soon — Interaction logs and quality complaint ticket management module.</p>
            </div>
        </div>
    );
}
