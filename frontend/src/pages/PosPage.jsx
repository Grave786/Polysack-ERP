import { Construction } from 'lucide-react';

export default function PosPage() {
    return (
        <div className="space-y-5 font-sans">
            <div>
                <h1 className="text-xl font-extrabold text-text-main tracking-tight">POS Billing Terminal</h1>
                <p className="text-xs text-text-muted mt-0.5">Counter point-of-sale checkout and instant receipt billing.</p>
            </div>

            <div className="flex flex-col items-center justify-center p-16 bg-card-bg border border-border rounded-xl text-center shadow-xs">
                <Construction className="text-primary mb-3" size={40} />
                <h3 className="text-base font-bold text-text-main mb-1">POS Counter Terminal</h3>
                <p className="text-xs text-text-muted max-w-sm">Coming Soon — Point of Sale counter billing module is under development.</p>
            </div>
        </div>
    );
}
