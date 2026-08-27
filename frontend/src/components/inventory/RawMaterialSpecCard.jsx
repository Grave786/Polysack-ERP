import { Pencil, Tag, MapPin, Truck, Layers, Hash, Palette } from 'lucide-react';

export default function RawMaterialSpecCard({ rawMaterial, onEdit }) {
    if (!rawMaterial) return null;

    const code = rawMaterial.code || 'RM-SPEC';
    const name = rawMaterial.name || 'Raw Material';
    const categoryName = typeof rawMaterial.category === 'object' ? rawMaterial.category?.name : 'General';
    const uomSymbol = typeof rawMaterial.uom === 'object' ? (rawMaterial.uom?.symbol || rawMaterial.uom?.name) : 'Kg';
    const currentStock = rawMaterial.currentStock || 0;
    const reorderLevel = rawMaterial.reorderLevel || 0;
    
    // 7 New Industrial Spec Fields
    const materialGrade = rawMaterial.materialGrade || 'Virgin Grade 100';
    const color = rawMaterial.color || 'Natural White';
    const hsnCode = rawMaterial.hsnCode || '39012000';
    const moq = rawMaterial.moq || 1000;
    const standardCost = rawMaterial.pricePerUnit || 0;
    const lastPurchasePrice = rawMaterial.lastPurchasePrice || standardCost;
    
    const supplierObj = rawMaterial.preferredSupplier || rawMaterial.defaultSupplier;
    const supplierName = typeof supplierObj === 'object' ? (supplierObj?.companyName || supplierObj?.name) : 'Unassigned';

    const locationObj = rawMaterial.warehouseLocation || rawMaterial.defaultLocation;
    const locationName = typeof locationObj === 'object' ? locationObj?.name : 'Raw Material Warehouse Bay A';

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

            {/* 2x2 Grid of Primary Technical Specs */}
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
                        {currentStock.toLocaleString('en-IN')} {uomSymbol}
                    </span>
                </div>

                {/* REORDER LEVEL Block */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-700">
                        REORDER LEVEL
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                        {reorderLevel.toLocaleString('en-IN')} {uomSymbol}
                    </span>
                </div>
            </div>

            {/* Industrial Attributes Detail List */}
            <div className="bg-app-bg/60 border border-border/80 rounded-lg p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-text-muted">
                    <Layers size={13} className="text-primary shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Grade/Spec:</span>
                    <span className="font-bold text-text-main truncate">{materialGrade}</span>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Palette size={13} className="text-amber-600 shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Color:</span>
                    <span className="font-bold text-text-main truncate">{color}</span>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Hash size={13} className="text-slate-600 shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">HSN Code:</span>
                    <span className="font-mono font-bold text-text-main shrink-0">{hsnCode}</span>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Truck size={13} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Supplier:</span>
                    <span className="font-bold text-text-main truncate">{supplierName}</span>
                </div>
            </div>

            {/* Pricing & MOQ Banner */}
            <div className="bg-purple-50/50 border border-purple-200/60 rounded-lg p-2 flex items-center justify-between text-xs font-mono font-bold">
                <div>
                    <span className="text-[9px] text-text-muted uppercase font-sans font-extrabold block">VALUATION COST</span>
                    <span className="text-xs text-purple-900">₹{Number(standardCost).toFixed(2)}</span>
                </div>
                <div className="text-center">
                    <span className="text-[9px] text-text-muted uppercase font-sans font-extrabold block">LAST GRN PRICE</span>
                    <span className="text-xs text-primary">₹{Number(lastPurchasePrice).toFixed(2)}</span>
                </div>
                <div className="text-right font-sans">
                    <span className="text-[9px] text-text-muted uppercase font-extrabold block">MOQ</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{moq} {uomSymbol}</span>
                </div>
            </div>

            {/* Storage Location & Alert Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                <span className="flex items-center gap-1 font-medium text-text-main truncate">
                    <MapPin size={13} className="text-amber-600 shrink-0" />
                    <span className="truncate">{locationName}</span>
                </span>

                {isLowStock ? (
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">
                        Low Stock Alert
                    </span>
                ) : (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                        In Stock
                    </span>
                )}
            </div>
        </div>
    );
}
