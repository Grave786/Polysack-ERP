import { Package, Layers, Boxes, ShieldAlert } from 'lucide-react';

export default function InventoryValuationTab() {
    const valuationList = [
        { category: 'PP Raffia Granules (Virgin)', type: 'Raw Material', stock: '45,000 Kg', rate: '₹108 / Kg', totalVal: '₹48,60,000' },
        { category: 'Masterbatch & Colorants', type: 'Raw Material', stock: '3,200 Kg', rate: '₹240 / Kg', totalVal: '₹7,68,000' },
        { category: 'Unprinted Tubular Fabric', type: 'WIP Fabric Roll', stock: '18,500 Kg', rate: '₹135 / Kg', totalVal: '₹24,97,500' },
        { category: 'HDPE / PP Finished Woven Bags', type: 'Finished Goods', stock: '2,50,000 Bags', rate: '₹14.50 / Bag', totalVal: '₹36,25,000' },
        { category: 'Baled Scrap / Regrind Granules', type: 'Scrap Stock', stock: '12,000 Kg', rate: '₹65 / Kg', totalVal: '₹7,80,000' }
    ];

    return (
        <div className="space-y-5 font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Total Inventory Asset Value</span>
                        <Package size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">₹1.25 Cr</div>
                    <div className="text-[10px] text-text-muted">Audited Asset Valuation</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Raw Material Valuation</span>
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-extrabold text-text-main font-mono">₹56.28 L</div>
                    <div className="text-[10px] text-text-muted">PP Granules & Additives</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Finished Bags Valuation</span>
                        <Boxes size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">₹36.25 L</div>
                    <div className="text-[10px] text-emerald-600 font-extrabold">2.5 Lakh Finished Bags</div>
                </div>

                <div className="bg-card-bg border border-border p-4 rounded-xl shadow-2xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted">
                        <span className="text-[11px] font-bold uppercase">Slow Moving Stock</span>
                        <ShieldAlert size={16} className="text-rose-500" />
                    </div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono">₹4.20 L</div>
                    <div className="text-[10px] text-rose-600 font-extrabold">Requires Clearance</div>
                </div>
            </div>

            <div className="bg-card-bg border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-border bg-app-bg flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider">
                        STOCK ASSET VALUATION LEDGER (FIFO METHOD)
                    </h3>
                    <span className="text-[10px] font-mono font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full">
                        • Verified FIFO Asset Rates
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                            <tr className="bg-table-header-bg text-table-header-text font-extrabold uppercase text-[10px]">
                                <th className="p-3 border-b border-border">Stock Category</th>
                                <th className="p-3 border-b border-border">Item Classification</th>
                                <th className="p-3 border-b border-border font-mono">Current Quantity</th>
                                <th className="p-3 border-b border-border font-mono">Unit Rate</th>
                                <th className="p-3 border-b border-border font-mono">Total Valuation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {valuationList.map((r, i) => (
                                <tr key={i} className="hover:bg-app-bg/50 transition-colors text-text-main">
                                    <td className="p-3 font-bold text-text-main">{r.category}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-app-bg border border-border">
                                            {r.type}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono font-semibold">{r.stock}</td>
                                    <td className="p-3 font-mono text-text-muted">{r.rate}</td>
                                    <td className="p-3 font-mono font-extrabold text-primary">{r.totalVal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
