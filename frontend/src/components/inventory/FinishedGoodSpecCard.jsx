import { Pencil, Package, ShieldAlert, Tag, MapPin, Palette, Layers } from 'lucide-react';

export default function FinishedGoodSpecCard({ finishedGood, onEdit }) {
    if (!finishedGood) return null;

    const code = finishedGood.code || 'FG-SPEC';
    const name = finishedGood.name || 'Poly Bag Specification';
    const gsm = finishedGood.fabricGSM || finishedGood.gsm || 'N/A';
    const rawShape = finishedGood.bagShape || 'FLAT';
    const shapeFormatted = rawShape.charAt(0).toUpperCase() + rawShape.slice(1).toLowerCase().replace('_', ' ');

    const width = finishedGood.dimensions?.width || 0;
    const length = finishedGood.dimensions?.length || 0;
    const capacity = finishedGood.bagCapacity || finishedGood.capacity || 0;
    const currentStock = finishedGood.currentStock || 0;
    const pendingQCStock = finishedGood.pendingQCStock || 0;

    // Reference Spec Fields
    const bagType = finishedGood.bagType || 'Laminated PP Woven Sack';
    const colorAndPrint = finishedGood.colorAndPrint || 'Milky White (2-Color Flexo)';
    const warehouseLocation = finishedGood.warehouseLocation || 'Finished Goods Warehouse - Bay 1';
    const retailPrice = finishedGood.retailPrice || finishedGood.pricePerBag || 0;
    const wholesalePrice = finishedGood.wholesalePrice || (retailPrice > 0 ? Math.round(retailPrice * 0.88 * 100) / 100 : 0);

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
                        onClick={() => onEdit(finishedGood)}
                        className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-app-bg transition-colors cursor-pointer"
                        title="Edit Specification"
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
                {/* FABRIC GSM Block */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-800">
                        FABRIC GSM
                    </span>
                    <span className="text-xs font-bold text-amber-950 mt-0.5 font-mono">
                        {gsm} GSM
                    </span>
                </div>

                {/* BAG SHAPE Block */}
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-800">
                        BAG SHAPE
                    </span>
                    <span className="text-xs font-bold text-blue-950 mt-0.5 truncate">
                        {shapeFormatted}
                    </span>
                </div>

                {/* DIMENSIONS Block */}
                <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-700">
                        DIMENSIONS (W × L)
                    </span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                        {width} × {length} cm
                    </span>
                </div>

                {/* BAG CAPACITY Block */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-2 flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800">
                        BAG CAPACITY
                    </span>
                    <span className="text-xs font-bold text-emerald-950 mt-0.5 font-mono">
                        {capacity} Kg
                    </span>
                </div>
            </div>

            {/* Detailed Industrial Attributes List */}
            <div className="bg-app-bg/60 border border-border/80 rounded-lg p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-text-muted">
                    <Layers size={13} className="text-primary shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Bag Type:</span>
                    <span className="font-bold text-text-main truncate">{bagType}</span>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Palette size={13} className="text-purple-600 shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Color & Print:</span>
                    <span className="font-bold text-text-main truncate">{colorAndPrint}</span>
                </div>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <MapPin size={13} className="text-amber-600 shrink-0" />
                    <span className="font-semibold text-text-muted shrink-0">Bay / Loc:</span>
                    <span className="font-bold text-text-main truncate">{warehouseLocation}</span>
                </div>
            </div>

            {/* Pricing Side-by-Side Banner */}
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-lg p-2 flex items-center justify-between text-xs font-mono font-bold">
                <div>
                    <span className="text-[9px] text-text-muted uppercase font-sans font-extrabold block">RETAIL PRICE</span>
                    <span className="text-xs text-emerald-700">₹{Number(retailPrice).toFixed(2)}</span>
                </div>
                <div className="text-right">
                    <span className="text-[9px] text-text-muted uppercase font-sans font-extrabold block">WHOLESALE PRICE</span>
                    <span className="text-xs text-primary">₹{Number(wholesalePrice).toFixed(2)}</span>
                </div>
            </div>

            {/* Stock Information Footer */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <Package size={13} />
                    <strong>{currentStock.toLocaleString('en-IN')}</strong> sellable
                </span>

                <span className="flex items-center gap-1 font-medium text-amber-700">
                    <ShieldAlert size={13} />
                    <strong>{pendingQCStock.toLocaleString('en-IN')}</strong> pending QC
                </span>
            </div>
        </div>
    );
}
