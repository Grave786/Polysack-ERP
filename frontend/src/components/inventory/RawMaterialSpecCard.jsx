import { Pencil, Layers, Tag } from 'lucide-react';

export default function RawMaterialSpecCard({ rawMaterial, onEdit }) {
    if (!rawMaterial) return null;

    const code = rawMaterial.code || 'RM-SPEC';
    const name = rawMaterial.name || 'Raw Material';
    const categoryName = typeof rawMaterial.category === 'object' ? rawMaterial.category?.name : 'General';
    const uomSymbol = typeof rawMaterial.uom === 'object' ? (rawMaterial.uom?.symbol || rawMaterial.uom?.name) : 'Kg';
    const currentStock = rawMaterial.currentStock || 0;
    const reorderLevel = rawMaterial.reorderLevel || 0;
    const pricePerUnit = rawMaterial.pricePerUnit || 0;

    const isLowStock = currentStock <= reorderLevel;

    return (
        <div className="bg-card-bg border border-border rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3 font-sans">
            {/* Top Row: Code & Edit Button */}
            <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[11px] font-mono font-bold text-text-muted uppercase tracking-wider">
                    {code}
                </span>

                {onEdit && (
                    <button
                        type="button"
                        onClick={() => onEdit(rawMaterial)}
                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                        title="Edit Raw Material"
                    >
                        <Pencil size={14} />
                    </button>
                )}
            </div>

            {/* Title / Name */}
            <div>
                <h3 className="text-sm font-bold text-text-main leading-snug line-clamp-2">
                    {name}
                </h3>
            </div>

            {/* 2x2 Grid of Small Stat Blocks */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                {/* CATEGORY Block */}
                <div className="bg-purple-50/80 border border-purple-200/80 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-800">
                        CATEGORY
                    </span>
                    <span className="text-xs font-bold text-purple-950 mt-0.5 truncate">
                        {categoryName}
                    </span>
                </div>

                {/* UOM Block */}
                <div className="bg-cyan-50/80 border border-cyan-200/80 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-800">
                        UOM
                    </span>
                    <span className="text-xs font-bold text-cyan-950 mt-0.5 font-mono">
                        {uomSymbol}
                    </span>
                </div>

                {/* CURRENT STOCK Block */}
                <div className={`border rounded-lg p-2 flex flex-col ${
                    isLowStock ? 'bg-rose-50/80 border-rose-200/80' : 'bg-emerald-50/80 border-emerald-200/80'
                }`}>
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
                        isLowStock ? 'text-rose-800' : 'text-emerald-800'
                    }`}>
                        CURRENT STOCK
                    </span>
                    <span className={`text-xs font-bold font-mono mt-0.5 ${
                        isLowStock ? 'text-rose-950' : 'text-emerald-950'
                    }`}>
                        {currentStock} {uomSymbol}
                    </span>
                </div>

                {/* REORDER LEVEL Block */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-700">
                        REORDER LEVEL
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                        {reorderLevel} {uomSymbol}
                    </span>
                </div>
            </div>

            {/* Pricing Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                <span className="flex items-center gap-1 font-medium text-text-main">
                    <Tag size={13} className="text-text-muted" />
                    Unit Price: <strong className="font-mono text-primary">₹{pricePerUnit}</strong> / {uomSymbol}
                </span>

                {isLowStock && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                        Low Stock Alert
                    </span>
                )}
            </div>
        </div>
    );
}
