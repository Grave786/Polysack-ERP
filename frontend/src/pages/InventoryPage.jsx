import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sliders, LayoutGrid, List } from 'lucide-react';
import TabbedResourcePage from '../components/shared/TabbedResourcePage';
import FinishedGoodSpecCard from '../components/inventory/FinishedGoodSpecCard';
import RawMaterialSpecCard from '../components/inventory/RawMaterialSpecCard';
import InventoryValuationSummary from '../components/inventory/InventoryValuationSummary';
import StockAdjustmentPanel from '../components/inventory/StockAdjustmentPanel';

export default function InventoryPage() {
    const [searchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');


    const [activeTabKey, setActiveTabKey] = useState(tabFromUrl || 'finished-goods');
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [isAdjustmentPanelOpen, setIsAdjustmentPanelOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Synchronize active tab with URL query parameter when changed
    useEffect(() => {
        if (tabFromUrl) {
            setActiveTabKey(tabFromUrl);
        }
    }, [tabFromUrl]);

    // Columns config for Finished Bags Data Table View
    const finishedGoodsColumns = [
        {
            header: 'SPEC CODE',
            render: (row) => <span className="font-mono font-bold uppercase">{row.code || '-'}</span>,
            sortable: true
        },
        {
            header: 'BAG SPECIFICATION NAME',
            accessor: 'name',
            sortable: true
        },
        {
            header: 'CATEGORY',
            render: (row) => (typeof row.category === 'object' ? row.category?.name : row.category) || '-'
        },
        {
            header: 'GSM',
            render: (row) => <span className="font-mono font-semibold">{row.fabricGSM || row.gsm || '-'}</span>
        },
        {
            header: 'DIMENSIONS (W×L)',
            render: (row) => (
                <span className="font-mono">
                    {row.dimensions && (row.dimensions.width || row.dimensions.length)
                        ? `${row.dimensions.width || 0} × ${row.dimensions.length || 0} ${row.dimensions?.unit || row.dimensionUnit || 'cm'}`
                        : '-'}
                </span>
            )
        },
        {
            header: 'SELLABLE STOCK',
            render: (row) => (
                <span className="font-mono font-bold text-emerald-700">
                    {row.currentStock !== undefined ? row.currentStock.toLocaleString('en-IN') : 0} Bags
                </span>
            )
        },
        {
            header: 'PRICE / BAG',
            render: (row) => (
                <span className="font-mono font-semibold text-primary">
                    ₹{row.pricePerBag || row.price || 0}
                </span>
            )
        }
    ];

    // Columns config for Raw Materials Data Table View
    const rawMaterialsColumns = [
        {
            header: 'ITEM CODE',
            render: (row) => <span className="font-mono font-bold uppercase">{row.code || '-'}</span>,
            sortable: true
        },
        {
            header: 'MATERIAL NAME',
            accessor: 'name',
            sortable: true
        },
        {
            header: 'CATEGORY',
            render: (row) => (typeof row.category === 'object' ? row.category?.name : row.category) || '-'
        },
        {
            header: 'UOM',
            render: (row) => (typeof row.uom === 'object' ? (row.uom?.symbol || row.uom?.name) : row.uom) || 'Kg'
        },
        {
            header: 'CURRENT STOCK',
            render: (row) => (
                <span className="font-mono font-bold text-emerald-700">
                    {row.currentStock !== undefined ? row.currentStock.toLocaleString('en-IN') : 0}
                </span>
            )
        },
        {
            header: 'REORDER LEVEL',
            render: (row) => <span className="font-mono font-medium">{row.reorderLevel || 0}</span>
        },
        {
            header: 'PRICE / UNIT',
            render: (row) => (
                <span className="font-mono font-semibold text-primary">
                    ₹{row.pricePerUnit || 0}
                </span>
            )
        }
    ];

    // Columns config for Audit Ledger Tab
    const auditLedgerColumns = [
        {
            header: 'REF #',
            exportValue: (row) => row.referenceNumber || (row._id ? String(row._id).slice(-6) : ''),
            render: (row) => <span className="font-mono font-bold uppercase">{row.referenceNumber || row._id?.slice(-6) || '-'}</span>,
            sortable: true
        },
        {
            header: 'TRANSACTION TYPE',
            exportValue: (row) => (row.transactionType || 'ADJUSTMENT').replace(/_/g, ' '),
            render: (row) => {
                const type = row.transactionType || 'ADJUSTMENT';
                const isReceipt = type.includes('RECEIPT') || type.includes('IN') || type === 'ADJUSTMENT';
                const isIssue = type.includes('ISSUE') || type.includes('CONSUMPTION') || type.includes('OUT');

                return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isReceipt
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isIssue
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                        {type.replace('_', ' ')}
                    </span>
                );
            }
        },
        {
            header: 'ITEM NAME',
            exportValue: (row) => row.item?.name || row.finishedGood?.name || row.rawMaterial?.name || row.notes || 'Stock Item',
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {row.item?.name || row.finishedGood?.name || row.rawMaterial?.name || row.notes || 'Stock Item'}
                </span>
            )
        },
        {
            header: 'QUANTITY',
            exportValue: (row) => (row.quantity !== undefined ? row.quantity : 0),
            render: (row) => (
                <span className="font-mono font-bold text-text-main">
                    {row.quantity !== undefined ? row.quantity.toLocaleString('en-IN') : 0}
                </span>
            )
        },
        {
            header: 'BEFORE → AFTER',
            exportValue: (row) => `${row.previousStock !== undefined ? row.previousStock : '-'} -> ${row.newStock !== undefined ? row.newStock : '-'}`,
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.previousStock !== undefined ? row.previousStock.toLocaleString('en-IN') : '-'} → <strong className="text-text-main">{row.newStock !== undefined ? row.newStock.toLocaleString('en-IN') : '-'}</strong>
                </span>
            )
        },
        {
            header: 'FROM → TO LOCATION',
            exportValue: (row) => `${row.fromLocation?.name || 'Main Warehouse'} -> ${row.toLocation?.name || 'Shop Floor'}`,
            render: (row) => (
                <span className="text-xs text-text-muted">
                    {row.fromLocation?.name || 'Main Warehouse'} → {row.toLocation?.name || 'Shop Floor'}
                </span>
            )
        },
        {
            header: 'BATCH / LOT',
            exportValue: (row) => row.batchNumber || row.lotNumber || '',
            render: (row) => <span className="font-mono text-xs">{row.batchNumber || row.lotNumber || '-'}</span>
        },
        {
            header: 'TIMESTAMP',
            exportValue: (row) => row.createdAt || '',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                </span>
            )
        },
        {
            header: 'USER',
            exportValue: (row) => row.performedBy?.name || row.createdBy?.name || 'System Admin',
            render: (row) => (
                <span className="font-medium text-xs text-text-main">
                    {row.performedBy?.name || row.createdBy?.name || 'System Admin'}
                </span>
            )
        }
    ];

    // Columns config for Fabric Rolls Traceability View
    const fabricRollsColumns = [
        {
            header: 'ROLL #',
            exportValue: (row) => row.rollNumber || row.rollNo || '-',
            render: (row) => (
                <span className="font-mono font-extrabold text-xs text-sidebar-bg bg-primary px-2 py-0.5 rounded shadow-2xs">
                    {row.rollNumber || row.rollNo || '-'}
                </span>
            ),
            sortable: true
        },
        {
            header: 'MATERIAL & SPEC',
            exportValue: (row) => `${row.materialName || 'Woven Fabric'} (${row.materialCode || ''})`,
            render: (row) => (
                <div className="flex flex-col max-w-full overflow-hidden">
                    <span className="font-bold text-gray-900 text-sm whitespace-normal break-words">
                        {row.materialName || 'Woven Fabric Roll'}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5 whitespace-normal break-words line-clamp-2">
                        • {row.materialCode || row.specification || (row.width ? `${row.width}" Width` : '-')}
                    </span>
                </div>
            )
        },
        {
            header: 'INWARD SOURCE (GRN / PO)',
            exportValue: (row) => `${row.grnNumber || '-'} / ${row.poNumber || '-'}`,
            render: (row) => (
                <div className="space-y-0.5 font-sans">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
                            {row.grnNumber || '-'}
                        </span>
                        {row.poNumber && (
                            <span className="text-[10px] font-mono text-text-muted">
                                PO: {row.poNumber}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-text-muted truncate max-w-[160px]">
                        {row.supplierName || 'Inward Roll'} {row.receivedDate ? `• ${new Date(row.receivedDate).toLocaleDateString('en-GB')}` : ''}
                    </div>
                </div>
            )
        },
        {
            header: 'ORIGINAL LENGTH & WT',
            exportValue: (row) => `${row.totalMeters || 0} m / ${row.netWeight || row.grossWeight || 0} kg`,
            render: (row) => (
                <div className="font-mono text-xs space-y-0.5">
                    <div className="font-bold text-text-main">{Number(row.totalMeters || 0).toLocaleString('en-IN')} M</div>
                    <div className="text-[10px] text-text-muted">
                        {row.netWeight != null ? `Net: ${row.netWeight} Kg` : row.grossWeight != null ? `Gross: ${row.grossWeight} Kg` : ''}
                    </div>
                </div>
            )
        },
        {
            header: 'REMAINING / USED',
            exportValue: (row) => `Rem: ${row.remainingMeters || 0} m, Used: ${row.usedMeters || 0} m`,
            render: (row) => {
                const total = Number(row.totalMeters || 1);
                const rem = Number(row.remainingMeters || 0);
                const used = Number(row.usedMeters || 0);
                const pct = Math.min(100, Math.round((used / total) * 100));

                return (
                    <div className="space-y-1 min-w-[130px]">
                        <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-emerald-700">{rem.toLocaleString('en-IN')} M rem</span>
                            <span className="text-[10px] text-text-muted">{used.toLocaleString('en-IN')} M used</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${
                                    rem === 0 ? 'bg-slate-400' : used > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'ROLL STATUS',
            exportValue: (row) => row.status || 'AVAILABLE',
            render: (row) => {
                const status = row.status || (row.remainingMeters === 0 ? 'FULLY_CONSUMED' : row.usedMeters > 0 ? 'PARTIALLY_USED' : 'AVAILABLE');
                if (status === 'FULLY_CONSUMED') {
                    return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                            Exhausted (0m)
                        </span>
                    );
                }
                if (status === 'PARTIALLY_USED') {
                    return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                            Partially Used
                        </span>
                    );
                }
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                        100% Available
                    </span>
                );
            }
        },
        {
            header: 'CONSUMED IN WORK ORDERS',
            exportValue: (row) => (row.consumedByWorkOrders || []).map(w => `${w.workOrderNumber} (${w.consumedMeters}m)`).join(', ') || 'None',
            render: (row) => {
                const list = row.consumedByWorkOrders || [];
                if (list.length === 0) {
                    return <span className="text-text-muted text-[11px] italic font-sans">No Work Orders drawn yet</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {list.map((wo) => (
                            <span
                                key={wo.workOrderId}
                                className="inline-flex items-center gap-1 font-mono text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded transition-colors"
                                title={`Work Order ${wo.workOrderNumber} • Target: ${wo.targetQuantity} Bags • Client: ${wo.customerName} • Consumed: ${wo.consumedMeters} M`}
                            >
                                <span>{wo.workOrderNumber}</span>
                                <span className="text-text-muted font-normal">({wo.consumedMeters}m)</span>
                            </span>
                        ))}
                    </div>
                );
            }
        }
    ];

    // Inline View Mode Toggle (rendered on the SAME HORIZONTAL ROW as tab bar)
    const showViewToggle = activeTabKey === 'finished-goods' || activeTabKey === 'raw-materials';
    const renderViewModeToggle = showViewToggle ? (
        <div className="flex items-center gap-1 bg-card-bg border border-border p-1 rounded-lg shadow-2xs select-none font-sans">
            <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'cards'
                        ? 'bg-primary text-sidebar-bg font-bold shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                }`}
            >
                <LayoutGrid size={14} />
                <span>Specification Cards</span>
            </button>
            <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'table'
                        ? 'bg-primary text-sidebar-bg font-bold shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                }`}
            >
                <List size={14} />
                <span>Data Table View</span>
            </button>
        </div>
    ) : null;

    const tabs = [
        {
            key: 'finished-goods',
            label: 'Finished Bags',
            resourcePath: '/finished-goods',
            columns: finishedGoodsColumns,
            customRender: viewMode === 'cards' ? (data, onEdit) => (
                <div className="space-y-4 font-sans">
                    {data.length === 0 ? (
                        <div className="p-10 bg-card-bg border border-border rounded-xl text-center text-text-muted text-xs">
                            No Finished Bag Specifications found. Click "+ Add New Bag Specification" to create one.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.map((fg) => (
                                <FinishedGoodSpecCard key={fg._id} finishedGood={fg} onEdit={onEdit} />
                            ))}
                        </div>
                    )}
                </div>
            ) : null
        },
        {
            key: 'raw-materials',
            label: 'Raw Materials',
            resourcePath: '/raw-materials',
            columns: rawMaterialsColumns,
            customRender: viewMode === 'cards' ? (data, onEdit) => (
                <div className="space-y-4 font-sans">
                    {data.length === 0 ? (
                        <div className="p-10 bg-card-bg border border-border rounded-xl text-center text-text-muted text-xs">
                            No Raw Materials found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.map((rm) => (
                                <RawMaterialSpecCard key={rm._id} rawMaterial={rm} onEdit={onEdit} />
                            ))}
                        </div>
                    )}
                </div>
            ) : null
        },
        {
            key: 'fabric-rolls',
            label: 'Fabric Rolls (Roll Traceability)',
            resourcePath: '/work-orders/rolls-traceability',
            isEditable: false,
            isDeletable: false,
            columns: fabricRollsColumns
        },
        {
            key: 'valuation-summary',
            label: 'Valuation & Summary',
            customRender: () => <InventoryValuationSummary />
        },
        {
            key: 'stock-transactions',
            label: 'Audit Ledger',
            resourcePath: '/stock-transactions',
            isEditable: false,
            isDeletable: false,
            columns: auditLedgerColumns
        }
    ];

    // Dual Top-Right Action Buttons: "+ Add New Bag Specification" & "Stock Adjustment Audit"
    const renderHeaderActionButtons = (handleOpenDrawer) => (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
            {/* Dark Primary Button: + Add New Bag Specification */}
            <button
                type="button"
                onClick={() => handleOpenDrawer && handleOpenDrawer()}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
            >
                <Plus size={15} />
                <span>+ Add New Bag Specification</span>
            </button>

            {/* Amber Action Button: Stock Adjustment Audit */}
            <button
                type="button"
                onClick={() => setIsAdjustmentPanelOpen(true)}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                title="Perform Manual Stock Adjustment"
            >
                <Sliders size={15} />
                <span>Stock Adjustment Audit</span>
            </button>
        </div>
    );

    return (
        <>
            <TabbedResourcePage
                key={`${refreshKey}`}
                title="Poly & Paper Bag Inventory Master"
                description="Editable Bag Specifications: Custom GSM, Shape, Size Dimensions (Length/Width/Capacity), Pricing & Stock Management"
                tabs={tabs}
                activeTabKey={activeTabKey}
                onTabChange={setActiveTabKey}
                headerActions={renderHeaderActionButtons}
                tabBarActions={renderViewModeToggle}
            />

            {/* Dedicated Manual Stock Adjustment Panel */}
            <StockAdjustmentPanel
                isOpen={isAdjustmentPanelOpen}
                onClose={() => setIsAdjustmentPanelOpen(false)}
                onSuccess={() => setRefreshKey((prev) => prev + 1)}
            />
        </>
    );
}
