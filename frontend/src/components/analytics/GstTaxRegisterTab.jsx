import { FileText, Receipt, CheckCircle, Percent } from 'lucide-react';

export default function GstTaxRegisterTab() {
    const taxRegister = [
        { month: 'April 2026', taxableAmount: '₹1,50,00,000', cgst: '₹13,50,000', sgst: '₹13,50,000', igst: '₹0', totalGst: '₹27,00,000', status: 'Filed GSTR-3B' },
        { month: 'May 2026', taxableAmount: '₹2,25,00,000', cgst: '₹20,25,000', sgst: '₹20,25,000', igst: '₹0', totalGst: '₹40,50,000', status: 'Filed GSTR-3B' },
        { month: 'June 2026', taxableAmount: '₹2,70,00,000', cgst: '₹18,00,000', sgst: '₹18,00,000', igst: '₹12,60,000', totalGst: '₹48,60,000', status: 'Filed GSTR-3B' },
        { month: 'July 2026', taxableAmount: '₹3,40,00,000', cgst: '₹30,60,000', sgst: '₹30,60,000', igst: '₹0', totalGst: '₹61,20,000', status: 'Pending Filing' }
    ];

    return (
        <div className="space-y-5 font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total Taxable Turnover</span>
                        <Receipt size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">₹9.85 Cr</div>
                    <div className="text-[10px] text-text-muted">FY 2026-27 Output Sales</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total GST Collected (18%)</span>
                        <Percent size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">₹1.77 Cr</div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">CGST + SGST + IGST</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Input Tax Credit (ITC)</span>
                        <FileText size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">₹1.12 Cr</div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">Set-off from PP Purchase</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Net Cash Tax Payable</span>
                        <CheckCircle size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-primary font-mono">₹65.00 L</div>
                    <div className="text-[10px] text-text-muted">Paid via Electronic Cash Ledger</div>
                </div>
            </div>

            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        GSTR-1 & GSTR-3B STATUTORY TAX REGISTER (MONTHLY)
                    </h3>
                    <span className="text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                        • GSTIN: 24AAACA1234A1Z5
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Return Period</th>
                                <th className="p-3 border-b border-border font-mono">Taxable Sales</th>
                                <th className="p-3 border-b border-border font-mono">CGST (9%)</th>
                                <th className="p-3 border-b border-border font-mono">SGST (9%)</th>
                                <th className="p-3 border-b border-border font-mono">IGST (18%)</th>
                                <th className="p-3 border-b border-border font-mono">Total GST Liability</th>
                                <th className="p-3 border-b border-border">Filing Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {taxRegister.map((r, i) => (
                                <tr key={i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                    <td className="p-3 font-bold text-text-main">{r.month}</td>
                                    <td className="p-3 font-mono font-semibold">{r.taxableAmount}</td>
                                    <td className="p-3 font-mono text-text-muted">{r.cgst}</td>
                                    <td className="p-3 font-mono text-text-muted">{r.sgst}</td>
                                    <td className="p-3 font-mono text-text-muted">{r.igst}</td>
                                    <td className="p-3 font-mono font-extrabold text-primary">{r.totalGst}</td>
                                    <td className="p-3">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            r.status.includes('Filed')
                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
