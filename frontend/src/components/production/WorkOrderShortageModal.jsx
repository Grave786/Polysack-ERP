import { useState, useEffect } from 'react';
import { AlertTriangle, ShoppingCart, RefreshCw, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export default function WorkOrderShortageModal({ isOpen, onClose, shortages = [], targetFgName = '', onPoCreated }) {
    const [suppliers, setSuppliers] = useState([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState({});
    const [existingPos, setExistingPos] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            axiosInstance.get('/suppliers?isActive=true&limit=100')
                .then(res => setSuppliers(res.data?.data || []))
                .catch(() => setSuppliers([]));

            axiosInstance.get('/purchase-orders?limit=100')
                .then(res => {
                    const openList = (res.data?.data || []).filter(po => ['PENDING_APPROVAL', 'SENT_TO_SUPPLIER', 'DRAFT'].includes(po.status));
                    setExistingPos(openList);
                })
                .catch(() => setExistingPos([]));
        }
    }, [isOpen]);

    if (!isOpen || shortages.length === 0) return null;

    // Check if any open PO already covers shortages
    const coveredShortages = shortages.map(item => {
        const matchingPo = existingPos.find(po =>
            ['PENDING_APPROVAL', 'SENT_TO_SUPPLIER', 'DRAFT'].includes(po.status) &&
            po.items?.some(i => (typeof i.rawMaterial === 'object' ? String(i.rawMaterial?._id) : String(i.rawMaterial)) === String(item.rawMaterialId))
        );
        return { ...item, matchingPo };
    });

    const unCoveredShortages = coveredShortages.filter(i => !i.matchingPo);
    const hasExistingCoveringPo = coveredShortages.some(i => i.matchingPo);
    const isAllCovered = unCoveredShortages.length === 0;

    const handleSupplierChange = (rmId, supplierId) => {
        setSelectedSuppliers(prev => ({ ...prev, [rmId]: supplierId }));
    };

    const handleGenerateDraftPOs = async () => {
        try {
            setIsGenerating(true);

            // Group UNCOVERED shortages by supplier
            const itemsToProcess = unCoveredShortages.length > 0 ? unCoveredShortages : coveredShortages;
            const groupedBySupplier = {};

            for (const item of itemsToProcess) {
                const suppId = item.supplierId || selectedSuppliers[item.rawMaterialId] || (suppliers[0]?._id);
                if (!suppId) {
                    toast.error(`Please select a supplier for material '${item.rawMaterialName}'.`);
                    setIsGenerating(false);
                    return;
                }

                if (!groupedBySupplier[suppId]) {
                    groupedBySupplier[suppId] = [];
                }

                groupedBySupplier[suppId].push({
                    rawMaterial: item.rawMaterialId,
                    orderedQuantity: Math.abs(item.shortageQty),
                    ratePerUnit: item.unitPrice || 120
                });
            }

            const createdPoNumbers = [];
            const failedErrors = [];

            for (const [supplierId, poItems] of Object.entries(groupedBySupplier)) {
                const payload = {
                    supplier: supplierId,
                    items: poItems,
                    status: 'PENDING_APPROVAL',
                    expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    notes: `Auto-generated shortage PO for '${targetFgName}'`
                };

                try {
                    const res = await axiosInstance.post('/purchase-orders', payload);
                    if (res.data?.success) {
                        createdPoNumbers.push(res.data.data?.poNumber || 'PO');
                    } else {
                        failedErrors.push(res.data?.message || 'Failed to generate PO');
                    }
                } catch (poErr) {
                    failedErrors.push(poErr.response?.data?.message || 'Failed to generate PO');
                }
            }

            if (createdPoNumbers.length > 0 && failedErrors.length === 0) {
                toast.success(`Generated ${createdPoNumbers.length} PO(s) [${createdPoNumbers.join(', ')}] with status 'PENDING_APPROVAL'!`, { duration: 5000 });
            } else if (createdPoNumbers.length > 0 && failedErrors.length > 0) {
                toast.error(`${createdPoNumbers.length} PO(s) created [${createdPoNumbers.join(', ')}], but ${failedErrors.length} failed: ${failedErrors.join('; ')}`, { duration: 6000 });
            } else {
                toast.error(failedErrors[0] || 'Failed to generate draft POs.');
            }

            try {
                if (onPoCreated) onPoCreated();
            } catch (cbErr) {
                console.error('Error executing onPoCreated callback:', cbErr);
            }

            onClose();
        } catch (err) {
            console.error('Failed to generate draft POs:', err);
            toast.error(err.response?.data?.message || 'Failed to generate draft POs.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card-bg border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-5 py-4 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg shrink-0">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider">
                            Material Shortage Detected
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            Target production for <strong className="text-text-main">{targetFgName}</strong> exceeds available raw material stock. Work Order creation blocked.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-app-bg text-[11px] font-bold text-text-muted uppercase border-b border-border">
                                    <th className="py-2.5 px-3">Raw Material</th>
                                    <th className="py-2.5 px-3 text-right">In-Stock</th>
                                    <th className="py-2.5 px-3 text-right">Required</th>
                                    <th className="py-2.5 px-3 text-right text-rose-700">Shortage Gap</th>
                                    <th className="py-2.5 px-3">Supplier / Existing PO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {coveredShortages.map((item) => (
                                    <tr key={item.rawMaterialId} className="hover:bg-app-bg/50">
                                        <td className="py-2.5 px-3 font-semibold text-text-main">
                                            {item.rawMaterialName}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-medium text-text-muted">
                                            {item.currentStock} {item.uom || 'KG'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-text-main">
                                            {item.requiredQty} {item.uom || 'KG'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-rose-700">
                                            {Math.abs(item.shortageQty)} {item.uom || 'KG'} short
                                        </td>
                                        <td className="py-2.5 px-3">
                                            {item.matchingPo ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                                    <ShieldAlert size={12} />
                                                    <span>PO {item.matchingPo.poNumber} ({item.matchingPo.status}) Covers Shortage</span>
                                                </span>
                                            ) : item.supplierName ? (
                                                <span className="font-semibold text-text-main">{item.supplierName}</span>
                                            ) : (
                                                <select
                                                    value={selectedSuppliers[item.rawMaterialId] || ''}
                                                    onChange={(e) => handleSupplierChange(item.rawMaterialId, e.target.value)}
                                                    className="w-full border border-border rounded p-1 text-[11px] bg-card-bg text-text-main focus:border-primary"
                                                >
                                                    <option value="">-- Select Supplier --</option>
                                                    {suppliers.map(s => (
                                                        <option key={s._id} value={s._id}>
                                                            {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {isAllCovered ? (
                        <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                            <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-extrabold text-amber-900 uppercase">Existing Purchase Order Awaiting Approval:</span>
                                <p className="mt-0.5">
                                    A pending purchase order (<strong>{coveredShortages[0]?.matchingPo?.poNumber}</strong> — status: <strong>{coveredShortages[0]?.matchingPo?.status}</strong>) already covers this shortage gap. Duplicate PO creation is disabled.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-app-bg border border-border rounded-lg text-xs text-text-muted flex items-start gap-2">
                            <ShoppingCart size={16} className="text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold text-text-main">Auto-PO Purchase Order Routing:</span>
                                <p className="mt-0.5">
                                    Clicking "Auto-Generate Draft PO" will issue purchase order(s) for shortage quantities directly with status <strong className="text-amber-700 uppercase">PENDING_APPROVAL</strong>.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 bg-app-bg border-t border-border flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                    >
                        Adjust Work Order Qty
                    </button>

                    <button
                        type="button"
                        onClick={handleGenerateDraftPOs}
                        disabled={isGenerating || isAllCovered}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Generating POs...</span>
                            </>
                        ) : isAllCovered ? (
                            <>
                                <ShieldAlert size={14} />
                                <span>Awaiting Existing PO Approval</span>
                            </>
                        ) : (
                            <>
                                <ShoppingCart size={14} />
                                <span>Auto-Generate Draft PO (Pending Approval)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
