import { useState, useEffect } from 'react';
import { DollarSign, Package, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';

export default function InventoryValuationSummary() {
    const [rawMaterials, setRawMaterials] = useState([]);
    const [finishedGoods, setFinishedGoods] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInventoryData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [rmRes, fgRes] = await Promise.all([
                axiosInstance.get('/raw-materials?limit=200'),
                axiosInstance.get('/finished-goods?limit=200')
            ]);

            if (rmRes.data?.success) {
                setRawMaterials(rmRes.data.data || []);
            }
            if (fgRes.data?.success) {
                setFinishedGoods(fgRes.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching valuation data:', err);
            setError('Failed to calculate inventory valuation');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInventoryData();
    }, []);

    // Valuation calculations
    const rmTotalValuation = rawMaterials.reduce((acc, rm) => {
        const qty = Number(rm.currentStock || 0);
        const price = Number(rm.pricePerUnit || 0);
        return acc + (qty * price);
    }, 0);

    const fgTotalValuation = finishedGoods.reduce((acc, fg) => {
        const qty = Number(fg.currentStock || 0);
        const price = Number(fg.pricePerBag || fg.price || 0);
        return acc + (qty * price);
    }, 0);

    const combinedTotalValuation = rmTotalValuation + fgTotalValuation;

    // Combined item breakdown array
    const breakdownItems = [
        ...finishedGoods.map((fg) => ({
            _id: fg._id,
            code: fg.code || 'FG',
            name: fg.name,
            type: 'Finished Good',
            stock: fg.currentStock || 0,
            uom: 'Bags',
            unitPrice: fg.pricePerBag || fg.price || 0,
            totalValuation: (fg.currentStock || 0) * (fg.pricePerBag || fg.price || 0)
        })),
        ...rawMaterials.map((rm) => ({
            _id: rm._id,
            code: rm.code || 'RM',
            name: rm.name,
            type: 'Raw Material',
            stock: rm.currentStock || 0,
            uom: typeof rm.uom === 'object' ? (rm.uom?.symbol || rm.uom?.name) : 'Kg',
            unitPrice: rm.pricePerUnit || 0,
            totalValuation: (rm.currentStock || 0) * (rm.pricePerUnit || 0)
        }))
    ].sort((a, b) => b.totalValuation - a.totalValuation);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-14 bg-card-bg border border-border rounded-xl font-sans">
                <RefreshCw className="animate-spin text-primary mb-3" size={24} />
                <p className="text-xs font-semibold text-text-muted">Calculating real-time inventory valuation...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* COMBINED TOTAL VALUATION */}
                <div className="bg-sidebar-bg text-sidebar-text-active border border-sidebar-hover rounded-xl p-5 shadow-xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-sidebar-text">
                            Total Inventory Valuation
                        </span>
                        <h2 className="text-2xl font-extrabold font-mono text-white mt-1">
                            ₹{combinedTotalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </h2>
                        <p className="text-[10px] text-emerald-400 mt-1">
                            Live valuation across all stock items
                        </p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl text-amber-400">
                        <DollarSign size={26} />
                    </div>
                </div>

                {/* FINISHED GOODS VALUATION */}
                <div className="bg-card-bg border border-border rounded-xl p-5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            Finished Goods Valuation
                        </span>
                        <h2 className="text-xl font-bold font-mono text-text-main mt-1">
                            ₹{fgTotalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </h2>
                        <p className="text-[10px] text-text-muted mt-1">
                            {finishedGoods.length} finished bag specifications
                        </p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                        <Package size={24} />
                    </div>
                </div>

                {/* RAW MATERIALS VALUATION */}
                <div className="bg-card-bg border border-border rounded-xl p-5 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            Raw Materials Valuation
                        </span>
                        <h2 className="text-xl font-bold font-mono text-text-main mt-1">
                            ₹{rmTotalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </h2>
                        <p className="text-[10px] text-text-muted mt-1">
                            {rawMaterials.length} raw material items in stock
                        </p>
                    </div>
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                        <Layers size={24} />
                    </div>
                </div>
            </div>

            {/* Itemized Stock Valuation Breakdown Table */}
            <div className="bg-card-bg border border-border rounded-xl p-5 shadow-2xs space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-text-main">
                            Itemized Stock Valuation Breakdown
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            Individual stock asset valuation (Current Stock Quantity × Unit Selling/Purchase Price)
                        </p>
                    </div>

                    <span className="text-xs font-mono font-bold text-text-muted bg-app-bg px-2.5 py-1 rounded-md border border-border">
                        {breakdownItems.length} Total Items
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-app-bg border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            <tr>
                                <th className="p-3">ITEM CODE</th>
                                <th className="p-3">ITEM NAME / SPECIFICATION</th>
                                <th className="p-3">ITEM TYPE</th>
                                <th className="p-3 text-right">CURRENT STOCK</th>
                                <th className="p-3 text-right">UNIT PRICE (₹)</th>
                                <th className="p-3 text-right">TOTAL STOCK VALUATION (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {breakdownItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted text-xs">
                                        No inventory stock items available to evaluate.
                                    </td>
                                </tr>
                            ) : (
                                breakdownItems.map((item) => (
                                    <tr key={item._id} className="hover:bg-app-bg/50 transition-colors">
                                        <td className="p-3 font-mono font-bold text-text-main uppercase">
                                            {item.code}
                                        </td>
                                        <td className="p-3 font-semibold text-text-main">
                                            {item.name}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                item.type === 'Finished Good'
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                                            }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-text-main">
                                            {item.stock.toLocaleString('en-IN')} <span className="text-[10px] font-sans font-normal text-text-muted">{item.uom}</span>
                                        </td>
                                        <td className="p-3 text-right font-mono text-text-muted">
                                            ₹{item.unitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-primary">
                                            ₹{item.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
