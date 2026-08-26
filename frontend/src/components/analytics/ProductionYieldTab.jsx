import { Activity, Gauge, Flame, Percent } from 'lucide-react';

export default function ProductionYieldTab() {
    const yieldData = [
        { stage: 'Extrusion Tape Line', inputKg: 154500, outputKg: 152800, scrapKg: 1700, efficiency: '98.9%' },
        { stage: 'Circular Weaving (Loom)', inputKg: 152800, outputKg: 149600, scrapKg: 3200, efficiency: '97.9%' },
        { stage: 'Lamination Plant', inputKg: 149600, outputKg: 147800, scrapKg: 1800, efficiency: '98.8%' },
        { stage: 'Conversion & Cutting', inputKg: 147800, outputKg: 145900, scrapKg: 1900, efficiency: '98.7%' }
    ];

    return (
        <div className="space-y-5 font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Overall Plant Yield</span>
                        <Gauge size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">94.4%</div>
                    <div className="text-[10px] text-text-muted">Target: &gt;94.0%</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Tape Line Efficiency</span>
                        <Activity size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">98.9%</div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">+0.4% vs last month</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total Process Scrap</span>
                        <Flame size={16} className="text-rose-500" />
                    </div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono">8,600 Kg</div>
                    <div className="text-[10px] text-text-muted">Re-granulated in-house</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Loom Weaving Waste</span>
                        <Percent size={16} className="text-primary" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">2.1%</div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">Within ISO spec</div>
                </div>
            </div>

            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        PROCESS YIELD & SCRAP RECOVERY BREAKDOWN (MT / KG)
                    </h3>
                    <span className="text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                        • Verified Mass Balance
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Production Process Stage</th>
                                <th className="p-3 border-b border-border font-mono">Input Material (Kg)</th>
                                <th className="p-3 border-b border-border font-mono">Good Output (Kg)</th>
                                <th className="p-3 border-b border-border font-mono">Scrap / Waste (Kg)</th>
                                <th className="p-3 border-b border-border font-mono">Efficiency %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {yieldData.map((r, i) => (
                                <tr key={i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                    <td className="p-3 font-bold text-text-main">{r.stage}</td>
                                    <td className="p-3 font-mono font-medium">{r.inputKg.toLocaleString()} kg</td>
                                    <td className="p-3 font-mono font-bold text-emerald-700">{r.outputKg.toLocaleString()} kg</td>
                                    <td className="p-3 font-mono font-medium text-rose-600">{r.scrapKg.toLocaleString()} kg</td>
                                    <td className="p-3 font-mono font-extrabold">{r.efficiency}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
