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
    const searchFromUrl = searchParams.get('search');

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
                    {row.dimensions ? `${row.dimensions.width || 0} × ${row.dimensions.length || 0} cm` : '-'}
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
            render: (row) => <span className="font-mono font-bold uppercase">{row.referenceNumber || row._id?.slice(-6) || '-'}</span>,
            sortable: true
        },
        {
            header: 'TRANSACTION TYPE',
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
            render: (row) => (
                <span className="font-semibold text-text-main">
                    {row.item?.name || row.finishedGood?.name || row.rawMaterial?.name || row.notes || 'Stock Item'}
                </span>
            )
        },
        {
            header: 'QUANTITY',
            render: (row) => (
                <span className="font-mono font-bold text-text-main">
                    {row.quantity !== undefined ? row.quantity.toLocaleString('en-IN') : 0}
                </span>
            )
        },
        {
            header: 'BEFORE → AFTER',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.previousStock !== undefined ? row.previousStock.toLocaleString('en-IN') : '-'} → <strong className="text-text-main">{row.newStock !== undefined ? row.newStock.toLocaleString('en-IN') : '-'}</strong>
                </span>
            )
        },
        {
            header: 'FROM → TO LOCATION',
            render: (row) => (
                <span className="text-xs text-text-muted">
                    {row.fromLocation?.name || 'Main Warehouse'} → {row.toLocation?.name || 'Shop Floor'}
                </span>
            )
        },
        {
            header: 'BATCH / LOT',
            render: (row) => <span className="font-mono text-xs">{row.batchNumber || row.lotNumber || '-'}</span>
        },
        {
            header: 'TIMESTAMP',
            render: (row) => (
                <span className="font-mono text-xs text-text-muted">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                </span>
            )
        },
        {
            header: 'USER',
            render: (row) => (
                <span className="font-medium text-xs text-text-main">
                    {row.performedBy?.name || row.createdBy?.name || 'System Admin'}
                </span>
            )
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
                key={`${refreshKey}-${searchFromUrl || ''}`}
                title="Poly & Paper Bag Inventory Master"
                description="Editable Bag Specifications: Custom GSM, Shape, Size Dimensions (Length/Width/Capacity), Pricing & Stock Management"
                tabs={tabs}
                activeTabKey={activeTabKey}
                onTabChange={setActiveTabKey}
                initialSearch={searchFromUrl || ''}
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
