import { useState, useEffect, useMemo } from 'react';
import { useResourceApi } from '../../hooks/useResourceApi';
import DataTable from './DataTable';
import { Construction, Plus, X, Clock, Sparkles, Pencil, Trash2, MapPin } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import InlineLookupSelect from './InlineLookupSelect';
import DetailViewModal from './DetailViewModal';

// Helper to auto-compose descriptive Raw Material title from attributes
// Pattern: [Lamination Type] [Material Description] [Capacity/Weight if applicable] (Dimensions if applicable, [Fabric Grammage] - [Material Colour])
// Example: "Unlaminated PP Woven Sack 10Kg (45x75cm, 60 GSM - Milky White)"
export const composeRawMaterialTitle = (data = {}) => {
    const isPresent = (val) => {
        if (!val || typeof val !== 'string') return false;
        const trimmed = val.trim();
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();
        return (
            lower !== 'not applicable' &&
            lower !== 'n/a' &&
            lower !== 'na' &&
            lower !== 'none' &&
            lower !== '-' &&
            lower !== 'null' &&
            lower !== 'undefined'
        );
    };

    const lamination = isPresent(data.laminationType) ? data.laminationType.trim() : '';
    const materialDesc = isPresent(data.materialDescription) ? data.materialDescription.trim() : '';
    const rawBase = data.baseName !== undefined ? data.baseName : data.name;
    const baseLabel = isPresent(rawBase) ? String(rawBase).trim() : '';

    // Main title prefix / name: [Lamination Type] [Material Description] [Capacity/Weight/Base]
    const mainParts = [];
    if (lamination) {
        mainParts.push(lamination);
    }
    if (materialDesc) {
        if (!mainParts.some((p) => p.toLowerCase().includes(materialDesc.toLowerCase()))) {
            mainParts.push(materialDesc);
        }
    }

    if (baseLabel) {
        const joinedMain = mainParts.join(' ').toLowerCase();
        const baseLower = baseLabel.toLowerCase();
        if (!joinedMain.includes(baseLower)) {
            mainParts.push(baseLabel);
        }
    }

    const mainTitle = mainParts.join(' ').trim();

    // Parenthetical specs: (Dimensions if applicable, [Fabric Grammage] - [Material Colour])
    const dim = isPresent(data.fabricSize) ? data.fabricSize.trim() : '';
    let gsm = isPresent(data.fabricGrammage) ? data.fabricGrammage.trim() : '';
    if (gsm && /^\d+$/.test(gsm)) {
        gsm = `${gsm} GSM`;
    }
    const col = isPresent(data.materialColour || data.color) ? (data.materialColour || data.color).trim() : '';

    let gsmColorPart = '';
    if (gsm && col) {
        gsmColorPart = `${gsm} - ${col}`;
    } else if (gsm) {
        gsmColorPart = gsm;
    } else if (col) {
        gsmColorPart = col;
    }

    let parenthetical = '';
    if (dim && gsmColorPart) {
        parenthetical = `${dim}, ${gsmColorPart}`;
    } else if (dim) {
        parenthetical = dim;
    } else if (gsmColorPart) {
        parenthetical = gsmColorPart;
    }

    if (mainTitle && parenthetical) {
        return `${mainTitle} (${parenthetical})`;
    } else if (mainTitle) {
        return mainTitle;
    } else if (parenthetical) {
        return `(${parenthetical})`;
    }
    return '';
};

// Helper to format consistent print specification string across Finished Bags, Enquiries, and Work Orders
export const formatPrintSpecString = (printSides, frontColours, backColours, processName = 'Flexo') => {
    const sides = (printSides || 'NONE').toUpperCase();
    const f = Math.max(0, Number(frontColours) || 0);
    const b = Math.max(0, Number(backColours) || 0);
    if (sides === 'NONE' || sides === 'NONE-PLAIN' || (f === 0 && b === 0)) {
        return 'Plain / Unprinted';
    }
    if (sides === 'FRONT_ONLY') {
        return `Front: ${f}-Color ${processName}`;
    }
    if (sides === 'BACK_ONLY') {
        return `Back: ${b}-Color ${processName}`;
    }
    if (sides === 'BOTH') {
        if (f === b) {
            return `${f}-Color ${processName}, Front & Back`;
        }
        return `Front: ${f}-Color, Back: ${b}-Color ${processName}`;
    }
    return `${f || b || 0}-Color ${processName}`;
};

// Helper to auto-compose descriptive Finished Bag title from classification fields
// Pattern: "[Bag Shape] [Bag Type/Category] [Capacity]Kg ([Width]x[Length][unit], [GSM] GSM - [Color & Print])"
// Example: "Open Mouth Laminated PP Woven Sack 50Kg (45x75cm, 75 GSM - Milky White 2-Color Flexo)"
export const composeFinishedBagTitle = (data = {}, categoriesList = [], bagShapesList = []) => {
    const isPresent = (val) => {
        if (!val && val !== 0) return false;
        if (typeof val === 'number') return !isNaN(val) && val > 0;
        const trimmed = String(val).trim();
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();
        return (
            lower !== 'not applicable' &&
            lower !== 'n/a' &&
            lower !== 'na' &&
            lower !== 'none' &&
            lower !== '-' &&
            lower !== 'null' &&
            lower !== 'undefined' &&
            lower !== 'other'
        );
    };

    // Resolve bag shape name
    const bagShapeRaw = data.bagShape || '';
    const bagShape = isPresent(bagShapeRaw) ? bagShapeRaw.trim() : '';

    // Resolve category name (Bag Type/Category)
    const catId = typeof data.category === 'object' ? data.category?._id : data.category;
    const catObj = categoriesList.find((c) => c._id === catId);
    const categoryName = catObj?.name || (typeof data.category === 'object' ? data.category?.name : '') || '';
    const bagTypeCat = isPresent(categoryName) ? categoryName.trim() : '';

    // baseName (user-typed short label like "Fertilizer Sack")
    const baseLabel = isPresent(data.baseName) ? data.baseName.trim() : '';

    // Capacity
    const cap = (data.bagCapacity !== undefined && data.bagCapacity !== '' && data.bagCapacity !== null)
        ? Number(data.bagCapacity)
        : null;
    const capacityStr = (cap !== null && !isNaN(cap) && cap > 0) ? `${cap}Kg` : '';

    // Build main title: [Shape] [Category/Type] [baseLabel] [Capacity]
    const mainParts = [];
    if (bagShape) mainParts.push(bagShape);
    if (bagTypeCat && !mainParts.some((p) => p.toLowerCase().includes(bagTypeCat.toLowerCase()))) {
        mainParts.push(bagTypeCat);
    }
    if (baseLabel && !mainParts.some((p) => p.toLowerCase().includes(baseLabel.toLowerCase()))) {
        mainParts.push(baseLabel);
    }
    if (capacityStr) mainParts.push(capacityStr);

    const mainTitle = mainParts.join(' ').trim();

    // Parenthetical: (WIDTHxLENGTHunit, GSM GSM - Color)
    const dimUnit = data.dimensions?.unit || data.dimensionUnit || 'cm';
    const w = (data.dimensions?.width !== undefined && data.dimensions?.width !== '' && data.dimensions?.width !== null)
        ? Number(data.dimensions.width)
        : null;
    const l = (data.dimensions?.length !== undefined && data.dimensions?.length !== '' && data.dimensions?.length !== null)
        ? Number(data.dimensions.length)
        : null;
    const dimStr = (w !== null && l !== null && !isNaN(w) && !isNaN(l) && (w > 0 || l > 0))
        ? `${w}x${l}${dimUnit}`
        : '';

    const gsm = (data.fabricGSM !== undefined && data.fabricGSM !== '' && data.fabricGSM !== null)
        ? Number(data.fabricGSM)
        : null;
    const gsmStr = (gsm !== null && !isNaN(gsm) && gsm > 0) ? `${gsm} GSM` : '';

    let colorStr = '';
    if (data.printSides || data.printSpec) {
        const sides = data.printSides || data.printSpec?.printSides || 'NONE';
        const f = data.frontColours !== undefined ? data.frontColours : (data.printSpec?.frontColours || 0);
        const b = data.backColours !== undefined ? data.backColours : (data.printSpec?.backColours || 0);
        const specStr = formatPrintSpecString(sides, f, b);
        const base = isPresent(data.materialColour) ? data.materialColour.trim() : (isPresent(data.color) ? data.color.trim() : '');
        colorStr = base ? `${base} (${specStr})` : specStr;
    } else {
        const colorRaw = data.colorAndPrint || '';
        colorStr = isPresent(colorRaw) ? colorRaw.trim() : '';
    }

    let gsmColorPart = '';
    if (gsmStr && colorStr) {
        gsmColorPart = `${gsmStr} - ${colorStr}`;
    } else if (gsmStr) {
        gsmColorPart = gsmStr;
    } else if (colorStr) {
        gsmColorPart = colorStr;
    }

    let parenthetical = '';
    if (dimStr && gsmColorPart) {
        parenthetical = `${dimStr}, ${gsmColorPart}`;
    } else if (dimStr) {
        parenthetical = dimStr;
    } else if (gsmColorPart) {
        parenthetical = gsmColorPart;
    }

    if (mainTitle && parenthetical) {
        return `${mainTitle} (${parenthetical})`;
    } else if (mainTitle) {
        return mainTitle;
    } else if (parenthetical) {
        return `(${parenthetical})`;
    }
    return '';
};


// Helper to generate suggested code e.g. "CUST-001", "SUP-001", "EMP-001", "MCH-001", "RM-001", "FG-001", "SHIFT-001"
const generateSuggestedCode = (tabKey, currentTotal = 0) => {
    const key = (tabKey || '').toLowerCase();
    let prefix = 'CODE';
    if (key === 'customers' || key === 'customer') prefix = 'CUST';
    else if (key === 'suppliers' || key === 'supplier') prefix = 'SUP';
    else if (key === 'employees' || key === 'employee') prefix = 'EMP';
    else if (key === 'machines' || key === 'machine') prefix = 'MCH';
    else if (key === 'raw-materials' || key === 'rawmaterials' || key === 'raw_materials') prefix = 'RM';
    else if (key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts' || key === 'finished_goods') prefix = 'FG';
    else if (key === 'shifts' || key === 'shift') prefix = 'SHIFT';

    const nextNum = (Number(currentTotal) || 0) + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${prefix}-${paddedNum}`;
};

/**
 * Multi-select component for assigning multiple operators to a machine.
 * Searchable and selectable by Employee Code first ([Code] - [Name] ([Department])).
 */
function EmployeeMultiSelect({ employees = [], selectedIds = [], onChange }) {
    const [search, setSearch] = useState('');

    const safeSelected = Array.isArray(selectedIds)
        ? selectedIds.map((id) => (typeof id === 'object' ? id?._id : id)).filter(Boolean)
        : [];

    const filtered = employees.filter((emp) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const code = (emp.employeeCode || '').toLowerCase();
        const name = (emp.name || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        return code.includes(q) || name.includes(q) || dept.includes(q);
    });

    const toggle = (id) => {
        let next;
        if (safeSelected.includes(id)) {
            next = safeSelected.filter((item) => item !== id);
        } else {
            next = [...safeSelected, id];
        }
        onChange(next);
    };

    const remove = (id, e) => {
        e.stopPropagation();
        onChange(safeSelected.filter((item) => item !== id));
    };

    const selectedEmpObjects = safeSelected.map((id) => employees.find((e) => e._id === id)).filter(Boolean);

    return (
        <div className="space-y-1.5 font-sans">
            {/* Selected chips display */}
            {selectedEmpObjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-app-bg border border-border rounded-md">
                    {selectedEmpObjects.map((emp) => (
                        <span
                            key={emp._id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-semibold"
                        >
                            <span>{emp.employeeCode ? `${emp.employeeCode} - ` : ''}{emp.name}</span>
                            <button
                                type="button"
                                onClick={(e) => remove(emp._id, e)}
                                className="hover:text-rose-600 cursor-pointer p-0.5 leading-none"
                                title="Remove Operator"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search + Checkbox list */}
            <div className="border border-border rounded-md bg-card-bg overflow-hidden shadow-xs">
                <div className="p-2 border-b border-border bg-app-bg/50 flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search by Employee Code, Name or Dept..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full text-xs bg-card-bg border border-border rounded p-1.5 text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                    {safeSelected.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="text-[10px] text-text-muted hover:text-rose-600 whitespace-nowrap cursor-pointer font-bold"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-border/40 p-1">
                    {filtered.length === 0 ? (
                        <p className="text-xs text-text-muted italic p-2 text-center">No matching employees found.</p>
                    ) : (
                        filtered.map((emp) => {
                            const isChecked = safeSelected.includes(emp._id);
                            const label = `${emp.employeeCode || 'EMP'} - ${emp.name}${emp.department ? ` (${emp.department})` : ''}`;
                            return (
                                <label
                                    key={emp._id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                                        isChecked ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-app-bg text-text-main'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggle(emp._id)}
                                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                                    />
                                    <span className="truncate">{label}</span>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>
            <p className="text-[10px] text-text-muted">
                {safeSelected.length} operator{safeSelected.length === 1 ? '' : 's'} assigned to this machine.
            </p>
        </div>
    );
}

export default function TabbedResourcePage({
    title,
    description,
    tabs = [],
    onAddClick = null,
    headerActions = null,
    tabBarActions = null,
    activeTabKey: controlledActiveTabKey,
    onTabChange
}) {
    const [internalActiveTabKey, setInternalActiveTabKey] = useState(tabs[0]?.key || '');

    useEffect(() => {
        if (controlledActiveTabKey) {
            setInternalActiveTabKey(controlledActiveTabKey);
        }
    }, [controlledActiveTabKey]);

    const activeTabKey = controlledActiveTabKey || internalActiveTabKey;

    const handleTabChange = (key) => {
        setInternalActiveTabKey(key);
        if (onTabChange) onTabChange(key);
    };
    const [tabCounts, setTabCounts] = useState({});
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Custom Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

    // Read-only Detail View Modal State (Eye icon on table rows)
    const [detailModal, setDetailModal] = useState({
        isOpen: false,
        record: null,
        tabKey: ''
    });

    const handleViewRow = (row) => {
        setDetailModal({
            isOpen: true,
            record: row,
            tabKey: activeTabKey
        });
    };

    // Form state values
    const [formData, setFormData] = useState({});

    // Dropdown list states for employees, raw materials, finished goods, and BOMs
    const [shiftsList, setShiftsList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [plantLocations, setPlantLocations] = useState([]);
    const [categoriesList, setCategoriesList] = useState([]);
    const [uomsList, setUomsList] = useState([]);
    const [finishedGoodsList, setFinishedGoodsList] = useState([]);
    const [bagShapesList, setBagShapesList] = useState([]);
    const [sectionsList, setSectionsList] = useState([]);
    const [employeesList, setEmployeesList] = useState([]);
    const [rawMaterialsList, setRawMaterialsList] = useState([]);
    const [bomIngredients, setBomIngredients] = useState([{ rawMaterial: '', quantityPerUnit: '' }]);
    const [inks, setInks] = useState([]);

    // Raw Material Lookup Attributes State (9 master lists)
    const [rmAttributes, setRmAttributes] = useState({
        materialDescription: [],
        materialQualityFabric: [],
        materialQualityBags: [],
        laminationType: [],
        fabricGrammage: [],
        materialColour: [],
        qualityThreadYarn: [],
        threadColour: [],
        fabricSize: []
    });

    // Reusable Raw Material Attribute Modal State (+ Add New / Edit)
    const [attributeModal, setAttributeModal] = useState({
        isOpen: false,
        mode: 'ADD',
        attributeType: '',
        attributeLabel: '',
        itemId: null,
        inputValue: '',
        isSaving: false
    });

    // Custom Bag Shape Modal State
    const [bagShapeModal, setBagShapeModal] = useState({
        isOpen: false,
        mode: 'ADD',
        shapeId: null,
        inputValue: '',
        isSaving: false
    });

    // Custom Section Modal State (+ Add New / Edit)
    const [sectionModal, setSectionModal] = useState({
        isOpen: false,
        mode: 'ADD',
        sectionId: null,
        inputValue: '',
        isSaving: false
    });

    // Custom Plant Location Modal State (+ Add New / Edit)
    const [plantLocationModal, setPlantLocationModal] = useState({
        isOpen: false,
        mode: 'ADD',
        locationId: null,
        name: '',
        code: '',
        type: 'FACTORY',
        isSaving: false
    });

    // Inline Shift Modal State inside Employee Form
    const [isInlineShiftModalOpen, setIsInlineShiftModalOpen] = useState(false);
    const [inlineShiftData, setInlineShiftData] = useState({
        shiftCode: 'SHIFT_A',
        name: 'Shift A',
        startTime: '06:00',
        endTime: '14:00',
        standardHours: 8,
        gracePeriodMinutes: 15
    });
    const [isSavingInlineShift, setIsSavingInlineShift] = useState(false);

    // Inline Location Modal State inside Employee Form
    const [isInlineLocationModalOpen, setIsInlineLocationModalOpen] = useState(false);
    const [inlineLocationData, setInlineLocationData] = useState({
        name: '',
        code: '',
        type: 'FACTORY',
        address: '',
        city: '',
        state: ''
    });
    const [isSavingInlineLocation, setIsSavingInlineLocation] = useState(false);

    const handleOpenInlineLocationModal = () => {
        const nextNum = (locationsList.length || 0) + 1;
        const padded = String(nextNum).padStart(3, '0');
        setInlineLocationData({
            name: '',
            code: `LOC-${padded}`,
            type: 'FACTORY',
            address: '',
            city: '',
            state: ''
        });
        setIsInlineLocationModalOpen(true);
    };

    // Custom UOM Modal State
    const [uomModal, setUomModal] = useState({
        isOpen: false,
        name: '',
        abbreviation: '',
        isSaving: false
    });

    const handleOpenAddUomModal = () => {
        setUomModal({
            isOpen: true,
            name: '',
            abbreviation: '',
            isSaving: false
        });
    };

    const handleSaveUomModal = async (e) => {
        e.preventDefault();
        if (!uomModal.name.trim() || !uomModal.abbreviation.trim()) {
            toast.error('Please enter both UOM Name and Abbreviation');
            return;
        }

        try {
            setUomModal((prev) => ({ ...prev, isSaving: true }));
            const res = await axiosInstance.post('/uoms', {
                name: uomModal.name.trim(),
                abbreviation: uomModal.abbreviation.trim(),
                symbol: uomModal.abbreviation.trim()
            });

            if (res.data?.success) {
                const newUom = res.data.data;
                toast.success(`UOM '${newUom.name}' created successfully!`);

                const uomRes = await axiosInstance.get('/uoms?isActive=true&limit=100');
                if (uomRes.data?.success && Array.isArray(uomRes.data.data)) {
                    setUomsList(uomRes.data.data);
                }

                setFormData((prev) => ({
                    ...prev,
                    uom: newUom._id
                }));

                setUomModal({ isOpen: false, name: '', abbreviation: '', isSaving: false });
            }
        } catch (err) {
            console.error('Error saving UOM:', err);
            toast.error(err.response?.data?.message || 'Failed to create UOM');
            setUomModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    const activeTab = tabs.find((t) => t.key === activeTabKey) || tabs[0];
    const activeTabLabel = activeTab?.label || 'Record';

    const isTabPlaceholder = activeTab?.isPlaceholder || (!activeTab?.resourcePath && !activeTab?.customRender);

    // 'Show Inactive Customers' toggle — resets when switching away from customers tab
    const [showInactive, setShowInactive] = useState(false);
    const isCustomersTab = (activeTabKey || '').toLowerCase() === 'customers';

    // Reset showInactive when switching away from customers tab
    useEffect(() => {
        if (!isCustomersTab) {
            setShowInactive(false);
        }
    }, [isCustomersTab]);

    const customerExtraParams = useMemo(() => {
        return isCustomersTab && showInactive ? { showInactive: 'true' } : undefined;
    }, [isCustomersTab, showInactive]);

    const {
        data,
        pagination,
        isLoading,
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        page,
        setPage,
        createItem,
        updateItem,
        deleteItem,
        bulkDeleteItems
    } = useResourceApi(isTabPlaceholder ? null : activeTab?.resourcePath, undefined, customerExtraParams);

    // Keep tab count badge updated when pagination total changes for active tab
    useEffect(() => {
        if (activeTab && !isTabPlaceholder && pagination?.total !== undefined) {
            setTabCounts((prev) => ({
                ...prev,
                [activeTab.key]: pagination.total
            }));
        }
    }, [activeTab?.key, isTabPlaceholder, pagination?.total]);

    // Auto-generate unique Employee Code when opening employee creation drawer
    useEffect(() => {
        if (isDrawerOpen && activeTabKey === 'employees' && !editingItem) {
            if (!formData.employeeCode) {
                const autoEmpCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
                setFormData((prev) => ({
                    ...prev,
                    employeeCode: autoEmpCode,
                    code: autoEmpCode
                }));
            }
        }
    }, [isDrawerOpen, activeTabKey, editingItem, formData.employeeCode]);

    // Fetch counts for other tabs on tab change
    useEffect(() => {
        tabs.forEach((t) => {
            if (t.resourcePath && !t.isPlaceholder && t.key !== activeTabKey) {
                axiosInstance.get(t.resourcePath, { params: { limit: 1 } })
                    .then((res) => {
                        if (res.data?.success && res.data?.pagination?.total !== undefined) {
                            setTabCounts((prev) => ({
                                ...prev,
                                [t.key]: res.data.pagination.total
                            }));
                        }
                    })
                    .catch(() => { });
            }
        });
    }, [activeTabKey]);

    // Fetch shift, location, category, UOM, and BOM options when active tab or drawer opens
    const fetchDropdownOptions = () => {
        if (activeTabKey === 'employees') {
            axiosInstance.get('/shifts?isActive=true').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setShiftsList(list);
                    if (list.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            shiftAssignment: prev.shiftAssignment || list[0]._id
                        }));
                    }
                }
            }).catch(() => { });

            axiosInstance.get('/locations?isActive=true').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setLocationsList(list);
                    if (list.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            facility: prev.facility || list[0]._id
                        }));
                    }
                }
            }).catch(() => { });
        }

        const key = activeTabKey?.toLowerCase() || '';
        if (key === 'raw-materials' || key === 'rawmaterials' || key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts') {
            const catType = (key === 'raw-materials' || key === 'rawmaterials') ? 'RAW_MATERIAL' : 'FINISHED_GOODS';

            // Fetch categories dynamically
            axiosInstance.get(`/categories?type=${catType}&isActive=true&limit=100`).then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setCategoriesList(list);
                    if (list.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            category: prev.category || list[0]._id
                        }));
                    }
                }
            }).catch(() => { });

            // Fetch UOMs dynamically
            axiosInstance.get('/uom?isActive=true&limit=100').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setUomsList(list);
                    if (list.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            uom: prev.uom || list[0]._id
                        }));
                    }
                }
            }).catch(() => { });

            // Fetch Locations dynamically
            axiosInstance.get('/locations?isActive=true&limit=100').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setLocationsList(list);
                }
            }).catch(() => { });

            // Fetch Bag Shapes dynamically
            axiosInstance.get('/bag-shapes?isActive=true').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setBagShapesList(res.data.data);
                }
            }).catch(() => { });

            // Fetch Raw Materials options for Finished Goods recipe definitions
            axiosInstance.get('/raw-materials?isActive=true&limit=200').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setRawMaterialsList(res.data.data);
                }
            }).catch(() => { });

            // Fetch Raw Material Attributes dynamically
            axiosInstance.get('/raw-material-attributes').then((res) => {
                if (res.data?.success && res.data.data) {
                    setRmAttributes(res.data.data);
                }
            }).catch(() => { });
        }

        if (key === 'boms' || key === 'bom') {
            // Fetch Finished Goods options for target dropdown
            axiosInstance.get('/finished-goods?isActive=true&limit=100').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    const list = res.data.data;
                    setFinishedGoodsList(list);
                    if (list.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            finishedGood: prev.finishedGood || list[0]._id
                        }));
                    }
                }
            }).catch(() => { });

            // Fetch Raw Materials options for ingredient rows
            axiosInstance.get('/raw-materials?limit=100').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setRawMaterialsList(res.data.data);
                }
            }).catch(() => { });
        }

        if (key === 'machines' || key === 'machine') {
            axiosInstance.get('/sections?isActive=true').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setSectionsList(res.data.data);
                    if (res.data.data.length > 0) {
                        setFormData((prev) => ({
                            ...prev,
                            section: prev.section || res.data.data[0].name
                        }));
                    }
                }
            }).catch(() => { });

            axiosInstance.get('/employees?isActive=true&limit=200').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setEmployeesList(res.data.data);
                }
            }).catch(() => { });

            axiosInstance.get('/locations?isActive=true&limit=100').then((res) => {
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setPlantLocations(res.data.data);
                    setLocationsList(res.data.data);
                }
            }).catch(() => {
                setPlantLocations([]);
                setLocationsList([]);
            });
        }
    };

    useEffect(() => {
        const key = activeTabKey?.toLowerCase() || '';
        if (isDrawerOpen || key === 'boms' || key === 'bom' || key === 'machines' || key === 'machine') {
            fetchDropdownOptions();
        }
    }, [activeTabKey, isDrawerOpen]);

    // Custom Category Modal State
    const [categoryModal, setCategoryModal] = useState({
        isOpen: false,
        mode: 'ADD',
        categoryId: null,
        inputValue: '',
        isSaving: false
    });

    /**
     * Open Add Category Modal
     */
    const handleOpenAddCategoryModal = () => {
        setCategoryModal({
            isOpen: true,
            mode: 'ADD',
            categoryId: null,
            inputValue: '',
            isSaving: false
        });
    };

    /**
     * Open Edit Category Modal
     */
    const handleOpenEditCategoryModal = (catIdVal) => {
        if (!catIdVal) return;
        const idToFind = typeof catIdVal === 'object' ? catIdVal._id : catIdVal;
        const selectedCat = categoriesList.find((c) => c._id === idToFind);
        if (!selectedCat) return;

        setCategoryModal({
            isOpen: true,
            mode: 'EDIT',
            categoryId: selectedCat._id,
            inputValue: selectedCat.name,
            isSaving: false
        });
    };

    /**
     * Save Category Modal Handler (Create or Update)
     */
    const handleSaveCategoryModal = async (e) => {
        if (e) e.preventDefault();
        const nameTrimmed = (categoryModal.inputValue || '').trim();
        if (!nameTrimmed) {
            toast.error('Please enter a category name');
            return;
        }

        const key = activeTabKey?.toLowerCase() || '';
        const catType = (key === 'raw-materials' || key === 'rawmaterials') ? 'RAW_MATERIAL' : 'FINISHED_GOODS';

        try {
            setCategoryModal((prev) => ({ ...prev, isSaving: true }));
            if (categoryModal.mode === 'ADD') {
                toast.loading('Creating category...', { id: 'save-cat-modal' });
                const res = await axiosInstance.post('/categories', {
                    name: nameTrimmed,
                    type: catType
                });

                if (res.data?.success && res.data?.data) {
                    const newCat = res.data.data;
                    toast.success(`Category '${newCat.name}' created!`, { id: 'save-cat-modal' });
                    setCategoriesList((prev) => [...prev, newCat]);
                    handleInputChange('category', newCat._id);
                    setCategoryModal({ isOpen: false, mode: 'ADD', categoryId: null, inputValue: '', isSaving: false });
                }
            } else if (categoryModal.mode === 'EDIT' && categoryModal.categoryId) {
                toast.loading('Updating category...', { id: 'save-cat-modal' });
                const res = await axiosInstance.put(`/categories/${categoryModal.categoryId}`, {
                    name: nameTrimmed
                });

                if (res.data?.success && res.data?.data) {
                    const updatedCat = res.data.data;
                    toast.success(`Category updated to '${updatedCat.name}'!`, { id: 'save-cat-modal' });
                    setCategoriesList((prev) =>
                        prev.map((c) => (c._id === updatedCat._id ? updatedCat : c))
                    );
                    setCategoryModal({ isOpen: false, mode: 'ADD', categoryId: null, inputValue: '', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save category modal error:', err);
            toast.error(err.response?.data?.message || 'Failed to save category', { id: 'save-cat-modal' });
            setCategoryModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    /**
     * Inline Category Delete Confirmation
     */
    const handleDeleteCategoryInline = (catIdVal) => {
        if (!catIdVal) return;
        const idToFind = typeof catIdVal === 'object' ? catIdVal._id : catIdVal;
        const selectedCat = categoriesList.find((c) => c._id === idToFind);
        if (!selectedCat) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Category',
            message: `Are you sure you want to delete category '${selectedCat.name}'?`,
            onConfirm: async () => {
                try {
                    toast.loading('Deleting category...', { id: 'delete-cat' });
                    const res = await axiosInstance.delete(`/categories/${selectedCat._id}`);

                    if (res.data?.success) {
                        toast.success(`Category '${selectedCat.name}' deleted!`, { id: 'delete-cat' });
                        setCategoriesList((prev) => prev.filter((c) => c._id !== selectedCat._id));
                        handleInputChange('category', '');
                    }
                } catch (err) {
                    console.error('Delete category error:', err);
                    toast.error(err.response?.data?.message || 'Failed to delete category', { id: 'delete-cat' });
                }
            }
        });
    };

    /**
     * Open Add Bag Shape Modal
     */
    const handleOpenAddBagShapeModal = () => {
        setBagShapeModal({
            isOpen: true,
            mode: 'ADD',
            shapeId: null,
            inputValue: '',
            isSaving: false
        });
    };

    /**
     * Open Edit Bag Shape Modal
     */
    const handleOpenEditBagShapeModal = (shapeVal) => {
        if (!shapeVal || shapeVal === 'Other') return;
        const selectedShape = bagShapesList.find((s) => s.name === shapeVal || s._id === shapeVal);
        if (!selectedShape) return;

        setBagShapeModal({
            isOpen: true,
            mode: 'EDIT',
            shapeId: selectedShape._id,
            inputValue: selectedShape.name,
            isSaving: false
        });
    };

    /**
     * Save Bag Shape Modal Handler
     */
    const handleSaveBagShapeModal = async (e) => {
        if (e) e.preventDefault();
        const nameTrimmed = (bagShapeModal.inputValue || '').trim();
        if (!nameTrimmed) {
            toast.error('Please enter a bag shape name');
            return;
        }

        try {
            setBagShapeModal((prev) => ({ ...prev, isSaving: true }));
            if (bagShapeModal.mode === 'ADD') {
                toast.loading('Creating bag shape...', { id: 'save-shape-modal' });
                const res = await axiosInstance.post('/bag-shapes', { name: nameTrimmed });
                if (res.data?.success && res.data?.data) {
                    const newShape = res.data.data;
                    toast.success(`Bag shape '${newShape.name}' created!`, { id: 'save-shape-modal' });
                    setBagShapesList((prev) => [...prev, newShape]);
                    handleInputChange('bagShape', newShape.name);
                    setBagShapeModal({ isOpen: false, mode: 'ADD', shapeId: null, inputValue: '', isSaving: false });
                }
            } else if (bagShapeModal.mode === 'EDIT' && bagShapeModal.shapeId) {
                toast.loading('Updating bag shape...', { id: 'save-shape-modal' });
                const res = await axiosInstance.put(`/bag-shapes/${bagShapeModal.shapeId}`, { name: nameTrimmed });
                if (res.data?.success && res.data?.data) {
                    const updatedShape = res.data.data;
                    toast.success(`Bag shape updated to '${updatedShape.name}'!`, { id: 'save-shape-modal' });
                    setBagShapesList((prev) =>
                        prev.map((s) => (s._id === updatedShape._id ? updatedShape : s))
                    );
                    handleInputChange('bagShape', updatedShape.name);
                    setBagShapeModal({ isOpen: false, mode: 'ADD', shapeId: null, inputValue: '', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save bag shape error:', err);
            toast.error(err.response?.data?.message || 'Failed to save bag shape', { id: 'save-shape-modal' });
            setBagShapeModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    /**
     * Inline Bag Shape Delete Confirmation
     */
    const handleDeleteBagShapeInline = (shapeVal) => {
        if (!shapeVal || shapeVal === 'Other') return;
        const selectedShape = bagShapesList.find((s) => s.name === shapeVal || s._id === shapeVal);
        if (!selectedShape) return;

        setConfirmModal({
            isOpen: true,
            title: 'Delete Bag Shape',
            message: `Are you sure you want to delete bag shape '${selectedShape.name}'?`,
            onConfirm: async () => {
                try {
                    toast.loading('Deleting bag shape...', { id: 'delete-shape' });
                    const res = await axiosInstance.delete(`/bag-shapes/${selectedShape._id}`);
                    if (res.data?.success) {
                        toast.success(`Bag shape '${selectedShape.name}' deleted!`, { id: 'delete-shape' });
                        setBagShapesList((prev) => prev.filter((s) => s._id !== selectedShape._id));
                        handleInputChange('bagShape', '');
                    }
                } catch (err) {
                    console.error('Delete bag shape error:', err);
                    toast.error(err.response?.data?.message || 'Failed to delete bag shape', { id: 'delete-shape' });
                }
            }
        });
    };

    /**
     * Save Section Modal (+ Add New / Edit)
     */
    const handleSaveSectionModal = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const nameTrimmed = (sectionModal.inputValue || '').trim();
        if (!nameTrimmed) {
            toast.error('Section name is required');
            return;
        }

        try {
            setSectionModal((prev) => ({ ...prev, isSaving: true }));
            if (sectionModal.mode === 'ADD') {
                toast.loading('Creating section...', { id: 'save-sec-modal' });
                const res = await axiosInstance.post('/sections', { name: nameTrimmed });
                if (res.data?.success && res.data?.data) {
                    const newSec = res.data.data;
                    toast.success(`Section '${newSec.name}' created!`, { id: 'save-sec-modal' });
                    setSectionsList((prev) => [...prev, newSec]);
                    handleInputChange('section', newSec.name);
                    setSectionModal({ isOpen: false, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false });
                }
            } else if (sectionModal.mode === 'EDIT' && sectionModal.sectionId) {
                toast.loading('Updating section...', { id: 'save-sec-modal' });
                const res = await axiosInstance.put(`/sections/${sectionModal.sectionId}`, { name: nameTrimmed });
                if (res.data?.success && res.data?.data) {
                    const updatedSec = res.data.data;
                    toast.success(`Section updated to '${updatedSec.name}'!`, { id: 'save-sec-modal' });
                    setSectionsList((prev) =>
                        prev.map((s) => (s._id === updatedSec._id ? updatedSec : s))
                    );
                    handleInputChange('section', updatedSec.name);
                    setSectionModal({ isOpen: false, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save section error:', err);
            toast.error(err.response?.data?.message || 'Failed to save section', { id: 'save-sec-modal' });
            setSectionModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    /**
     * Inline Section Delete Confirmation
     */
    const handleDeleteSectionInline = (opt) => {
        if (!opt) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Production Section',
            message: `Are you sure you want to delete section '${opt.name}'?`,
            onConfirm: async () => {
                try {
                    toast.loading('Deleting section...', { id: 'delete-sec' });
                    const res = await axiosInstance.delete(`/sections/${opt._id}`);
                    if (res.data?.success) {
                        toast.success(`Section '${opt.name}' deleted!`, { id: 'delete-sec' });
                        setSectionsList((prev) => prev.filter((s) => s._id !== opt._id));
                        if (formData.section === opt.name) {
                            handleInputChange('section', '');
                        }
                    }
                } catch (err) {
                    console.error('Delete section error:', err);
                    toast.error(err.response?.data?.message || 'Failed to delete section', { id: 'delete-sec' });
                }
            }
        });
    };

    /**
     * Open Add Plant Location Modal
     */
    const handleOpenAddPlantLocationModal = () => {
        const nextNum = (locationsList.length || 0) + 1;
        const padded = String(nextNum).padStart(3, '0');
        setPlantLocationModal({
            isOpen: true,
            mode: 'ADD',
            locationId: null,
            name: '',
            code: `PLANT-${padded}`,
            type: 'FACTORY',
            isSaving: false
        });
    };

    /**
     * Open Edit Plant Location Modal
     */
    const handleOpenEditPlantLocationModal = (opt) => {
        if (!opt) return;
        setPlantLocationModal({
            isOpen: true,
            mode: 'EDIT',
            locationId: opt._id,
            name: opt.name || '',
            code: opt.code || `PLANT-${String(opt._id).slice(-4).toUpperCase()}`,
            type: opt.type || 'FACTORY',
            isSaving: false
        });
    };

    /**
     * Save Plant Location Modal (+ Add New / Edit)
     */
    const handleSavePlantLocationModal = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const nameTrimmed = (plantLocationModal.name || '').trim();
        if (!nameTrimmed) {
            toast.error('Plant Location name is required');
            return;
        }
        const codeTrimmed = (plantLocationModal.code || `PLANT-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

        try {
            setPlantLocationModal((prev) => ({ ...prev, isSaving: true }));
            if (plantLocationModal.mode === 'ADD') {
                toast.loading('Creating plant location...', { id: 'save-loc-modal' });
                const res = await axiosInstance.post('/locations', {
                    name: nameTrimmed,
                    code: codeTrimmed,
                    type: plantLocationModal.type || 'FACTORY'
                });
                if (res.data?.success && res.data?.data) {
                    const newLoc = res.data.data;
                    toast.success(`Plant location '${newLoc.name}' created!`, { id: 'save-loc-modal' });
                    setLocationsList((prev) => [...prev, newLoc]);
                    setPlantLocations((prev) => [...prev, newLoc]);
                    handleInputChange('plantLocation', newLoc._id);
                    handleInputChange('plantLocationName', newLoc.name);
                    setPlantLocationModal({ isOpen: false, mode: 'ADD', locationId: null, name: '', code: '', type: 'FACTORY', isSaving: false });
                }
            } else if (plantLocationModal.mode === 'EDIT' && plantLocationModal.locationId) {
                toast.loading('Updating plant location...', { id: 'save-loc-modal' });
                const res = await axiosInstance.put(`/locations/${plantLocationModal.locationId}`, {
                    name: nameTrimmed,
                    code: codeTrimmed,
                    type: plantLocationModal.type || 'FACTORY'
                });
                if (res.data?.success && res.data?.data) {
                    const updatedLoc = res.data.data;
                    toast.success(`Plant location updated to '${updatedLoc.name}'!`, { id: 'save-loc-modal' });
                    setLocationsList((prev) =>
                        prev.map((l) => (l._id === updatedLoc._id ? updatedLoc : l))
                    );
                    setPlantLocations((prev) =>
                        prev.map((l) => (l._id === updatedLoc._id ? updatedLoc : l))
                    );
                    handleInputChange('plantLocation', updatedLoc._id);
                    handleInputChange('plantLocationName', updatedLoc.name);
                    setPlantLocationModal({ isOpen: false, mode: 'ADD', locationId: null, name: '', code: '', type: 'FACTORY', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save plant location error:', err);
            toast.error(err.response?.data?.message || 'Failed to save plant location', { id: 'save-loc-modal' });
            setPlantLocationModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    /**
     * Inline Plant Location Delete Confirmation
     */
    const handleDeletePlantLocationInline = (opt) => {
        if (!opt) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Plant Location',
            message: `Are you sure you want to delete facility '${opt.name}'?`,
            onConfirm: async () => {
                try {
                    toast.loading('Deleting facility...', { id: 'delete-loc' });
                    const res = await axiosInstance.delete(`/locations/${opt._id}`);
                    if (res.data?.success) {
                        toast.success(`Plant location '${opt.name}' deleted!`, { id: 'delete-loc' });
                        setLocationsList((prev) => prev.filter((l) => l._id !== opt._id));
                        setPlantLocations((prev) => prev.filter((l) => l._id !== opt._id));
                        if (formData.plantLocation === opt.name || formData.plantLocation === opt._id) {
                            handleInputChange('plantLocation', '');
                            handleInputChange('plantLocationName', '');
                        }
                    }
                } catch (err) {
                    console.error('Delete plant location error:', err);
                    toast.error(err.response?.data?.message || 'Failed to delete facility', { id: 'delete-loc' });
                }
            }
        });
    };

    /**
     * Open Add Attribute Modal
     */
    const handleOpenAddAttributeModal = (type, label) => {
        setAttributeModal({
            isOpen: true,
            mode: 'ADD',
            attributeType: type,
            attributeLabel: label,
            itemId: null,
            inputValue: '',
            isSaving: false
        });
    };

    /**
     * Open Edit Attribute Modal
     */
    const handleOpenEditAttributeModal = (type, label, option) => {
        if (!option) return;
        setAttributeModal({
            isOpen: true,
            mode: 'EDIT',
            attributeType: type,
            attributeLabel: label,
            itemId: option._id,
            inputValue: option.name,
            isSaving: false
        });
    };

    /**
     * Save Attribute Modal Handler (Add or Edit)
     */
    const handleSaveAttributeModal = async (e) => {
        if (e) e.preventDefault();
        const trimmed = (attributeModal.inputValue || '').trim();
        if (!trimmed) {
            toast.error(`Please enter an option name for ${attributeModal.attributeLabel}`);
            return;
        }

        try {
            setAttributeModal((prev) => ({ ...prev, isSaving: true }));
            if (attributeModal.mode === 'ADD') {
                toast.loading(`Creating option...`, { id: 'save-attr-modal' });
                const res = await axiosInstance.post('/raw-material-attributes', {
                    attributeType: attributeModal.attributeType,
                    name: trimmed
                });
                if (res.data?.success && res.data.data) {
                    const newDoc = res.data.data;
                    toast.success(`'${newDoc.name}' created!`, { id: 'save-attr-modal' });
                    setRmAttributes((prev) => ({
                        ...prev,
                        [attributeModal.attributeType]: [...(prev[attributeModal.attributeType] || []), newDoc]
                    }));
                    handleInputChange(attributeModal.attributeType, newDoc.name);
                    setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', itemId: null, inputValue: '', isSaving: false });
                }
            } else if (attributeModal.mode === 'EDIT' && attributeModal.itemId) {
                toast.loading(`Updating option...`, { id: 'save-attr-modal' });
                const res = await axiosInstance.put(`/raw-material-attributes/${attributeModal.itemId}`, {
                    name: trimmed
                });
                if (res.data?.success && res.data.data) {
                    const updatedDoc = res.data.data;
                    toast.success(`'${updatedDoc.name}' updated!`, { id: 'save-attr-modal' });
                    setRmAttributes((prev) => ({
                        ...prev,
                        [attributeModal.attributeType]: (prev[attributeModal.attributeType] || []).map((item) =>
                            item._id === updatedDoc._id ? updatedDoc : item
                        )
                    }));
                    handleInputChange(attributeModal.attributeType, updatedDoc.name);
                    setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', itemId: null, inputValue: '', isSaving: false });
                }
            }
        } catch (err) {
            console.error('Save attribute error:', err);
            toast.error(err.response?.data?.message || 'Failed to save option', { id: 'save-attr-modal' });
            setAttributeModal((prev) => ({ ...prev, isSaving: false }));
        }
    };

    /**
     * Inline Attribute Delete Confirmation
     */
    const handleDeleteAttributeInline = (type, label, option) => {
        if (!option) return;
        setConfirmModal({
            isOpen: true,
            title: `Delete ${label} Option`,
            message: `Are you sure you want to delete '${option.name}' from ${label}?`,
            onConfirm: async () => {
                try {
                    toast.loading(`Deleting '${option.name}'...`, { id: 'delete-attr-inline' });
                    const res = await axiosInstance.delete(`/raw-material-attributes/${option._id}`);
                    if (res.data?.success) {
                        toast.success(`'${option.name}' deleted!`, { id: 'delete-attr-inline' });
                        setRmAttributes((prev) => ({
                            ...prev,
                            [type]: (prev[type] || []).filter((item) => item._id !== option._id)
                        }));
                        if (formData[type] === option.name) {
                            handleInputChange(type, '');
                        }
                    }
                } catch (err) {
                    console.error('Delete attribute error:', err);
                    toast.error(err.response?.data?.message || 'Failed to delete option', { id: 'delete-attr-inline' });
                }
            }
        });
    };

    // Reset form data when active tab changes or drawer closes
    useEffect(() => {
        if (!isDrawerOpen) {
            setFormData({});
            setEditingItem(null);
        }
    }, [activeTabKey, isDrawerOpen]);

    if (!tabs || tabs.length === 0) {
        return <div className="p-4 text-text-muted font-sans">No configuration provided for this resource page.</div>;
    }

    const showTabBar = tabs.length > 1;

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleNestedChange = (parent, field, value) => {
        setFormData((prev) => ({
            ...prev,
            [parent]: {
                ...(prev[parent] || {}),
                [field]: value
            }
        }));
    };

    /**
     * CSV Export Handler for Active Tab
     */
    const handleExportCsv = async () => {
        if (!activeTab?.resourcePath) return;
        try {
            toast.loading('Generating CSV export...', { id: 'csv-export' });

            let csvBlob;
            try {
                const response = await axiosInstance.get(`${activeTab.resourcePath}/export`, {
                    params: {
                        search,
                        status: (statusFilter && statusFilter !== 'All Statuses' && statusFilter !== 'All' && statusFilter !== 'ALL') ? statusFilter : undefined
                    },
                    responseType: 'blob'
                });
                csvBlob = new Blob([response.data], { type: 'text/csv' });
            } catch {
                // Fallback: Fetch data records and generate CSV client-side
                const listRes = await axiosInstance.get(activeTab.resourcePath, {
                    params: {
                        limit: 500,
                        search,
                        status: (statusFilter && statusFilter !== 'All Statuses' && statusFilter !== 'All' && statusFilter !== 'ALL') ? statusFilter : undefined
                    }
                });

                if (listRes.data?.success && Array.isArray(listRes.data.data) && listRes.data.data.length > 0) {
                    const records = listRes.data.data;
                    const headers = activeTab?.columns
                        ? activeTab.columns.map((c) => typeof c.header === 'string' ? c.header : c.accessor || 'FIELD')
                        : Object.keys(records[0]).filter((k) => typeof records[0][k] !== 'object');

                    const csvRows = [headers.join(',')];

                    records.forEach((row) => {
                        const rowVals = activeTab?.columns
                            ? activeTab.columns.map((c) => {
                                let val = '';
                                if (c.accessor) val = row[c.accessor];
                                else if (c.render && typeof c.render === 'function') val = row.name || row.code || row.poNumber || '';
                                if (val === undefined || val === null) val = '';
                                return `"${String(val).replace(/"/g, '""')}"`;
                            })
                            : headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`);

                        csvRows.push(rowVals.join(','));
                    });

                    csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                } else {
                    throw new Error('No data available to export');
                }
            }

            const url = window.URL.createObjectURL(csvBlob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${activeTabKey}_export_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('CSV export downloaded successfully!', { id: 'csv-export' });
        } catch (err) {
            console.error('Export CSV error:', err);
            toast.error(err.message || 'Failed to export CSV file', { id: 'csv-export' });
        }
    };

    /**
     * Save Record (Create or Update)
     */
    const handleSaveRecord = async (e) => {
        e.preventDefault();
        let res;

        const payload = {
            ...formData,
            shiftCode: formData.shiftCode || formData.code,
            startTime: formData.startTime || '06:00',
            endTime: formData.endTime || '14:00',
            standardHours: formData.standardHours !== undefined ? Number(formData.standardHours) : 8,
            gracePeriodMinutes: formData.gracePeriodMinutes !== undefined ? Number(formData.gracePeriodMinutes) : 15,
            isActive: formData.isActive !== false
        };

        if (activeTabKey === 'employees') {
            payload.employeeCode = (formData.employeeCode || formData.code || '').trim().toUpperCase();
            payload.code = payload.employeeCode;
            payload.department = formData.department || 'PRODUCTION';
            payload.shiftAssignment = formData.shiftAssignment || (shiftsList[0]?._id || '');
            payload.facility = formData.facility || (locationsList[0]?._id || '');
            payload.monthlySalary = formData.monthlySalary !== undefined && formData.monthlySalary !== '' ? Number(formData.monthlySalary) : 0;
        }

        const key = activeTabKey?.toLowerCase() || '';
        if (key === 'machines' || key === 'machine') {
            payload.code = (formData.code || formData.machineCode || currentCode || '').toUpperCase();
            payload.name = formData.name || '';
            payload.section = formData.section || (sectionsList[0]?.name || 'Extrusion');
            const matchedLoc = plantLocations.find((l) => l._id === formData.plantLocation || l.name === formData.plantLocation);
            payload.plantLocation = matchedLoc ? matchedLoc.name : (formData.plantLocation || '');
            if (matchedLoc?._id) {
                payload.defaultLocation = matchedLoc._id;
            }
            const rawOps = Array.isArray(formData.currentOperators)
                ? formData.currentOperators.map((o) => (typeof o === 'object' ? o?._id : o)).filter(Boolean)
                : (formData.currentOperator ? [typeof formData.currentOperator === 'object' ? formData.currentOperator._id : formData.currentOperator] : []);
            payload.currentOperators = rawOps;
            payload.currentOperator = rawOps[0] || null;
            payload.status = formData.status || 'Available';
            if (formData.capacityPerHour || formData.capacity) {
                payload.capacityPerHour = Number(formData.capacityPerHour || formData.capacity);
            }
            if (formData.efficiency !== undefined && formData.efficiency !== '') {
                payload.efficiency = Number(formData.efficiency);
            }
        }

        if (key === 'raw-materials' || key === 'rawmaterials') {
            const catVal = typeof formData.category === 'object' ? formData.category?._id : formData.category;
            const uomVal = typeof formData.uom === 'object' ? formData.uom?._id : formData.uom;
            payload.category = catVal || (categoriesList[0]?._id || '');
            payload.uom = uomVal || (uomsList[0]?._id || '');
            delete payload.currentStock; // Current stock can only be updated via GRN / Stock Ledger

            // Auto-compose descriptive Raw Material title from attributes
            const fullComposedTitle = composeRawMaterialTitle(formData);
            payload.name = fullComposedTitle || (formData.baseName !== undefined ? formData.baseName : formData.name) || 'Raw Material';
            payload.baseName = formData.baseName !== undefined ? formData.baseName : (formData.name || '');

            // Synchronize color from materialColour for backward compatibility
            if (formData.materialColour) {
                payload.color = formData.materialColour;
            }
            if (Array.isArray(formData.colors)) {
                payload.colors = formData.colors.filter((c) => c && String(c).trim() !== '').map((c) => String(c).trim());
            }
        }

        if (key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts') {
            const validIngredients = bomIngredients
                .map((i) => ({
                    rawMaterial: typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial,
                    quantityPerUnit: Number(i.quantityPerUnit || i.quantity || 0)
                }))
                .filter((i) => i.rawMaterial && i.quantityPerUnit > 0);

            if (validIngredients.length === 0) {
                toast.error('Please define at least one Raw Material requirement (with quantity > 0) for this Finished Good.');
                return;
            }

            const catVal = typeof formData.category === 'object' ? formData.category?._id : formData.category;
            const uomVal = typeof formData.uom === 'object' ? formData.uom?._id : formData.uom;
            const locVal = typeof formData.defaultLocation === 'object' ? formData.defaultLocation?._id : formData.defaultLocation;
            payload.code = (formData.code || formData.itemCode || currentCode || '').toUpperCase();
            payload.category = catVal || (categoriesList[0]?._id || '');
            payload.uom = uomVal || (uomsList[0]?._id || '');
            if (locVal) payload.defaultLocation = locVal;

            payload.bagShape = formData.bagShape || '';

            if (formData.fabricGSM) payload.fabricGSM = Number(formData.fabricGSM);
            if (formData.bagCapacity) payload.bagCapacity = Number(formData.bagCapacity);
            if (formData.pricePerBag) payload.pricePerBag = Number(formData.pricePerBag);
            const selectedDimUnit = formData.dimensions?.unit || formData.dimensionUnit || 'cm';
            if (formData.dimensions) {
                payload.dimensions = {
                    width: Number(formData.dimensions.width || 0),
                    length: Number(formData.dimensions.length || 0),
                    unit: selectedDimUnit
                };
            }
            payload.dimensionUnit = selectedDimUnit;

            // Auto-compose descriptive Finished Bag title from classification fields
            payload.printSides = formData.printSides || formData.printSpec?.printSides || 'NONE';
            payload.frontColours = Number(formData.frontColours !== undefined ? formData.frontColours : (formData.printSpec?.frontColours || 0)) || 0;
            payload.backColours = Number(formData.backColours !== undefined ? formData.backColours : (formData.printSpec?.backColours || 0)) || 0;
            payload.printSpec = {
                printSides: payload.printSides,
                frontColours: payload.frontColours,
                backColours: payload.backColours
            };
            payload.colorAndPrint = formData.colorAndPrint || '';

            const fullFGTitle = composeFinishedBagTitle({ ...formData, ...payload }, categoriesList, bagShapesList);
            payload.name = fullFGTitle || (formData.baseName !== undefined ? formData.baseName : formData.name) || 'Finished Good';
            payload.baseName = formData.baseName !== undefined ? formData.baseName : (formData.name || '');

            payload.materialRequirements = validIngredients;
            payload.inks = (inks || [])
                .filter((ink) => ink && String(ink).trim() !== '')
                .map((ink) => String(ink).trim());
        }


        if (key === 'boms' || key === 'bom') {
            const fgVal = typeof formData.finishedGood === 'object' ? formData.finishedGood?._id : (formData.finishedGood || finishedGoodsList[0]?._id);
            payload.finishedGood = fgVal;
            payload.name = formData.name || '';
            payload.items = bomIngredients
                .map((i) => ({
                    rawMaterial: typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial,
                    quantityPerUnit: Number(i.quantityPerUnit || i.quantity || 0)
                }))
                .filter((i) => i.rawMaterial && i.quantityPerUnit > 0);
            payload.replaceExisting = true;
        }

        if (editingItem?._id) {
            res = await updateItem(editingItem._id, payload);
        } else {
            res = await createItem(payload);
        }

        if (res && res.success) {
            setIsDrawerOpen(false);
            setFormData({});
            setEditingItem(null);
        }
    };

    /**
     * Inline Shift Creation Submission (inside Employee Form)
     */
    const handleSaveInlineShift = async (e) => {
        e.preventDefault();
        try {
            setIsSavingInlineShift(true);
            const res = await axiosInstance.post('/shifts', inlineShiftData);
            if (res.data?.success && res.data?.data) {
                const newShift = res.data.data;
                toast.success(`Shift '${newShift.name}' created!`);
                setShiftsList((prev) => [...prev, newShift]);
                handleInputChange('shiftAssignment', newShift._id);
                setIsInlineShiftModalOpen(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create inline shift');
        } finally {
            setIsSavingInlineShift(false);
        }
    };

    /**
     * Inline Location Creation Submission (inside Employee Form)
     */
    const handleSaveInlineLocation = async (e) => {
        e.preventDefault();
        if (!inlineLocationData.name.trim() || !inlineLocationData.code.trim() || !inlineLocationData.type) {
            toast.error('Please enter Location Name, Code, and Type');
            return;
        }
        try {
            setIsSavingInlineLocation(true);
            const res = await axiosInstance.post('/locations', {
                ...inlineLocationData,
                name: inlineLocationData.name.trim(),
                code: inlineLocationData.code.trim().toUpperCase()
            });
            if (res.data?.success && res.data?.data) {
                const newLoc = res.data.data;
                toast.success(`Facility '${newLoc.name}' created!`);
                setLocationsList((prev) => [...prev, newLoc]);
                handleInputChange('facility', newLoc._id);
                setIsInlineLocationModalOpen(false);
            }
        } catch (err) {
            console.error('Failed to create inline location:', err);
            toast.error(err.response?.data?.message || 'Failed to create inline facility/location');
        } finally {
            setIsSavingInlineLocation(false);
        }
    };

    /**
     * Open Create Drawer and Pre-fill Suggested Code for ALL Entities
     */
    const handleOpenDrawer = () => {
        setEditingItem(null);
        setBomIngredients([{ rawMaterial: '', quantityPerUnit: '' }]);
        setInks([]);

        const suggestedCode = generateSuggestedCode(activeTabKey, pagination?.total || 0);

        setFormData({
            code: suggestedCode,
            customerCode: suggestedCode,
            supplierCode: suggestedCode,
            employeeCode: suggestedCode,
            machineCode: suggestedCode,
            itemCode: suggestedCode,
            shiftCode: suggestedCode,
            section: 'EXTRUSION',
            startTime: '06:00',
            endTime: '14:00',
            standardHours: 8,
            gracePeriodMinutes: 15,
            isActive: true,
            colors: [],
            dimensionUnit: 'cm',
            dimensions: { width: '', length: '', unit: 'cm' },
            status: activeTabKey === 'customers' ? 'ACTIVE_CUSTOMER' : (activeTabKey === 'machines' ? 'AVAILABLE' : 'Active')
        });

        if (onAddClick && (activeTabKey === 'work-orders' || activeTabKey === 'stage-monitor')) {
            onAddClick(activeTabKey);
        } else {
            setIsDrawerOpen(true);
        }
    };

    const isCurrentTabEditable = (() => {
        const k = (activeTabKey || '').toLowerCase();
        const p = (activeTab?.resourcePath || '').toLowerCase();
        if (activeTab?.isEditable === false) return false;
        if (k.includes('qc') || p.includes('qc-inspection')) return false;
        if (k.includes('invoice') || p.includes('invoice')) return false;
        if (k.includes('grn') || p.includes('grn')) return false;
        if (k.includes('material-receipt') || p.includes('material-receipt')) return false;
        if (k.includes('stock-transaction') || p.includes('stock-transaction') || k.includes('valuation') || k.includes('audit-ledger')) return false;
        if (k.includes('dispatch') || p.includes('dispatch')) return false;
        return true;
    })();

    const handleEditRow = (row) => {
        if (!isCurrentTabEditable) return;
        setEditingItem(row);
        const codeVal = row.code || row.customerCode || row.supplierCode || row.employeeCode || row.machineCode || row.itemCode || row.shiftCode || '';

        if (row.materialRequirements && Array.isArray(row.materialRequirements) && row.materialRequirements.length > 0) {
            setBomIngredients(
                row.materialRequirements.map((i) => ({
                    rawMaterial: typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial,
                    quantityPerUnit: i.quantityPerUnit || i.quantity || ''
                }))
            );
        } else if (row.items && Array.isArray(row.items) && row.items.length > 0) {
            setBomIngredients(
                row.items.map((i) => ({
                    rawMaterial: typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial,
                    quantityPerUnit: i.quantityPerUnit || i.quantity || ''
                }))
            );
        } else if (row._id && (activeTabKey === 'finished-goods' || activeTabKey === 'finishedbags' || activeTabKey === 'finishedproducts')) {
            setBomIngredients([{ rawMaterial: '', quantityPerUnit: '' }]);
            axiosInstance.get(`/boms?finishedGood=${row._id}`).then((res) => {
                if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                    const defaultBom = res.data.data.find((b) => b.isDefault) || res.data.data[0];
                    if (defaultBom?.items?.length > 0) {
                        setBomIngredients(
                            defaultBom.items.map((i) => ({
                                rawMaterial: typeof i.rawMaterial === 'object' ? i.rawMaterial?._id : i.rawMaterial,
                                quantityPerUnit: i.quantityPerUnit || ''
                            }))
                        );
                    }
                }
            }).catch(() => { });
        } else {
            setBomIngredients([{ rawMaterial: '', quantityPerUnit: '' }]);
        }

        const editDimUnit = row.dimensionUnit || row.dimensions?.unit || 'cm';
        setFormData({
            ...row,
            // IMPORTANT: never fall back to row.name here — row.name is the full auto-composed
            // title, not a short label. Doing so would inject the compiled title back into
            // composeFinishedBagTitle as the baseName segment, causing recursive duplication on edit.
            baseName: row.baseName || '',
            materialColour: row.materialColour || row.color || '',
            storageBayLocation: row.storageBayLocation || row.warehouseLocation || '',
            warehouseLocation: row.warehouseLocation || row.storageBayLocation || '',
            dimensionUnit: editDimUnit,
            dimensions: {
                ...(row.dimensions || {}),
                unit: editDimUnit
            },
            currentOperators: (Array.isArray(row.currentOperators) && row.currentOperators.length > 0)
                ? row.currentOperators.map((o) => (typeof o === 'object' ? o._id : o))
                : (row.currentOperator ? [typeof row.currentOperator === 'object' ? row.currentOperator._id : row.currentOperator] : []),
            printSides: row.printSides || row.printSpec?.printSides || 'NONE',
            frontColours: row.frontColours !== undefined ? row.frontColours : (row.printSpec?.frontColours || 0),
            backColours: row.backColours !== undefined ? row.backColours : (row.printSpec?.backColours || 0),
            code: codeVal,
            customerCode: codeVal,
            supplierCode: codeVal,
            employeeCode: codeVal,
            machineCode: codeVal,
            itemCode: codeVal,
            shiftCode: codeVal,
            shiftAssignment: typeof row.shiftAssignment === 'object' ? row.shiftAssignment?._id : row.shiftAssignment,
            facility: typeof row.facility === 'object' ? row.facility?._id : row.facility,
            finishedGood: typeof row.finishedGood === 'object' ? row.finishedGood?._id : row.finishedGood,
            colors: Array.isArray(row.colors) ? row.colors : (row.colors || []),
            isActive: row.isActive !== false
        });
        setInks(Array.isArray(row.inks) ? row.inks : (Array.isArray(row.inksUsed) ? row.inksUsed.map((i) => typeof i === 'string' ? i : (i.color || '')) : []));
        setIsDrawerOpen(true);
    };

    const handleDeleteRow = (row) => {
        if (!row?._id) return;
        setConfirmModal({
            isOpen: true,
            title: 'Deactivate Record',
            message: `Are you sure you want to deactivate this ${activeTabLabel} record?`,
            onConfirm: async () => {
                await deleteItem(row._id);
            }
        });
    };

    const currentCode = formData.code || formData.customerCode || formData.supplierCode || formData.employeeCode || formData.machineCode || formData.itemCode || formData.shiftCode || '';

    const handleCodeChange = (e) => {
        const val = e.target.value.toUpperCase();
        handleInputChange('code', val);
        handleInputChange('customerCode', val);
        handleInputChange('supplierCode', val);
        handleInputChange('employeeCode', val);
        handleInputChange('machineCode', val);
        handleInputChange('itemCode', val);
        handleInputChange('shiftCode', val);
    };

    // Shared Status Toggle Component
    const renderIsActiveToggle = () => (
        <div className="pt-3 border-t border-border flex items-center justify-between">
            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                    Record Activation Status
                </label>
                <span className="text-[11px] text-text-muted">
                    {formData.isActive !== false ? 'Active (Record is enabled)' : 'Inactive (Deactivated record)'}
                </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
        </div>
    );

    // Render Dynamic Form Inputs inside Drawer Body based on active tab key
    const renderDrawerForm = () => {
        const key = activeTabKey?.toLowerCase() || '';

        // SHIFTS FORM
        if (key === 'shifts' || key === 'shift') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Shift Code (Auto-suggested) *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.shiftCode || currentCode}
                            onChange={(e) => handleInputChange('shiftCode', e.target.value.toUpperCase())}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Shift Title / Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Shift A (Morning)"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Start Time (HH:MM) *
                            </label>
                            <input
                                type="time"
                                required
                                value={formData.startTime || '06:00'}
                                onChange={(e) => handleInputChange('startTime', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                End Time (HH:MM) *
                            </label>
                            <input
                                type="time"
                                required
                                value={formData.endTime || '14:00'}
                                onChange={(e) => handleInputChange('endTime', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Standard Working Hours
                            </label>
                            <input
                                type="number"
                                placeholder="8"
                                value={formData.standardHours !== undefined ? formData.standardHours : 8}
                                onChange={(e) => handleInputChange('standardHours', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Grace Period (Minutes)
                            </label>
                            <input
                                type="number"
                                placeholder="15"
                                value={formData.gracePeriodMinutes !== undefined ? formData.gracePeriodMinutes : 15}
                                onChange={(e) => handleInputChange('gracePeriodMinutes', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // CUSTOMERS FORM
        if (key === 'customers') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Customer Code (Auto-suggested)
                        </label>
                        <input
                            type="text"
                            required
                            value={currentCode}
                            onChange={handleCodeChange}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Company Name / Title *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Acme PolySack Industries Pvt Ltd"
                            value={formData.companyName || formData.name || ''}
                            onChange={(e) => {
                                handleInputChange('companyName', e.target.value);
                                handleInputChange('name', e.target.value);
                            }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Rajesh Shah"
                                value={formData.contactPerson || ''}
                                onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. +91 98250 12345"
                                value={formData.phone || ''}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="sales@acmepolysack.com"
                                value={formData.email || ''}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                GSTIN Number
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 24AAACA1234A1Z5"
                                value={formData.gstin || ''}
                                onChange={(e) => handleInputChange('gstin', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Surat"
                                value={formData.city || ''}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                State
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Gujarat"
                                value={formData.state || ''}
                                onChange={(e) => handleInputChange('state', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Address
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Plot 45, GIDC Industrial Estate..."
                            value={formData.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Credit Limit (₹)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 500000"
                                value={formData.creditLimit || ''}
                                onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Customer Status
                            </label>
                            <select
                                value={formData.status || 'ACTIVE_CUSTOMER'}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="LEAD">Lead</option>
                                <option value="ACTIVE_CUSTOMER">Active Customer</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // SUPPLIERS FORM
        if (key === 'suppliers') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Supplier Code (Auto-suggested)
                        </label>
                        <input
                            type="text"
                            required
                            value={currentCode}
                            onChange={handleCodeChange}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Supplier / Vendor Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Gujarat Polymers Raw Materials Ltd"
                            value={formData.name || formData.companyName || ''}
                            onChange={(e) => {
                                handleInputChange('name', e.target.value);
                                handleInputChange('companyName', e.target.value);
                            }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Amit Patel"
                                value={formData.contactPerson || ''}
                                onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Phone Number
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. +91 98250 54321"
                                value={formData.phone || ''}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="orders@gujaratpolymers.com"
                                value={formData.email || ''}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                GSTIN Number
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 24BBBCB5678B1Z9"
                                value={formData.gstin || ''}
                                onChange={(e) => handleInputChange('gstin', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans uppercase"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                City
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Vapi"
                                value={formData.city || ''}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                State
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Gujarat"
                                value={formData.state || ''}
                                onChange={(e) => handleInputChange('state', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Address
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Phase 3, GIDC Industrial Colony..."
                            value={formData.address || ''}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Payment Terms
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Net 30 Days"
                            value={formData.paymentTerms || ''}
                            onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // EMPLOYEES FORM
        if (key === 'employees') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Employee Code *
                            </label>
                            <span className="text-[10px] text-text-muted">Auto-generated &middot; Editable</span>
                        </div>
                        <input
                            type="text"
                            required
                            placeholder="e.g. EMP-1001"
                            value={formData.employeeCode || formData.code || ''}
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                handleInputChange('employeeCode', val);
                                handleInputChange('code', val);
                            }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main font-mono font-semibold uppercase tracking-wider focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Employee Full Name *
                        </label>
                        <input
                            type="text"
                            name="name"
                            required
                            placeholder="e.g. Suresh V. Verma"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Department *
                            </label>
                            <select
                                name="department"
                                required
                                value={formData.department || 'PRODUCTION'}
                                onChange={(e) => handleInputChange('department', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="PRODUCTION">Production</option>
                                <option value="EXTRUSION">Extrusion</option>
                                <option value="WEAVING">Weaving</option>
                                <option value="LAMINATION">Lamination</option>
                                <option value="PRINTING">Printing</option>
                                <option value="SEWING">Sewing</option>
                                <option value="BALING">Baling</option>
                                <option value="QUALITY">Quality Control</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="LOGISTICS">Logistics</option>
                                <option value="ADMINISTRATION">Administration</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Designation
                            </label>
                            <input
                                type="text"
                                name="designation"
                                placeholder="e.g. Senior Extrusion Operator"
                                value={formData.designation || ''}
                                onChange={(e) => handleInputChange('designation', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Shift Assignment Select with Inline "+ Add New Shift..." */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Shift Assignment *
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsInlineShiftModalOpen(true)}
                                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                    <Plus size={12} />
                                    <span>Add Shift</span>
                                </button>
                            </div>
                            <select
                                name="shiftAssignment"
                                required
                                value={formData.shiftAssignment || (shiftsList[0]?._id || '')}
                                onChange={(e) => {
                                    if (e.target.value === '__ADD_NEW_SHIFT__') {
                                        setIsInlineShiftModalOpen(true);
                                    } else {
                                        handleInputChange('shiftAssignment', e.target.value);
                                    }
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select Shift --</option>
                                {shiftsList.map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.shiftCode || 'SHIFT'} - {s.name} ({s.startTime}–{s.endTime})
                                    </option>
                                ))}
                                <option value="__ADD_NEW_SHIFT__" className="font-bold text-primary">
                                    + Add New Shift...
                                </option>
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Facility / Location *
                                </label>
                                <button
                                    type="button"
                                    onClick={handleOpenInlineLocationModal}
                                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                    <Plus size={12} />
                                    <span>Add Facility</span>
                                </button>
                            </div>
                            <select
                                name="facility"
                                required
                                value={formData.facility || (locationsList[0]?._id || '')}
                                onChange={(e) => {
                                    if (e.target.value === '__ADD_NEW_LOCATION__') {
                                        handleOpenInlineLocationModal();
                                    } else {
                                        handleInputChange('facility', e.target.value);
                                    }
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select Facility --</option>
                                {locationsList.map((l) => (
                                    <option key={l._id} value={l._id}>
                                        {l.code ? `${l.code} - ` : ''}{l.name}
                                    </option>
                                ))}
                                <option value="__ADD_NEW_LOCATION__" className="font-bold text-primary">
                                    + Add New Facility...
                                </option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Monthly Base Salary (₹)
                        </label>
                        <input
                            type="number"
                            name="monthlySalary"
                            placeholder="e.g. 28000"
                            value={formData.monthlySalary !== undefined ? formData.monthlySalary : ''}
                            onChange={(e) => handleInputChange('monthlySalary', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // MACHINES FORM
        if (key === 'machines') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Machine Code (Auto-suggested)
                        </label>
                        <input
                            type="text"
                            required
                            value={currentCode}
                            onChange={handleCodeChange}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Machine Name *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. High Speed Tape Extrusion Line #2"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {/* Row 1: Production Section & Plant Location side-by-side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <InlineLookupSelect
                            label="Production Section"
                            value={formData.section || ''}
                            onChange={(val) => handleInputChange('section', val)}
                            options={sectionsList}
                            onOpenAdd={() => setSectionModal({ isOpen: true, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false })}
                            onOpenEdit={(opt) => setSectionModal({ isOpen: true, mode: 'EDIT', sectionId: opt._id, inputValue: opt.name, isSaving: false })}
                            onDelete={(opt) => handleDeleteSectionInline(opt)}
                            placeholder="-- Select Section --"
                            required
                        />

                        <div className="flex flex-col h-full w-full">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Plant Location
                                </label>
                                <div className="flex items-center space-x-2 text-xs font-semibold">
                                    <button
                                        type="button"
                                        onClick={handleOpenAddPlantLocationModal}
                                        className="text-orange-500 hover:text-orange-700 font-bold cursor-pointer transition-colors"
                                    >
                                        + Add New
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const matched = plantLocations.find(
                                                (l) => l._id === formData.plantLocation || l.name === formData.plantLocation
                                            );
                                            if (matched) {
                                                handleOpenEditPlantLocationModal(matched);
                                            } else {
                                                toast.error('Please select a plant location first to edit');
                                            }
                                        }}
                                        className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer transition-colors"
                                    >
                                        ✎ Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const matched = plantLocations.find(
                                                (l) => l._id === formData.plantLocation || l.name === formData.plantLocation
                                            );
                                            if (matched) {
                                                handleDeletePlantLocationInline(matched);
                                            } else {
                                                toast.error('Please select a plant location first to delete');
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700 font-medium cursor-pointer transition-colors"
                                    >
                                        🗑 Delete
                                    </button>
                                </div>
                            </div>
                            <div className="mt-auto w-full">
                                <select
                                    value={
                                        plantLocations.find((l) => l._id === formData.plantLocation)?._id ||
                                        plantLocations.find((l) => l.name === formData.plantLocation)?._id ||
                                        formData.plantLocation ||
                                        ''
                                    }
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleInputChange('plantLocation', val);
                                        const matched = plantLocations.find((l) => l._id === val);
                                        if (matched) {
                                            handleInputChange('plantLocationName', matched.name);
                                        }
                                    }}
                                    className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer transition-colors"
                                >
                                    <option value="">-- Select Plant Location --</option>
                                    {plantLocations.map((location) => (
                                        <option key={location._id} value={location._id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Capacity per Hour & Current Operator side-by-side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Capacity per Hour (Kg/Hr)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 450"
                                value={formData.capacityPerHour || formData.capacity || ''}
                                onChange={(e) => {
                                    handleInputChange('capacityPerHour', e.target.value);
                                    handleInputChange('capacity', e.target.value);
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                Assigned Machine Operators (Search & Select by Code)
                            </label>
                            <EmployeeMultiSelect
                                employees={employeesList}
                                selectedIds={formData.currentOperators || (formData.currentOperator ? [formData.currentOperator] : [])}
                                onChange={(ids) => {
                                    handleInputChange('currentOperators', ids);
                                    handleInputChange('currentOperator', ids[0] || null);
                                }}
                            />
                        </div>
                    </div>

                    {/* Row 3: Machine Efficiency & Status side-by-side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Machine Efficiency (%)
                            </label>
                            <input
                                type="number"
                                placeholder="e.g. 92"
                                value={formData.efficiency || ''}
                                onChange={(e) => handleInputChange('efficiency', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Status
                            </label>
                            <select
                                value={formData.status || 'AVAILABLE'}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="AVAILABLE">Available</option>
                                <option value="IN_USE">In Use</option>
                                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                                <option value="OUT_OF_SERVICE">Out of Service</option>
                            </select>
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // RAW MATERIALS FORM
        if (key === 'raw-materials' || key === 'rawmaterials') {
            const composedTitle = composeRawMaterialTitle(formData);

            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Item Code (Auto-suggested)
                        </label>
                        <input
                            type="text"
                            required
                            value={currentCode}
                            onChange={handleCodeChange}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    {/* Live Auto-Generated Descriptive Title Preview */}
                    <div className="bg-primary/5 border border-primary/25 rounded-lg p-3 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <Sparkles size={13} className="text-primary" />
                                <span>Auto-Generated Descriptive Title (Live Preview)</span>
                            </label>
                            <span className="text-[10px] text-text-muted font-medium">Auto-composed from attributes</span>
                        </div>
                        <div className="text-xs font-semibold text-text-main font-mono bg-card-bg border border-border/80 rounded px-2.5 py-1.5 shadow-2xs break-words min-h-[32px] flex items-center">
                            {composedTitle ? (
                                <span className="text-primary font-bold">{composedTitle}</span>
                            ) : (
                                <span className="text-text-muted font-normal italic">
                                    Fill in classification fields or type a base label to preview descriptive title...
                                </span>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Raw Material Name / Base Label *
                            </label>
                            <span className="text-[10px] text-text-muted font-medium">Base tag, capacity or product line (e.g. 10Kg)</span>
                        </div>
                        <input
                            type="text"
                            required={!composedTitle}
                            placeholder="e.g. 10Kg, High Density Resin Grade, or product line name"
                            value={formData.baseName !== undefined ? formData.baseName : (formData.name || '')}
                            onChange={(e) => {
                                handleInputChange('baseName', e.target.value);
                                handleInputChange('name', e.target.value);
                            }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {/* Category Field Full Width */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Category *
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleOpenAddCategoryModal}
                                    className="text-xs text-primary hover:underline font-bold cursor-pointer"
                                >
                                    + Add New
                                </button>
                                {(typeof formData.category === 'object' ? formData.category?._id : formData.category) && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditCategoryModal(formData.category)}
                                            className="text-xs text-text-muted hover:text-primary flex items-center gap-1 font-medium cursor-pointer"
                                            title="Edit selected category"
                                        >
                                            <Pencil size={12} />
                                            <span>Edit</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCategoryInline(formData.category)}
                                            className="text-xs text-danger hover:underline flex items-center gap-1 font-medium cursor-pointer"
                                            title="Delete selected category"
                                        >
                                            <Trash2 size={12} />
                                            <span>Delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <select
                            name="category"
                            required
                            value={typeof formData.category === 'object' ? formData.category?._id : (formData.category || (categoriesList[0]?._id || ''))}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                        >
                            <option value="">-- Select Category --</option>
                            {categoriesList.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                    {cat.code ? `${cat.code} - ` : ''}{cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                    Unit of Measure (UOM) *
                                </label>
                                <button
                                    type="button"
                                    onClick={handleOpenAddUomModal}
                                    className="text-xs text-primary hover:underline font-bold cursor-pointer shrink-0 whitespace-nowrap pt-0.5"
                                >
                                    + Add New
                                </button>
                            </div>
                            <div className="mt-auto">
                                <select
                                    name="uom"
                                    required
                                    value={typeof formData.uom === 'object' ? formData.uom?._id : (formData.uom || (uomsList[0]?._id || ''))}
                                    onChange={(e) => handleInputChange('uom', e.target.value)}
                                    className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                                >
                                    <option value="">-- Select UOM --</option>
                                    {uomsList.map((u) => (
                                        <option key={u._id} value={u._id}>
                                            {u.abbreviation || u.symbol || u.code || 'UOM'} - {u.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                    Default Storage Location
                                </label>
                            </div>
                            <div className="mt-auto">
                                <select
                                    name="defaultLocation"
                                    value={typeof formData.defaultLocation === 'object' ? formData.defaultLocation?._id : (formData.defaultLocation || '')}
                                    onChange={(e) => handleInputChange('defaultLocation', e.target.value)}
                                    className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                                >
                                    <option value="">-- Select Location --</option>
                                    {locationsList.map((loc) => (
                                        <option key={loc._id} value={loc._id}>
                                            {loc.code || loc.type} - {loc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Client-specified PP Woven Fabric & Bag Material Parameters */}
                    <div className="space-y-3.5 pt-3.5 border-t border-border">
                        <div className="flex items-center justify-between pb-0.5">
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5">
                                <span>Material Classification & Quality Specs</span>
                            </h4>
                            <span className="text-[10px] text-text-muted font-medium">Master specifications</span>
                        </div>

                        {/* Material Description Full Width */}
                        <InlineLookupSelect
                            label="Material Description"
                            value={formData.materialDescription || ''}
                            onChange={(val) => handleInputChange('materialDescription', val)}
                            options={rmAttributes.materialDescription || []}
                            onOpenAdd={() => handleOpenAddAttributeModal('materialDescription', 'Material Description')}
                            onOpenEdit={(opt) => handleOpenEditAttributeModal('materialDescription', 'Material Description', opt)}
                            onDelete={(opt) => handleDeleteAttributeInline('materialDescription', 'Material Description', opt)}
                        />

                        {/* Material Quality-Fabric & Material Quality-Bags */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Material Quality-Fabric"
                                value={formData.materialQualityFabric || ''}
                                onChange={(val) => handleInputChange('materialQualityFabric', val)}
                                options={rmAttributes.materialQualityFabric || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialQualityFabric', 'Material Quality-Fabric')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('materialQualityFabric', 'Material Quality-Fabric', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('materialQualityFabric', 'Material Quality-Fabric', opt)}
                            />
                            <InlineLookupSelect
                                label="Material Quality-Bags"
                                value={formData.materialQualityBags || ''}
                                onChange={(val) => handleInputChange('materialQualityBags', val)}
                                options={rmAttributes.materialQualityBags || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialQualityBags', 'Material Quality-Bags')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('materialQualityBags', 'Material Quality-Bags', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('materialQualityBags', 'Material Quality-Bags', opt)}
                            />
                        </div>

                        {/* Lamination Type & Fabric Grammage */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Material Quality-Fabric (Lamination Type)"
                                value={formData.laminationType || ''}
                                onChange={(val) => handleInputChange('laminationType', val)}
                                options={rmAttributes.laminationType || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('laminationType', 'Material Quality-Fabric (Lamination Type)')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('laminationType', 'Material Quality-Fabric (Lamination Type)', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('laminationType', 'Material Quality-Fabric (Lamination Type)', opt)}
                            />
                            <InlineLookupSelect
                                label="Fabric Grammage (GSM)"
                                value={formData.fabricGrammage || ''}
                                onChange={(val) => handleInputChange('fabricGrammage', val)}
                                options={rmAttributes.fabricGrammage || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('fabricGrammage', 'Fabric Grammage')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('fabricGrammage', 'Fabric Grammage', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('fabricGrammage', 'Fabric Grammage', opt)}
                            />
                        </div>

                        {/* Material Colour & Thread Colour */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Material Colour"
                                value={formData.materialColour || ''}
                                onChange={(val) => handleInputChange('materialColour', val)}
                                options={rmAttributes.materialColour || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('materialColour', 'Material Colour')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('materialColour', 'Material Colour', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('materialColour', 'Material Colour', opt)}
                            />
                            <InlineLookupSelect
                                label="Thread Colour"
                                value={formData.threadColour || ''}
                                onChange={(val) => handleInputChange('threadColour', val)}
                                options={rmAttributes.threadColour || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('threadColour', 'Thread Colour')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('threadColour', 'Thread Colour', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('threadColour', 'Thread Colour', opt)}
                            />
                        </div>

                        {/* Quality-Thread-Yarn & Fabric Size (Fabric Width) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <InlineLookupSelect
                                label="Quality-Thread-Yarn"
                                value={formData.qualityThreadYarn || ''}
                                onChange={(val) => handleInputChange('qualityThreadYarn', val)}
                                options={rmAttributes.qualityThreadYarn || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('qualityThreadYarn', 'Quality-Thread-Yarn')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('qualityThreadYarn', 'Quality-Thread-Yarn', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('qualityThreadYarn', 'Quality-Thread-Yarn', opt)}
                            />
                            <InlineLookupSelect
                                label="Fabric Size (Fabric Width)"
                                value={formData.fabricSize || ''}
                                onChange={(val) => handleInputChange('fabricSize', val)}
                                options={rmAttributes.fabricSize || []}
                                onOpenAdd={() => handleOpenAddAttributeModal('fabricSize', 'Fabric Size (Fabric Width)')}
                                onOpenEdit={(opt) => handleOpenEditAttributeModal('fabricSize', 'Fabric Size (Fabric Width)', opt)}
                                onDelete={(opt) => handleDeleteAttributeInline('fabricSize', 'Fabric Size (Fabric Width)', opt)}
                            />
                        </div>

                        {/* Fabric Average */}
                        <div>
                            <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words mb-1">
                                Fabric Average
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 52.5 or standard run average"
                                value={formData.fabricAverage || ''}
                                onChange={(e) => handleInputChange('fabricAverage', e.target.value)}
                                className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    {/* Industrial Specification Fields */}
                    <div className="space-y-3.5 pt-3.5 border-t border-border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                        Grade / Specification
                                    </label>
                                </div>
                                <div className="mt-auto">
                                    <input
                                        type="text"
                                        placeholder="e.g. Virgin Raffia Grade 100"
                                        value={formData.materialGrade || ''}
                                        onChange={(e) => handleInputChange('materialGrade', e.target.value)}
                                        className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                        HSN Code (GST)
                                    </label>
                                </div>
                                <div className="mt-auto">
                                    <input
                                        type="text"
                                        placeholder="e.g. 39012000"
                                        value={formData.hsnCode || ''}
                                        onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                                        className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                        Min Order Qty (MOQ)
                                    </label>
                                </div>
                                <div className="mt-auto">
                                    <input
                                        type="number"
                                        placeholder="1000"
                                        value={formData.moq || ''}
                                        onChange={(e) => handleInputChange('moq', e.target.value)}
                                        className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                        Standard / Valuation Cost (₹)
                                    </label>
                                </div>
                                <div className="mt-auto">
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="120.00"
                                        value={formData.pricePerUnit || ''}
                                        onChange={(e) => handleInputChange('pricePerUnit', e.target.value)}
                                        className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono font-bold text-purple-900"
                                    />
                                    <p className="text-[9px] text-text-muted mt-0.5">Asset valuation</p>
                                </div>
                            </div>

                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                    <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                        Last GRN Purchase Price (₹)
                                    </label>
                                </div>
                                <div className="mt-auto">
                                    <input
                                        type="number"
                                        step="any"
                                        readOnly
                                        disabled
                                        value={formData.lastPurchasePrice || formData.pricePerUnit || 0}
                                        className="h-10 w-full border border-border rounded-md px-2.5 bg-app-bg text-xs font-bold text-primary cursor-not-allowed font-mono opacity-90"
                                    />
                                    <p className="text-[9px] text-text-muted mt-0.5">From last GRN invoice</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-muted leading-snug break-words hyphens-auto flex-1 min-w-0 flex items-center justify-between">
                                    <span>Current Stock</span>
                                    <span className="text-[9px] text-amber-700 font-semibold normal-case">Read-only</span>
                                </label>
                            </div>
                            <div className="mt-auto">
                                <input
                                    type="number"
                                    readOnly
                                    disabled
                                    value={formData.currentStock !== undefined ? formData.currentStock : 0}
                                    className="h-10 w-full border border-border rounded-md px-2.5 bg-app-bg text-xs font-bold text-text-muted cursor-not-allowed font-sans opacity-80"
                                    title="Stock levels cannot be edited manually. Use Goods Receipt (GRN) or Stock Adjustment in Inventory module."
                                />
                            </div>
                        </div>

                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between w-full mb-1 gap-1.5 min-w-0 min-h-[36px] sm:min-h-[40px]">
                                <label className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wide text-text-main leading-snug break-words hyphens-auto flex-1 min-w-0">
                                    Reorder Level
                                </label>
                            </div>
                            <div className="mt-auto">
                                <input
                                    type="number"
                                    placeholder="1000"
                                    value={formData.reorderLevel || ''}
                                    onChange={(e) => handleInputChange('reorderLevel', e.target.value)}
                                    className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>
                        </div>
                    </div>

                    {/* INK / MATERIAL COLORS (OPTIONAL) */}
                    <div className="space-y-3 pt-3.5 border-t border-border">
                        <div className="flex items-center justify-between pb-0.5">
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5">
                                <span>INK / MATERIAL COLORS (OPTIONAL)</span>
                            </h4>
                            <span className="text-[10px] text-text-muted font-medium">Color variants</span>
                        </div>

                        <div className="space-y-2">
                            {(formData.colors || []).map((colorItem, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g., Red, Milky White"
                                        value={colorItem}
                                        onChange={(e) => {
                                            const updatedColors = [...(formData.colors || [])];
                                            updatedColors[index] = e.target.value;
                                            handleInputChange('colors', updatedColors);
                                        }}
                                        className="h-10 flex-1 border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updatedColors = (formData.colors || []).filter((_, i) => i !== index);
                                            handleInputChange('colors', updatedColors);
                                        }}
                                        className="h-10 px-3 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-border rounded-md transition-colors cursor-pointer"
                                        title="Delete Color"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => {
                                    const currentColors = formData.colors || [];
                                    handleInputChange('colors', [...currentColors, '']);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary-hover border border-dashed border-primary/40 hover:border-primary rounded-md transition-colors cursor-pointer bg-primary/5"
                            >
                                <Plus size={14} />
                                <span>+ Add New Color</span>
                            </button>
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // FINISHED GOODS FORM
        if (key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts') {
            const composedFGTitle = composeFinishedBagTitle(formData, categoriesList, bagShapesList);
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Product Code (Auto-suggested)
                        </label>
                        <input
                            type="text"
                            required
                            value={currentCode}
                            onChange={handleCodeChange}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                        />
                    </div>

                    {/* Live Descriptive Title Preview */}
                    <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                            Auto-Generated Product Title Preview
                        </p>
                        <p className="text-sm font-bold text-text-main leading-snug break-words">
                            {composedFGTitle || <span className="text-text-muted font-normal italic">Fill in fields below to generate title…</span>}
                        </p>
                        <p className="text-[10px] text-text-muted mt-1">
                            This title is auto-composed from the classification fields and saved as the product name.
                        </p>
                    </div>

                    {/* Product Base Label (short internal name) */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Product Base Label
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Fertilizer Sack, Sugar Bag, FIBC"
                            value={formData.baseName || ''}
                            onChange={(e) => handleInputChange('baseName', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                        <p className="text-[10px] text-text-muted mt-1">Optional short label (appended to the auto-composed title).</p>
                    </div>


                    {/* Master Data Bag Category Dropdown */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Bag Type / Category *
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleOpenAddCategoryModal}
                                    className="text-xs text-primary hover:underline font-bold cursor-pointer"
                                >
                                    + Add New
                                </button>
                                {(typeof formData.category === 'object' ? formData.category?._id : formData.category) && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditCategoryModal(formData.category)}
                                            className="text-xs text-text-muted hover:text-primary flex items-center gap-1 font-medium cursor-pointer"
                                            title="Edit selected category"
                                        >
                                            <Pencil size={12} />
                                            <span>Edit</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteCategoryInline(formData.category)}
                                            className="text-xs text-danger hover:underline flex items-center gap-1 font-medium cursor-pointer"
                                            title="Delete selected category"
                                        >
                                            <Trash2 size={12} />
                                            <span>Delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <select
                            name="category"
                            required
                            value={typeof formData.category === 'object' ? formData.category?._id : (formData.category || (categoriesList[0]?._id || ''))}
                            onChange={(e) => handleInputChange('category', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                        >
                            <option value="">-- Select Bag Category --</option>
                            {categoriesList.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                    {cat.code ? `${cat.code} - ` : ''}{cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between w-full mb-1 gap-2 min-w-0">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main truncate whitespace-nowrap min-w-0">
                                    Unit of Measure (UOM) *
                                </label>
                                <button
                                    type="button"
                                    onClick={handleOpenAddUomModal}
                                    className="text-xs text-primary hover:underline font-bold cursor-pointer shrink-0 whitespace-nowrap"
                                >
                                    + Add New
                                </button>
                            </div>
                            <select
                                name="uom"
                                required
                                value={typeof formData.uom === 'object' ? formData.uom?._id : (formData.uom || (uomsList[0]?._id || ''))}
                                onChange={(e) => handleInputChange('uom', e.target.value)}
                                className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select UOM --</option>
                                {uomsList.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.abbreviation || u.symbol || u.code || 'UOM'} - {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between w-full mb-1 gap-2 min-w-0">
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main truncate whitespace-nowrap min-w-0">
                                    Bag Shape
                                </label>
                                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={handleOpenAddBagShapeModal}
                                        className="text-xs text-primary hover:underline font-bold cursor-pointer shrink-0"
                                    >
                                        + Add New
                                    </button>
                                    {formData.bagShape && formData.bagShape !== 'Other' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditBagShapeModal(formData.bagShape)}
                                                className="text-xs text-text-muted hover:text-primary flex items-center gap-1 font-medium cursor-pointer shrink-0"
                                                title="Edit selected bag shape"
                                            >
                                                <Pencil size={12} />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBagShapeInline(formData.bagShape)}
                                                className="text-xs text-danger hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0"
                                                title="Delete selected bag shape"
                                            >
                                                <Trash2 size={12} />
                                                <span>Delete</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <select
                                name="bagShape"
                                value={formData.bagShape || ''}
                                onChange={(e) => handleInputChange('bagShape', e.target.value)}
                                className="h-10 w-full border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select Shape --</option>
                                {bagShapesList.map((bs) => (
                                    <option key={bs._id} value={bs.name}>
                                        {bs.name}
                                    </option>
                                ))}
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Dimensions
                            </label>
                            {/* Shared Unit Selector Toggle (cm / inch) */}
                            <div className="flex items-center gap-1 bg-app-bg border border-border rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleNestedChange('dimensions', 'unit', 'cm');
                                        handleInputChange('dimensionUnit', 'cm');
                                    }}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${(formData.dimensions?.unit || formData.dimensionUnit || 'cm') === 'cm'
                                        ? 'bg-primary text-white shadow-2xs'
                                        : 'text-text-muted hover:text-text-main'
                                        }`}
                                >
                                    cm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleNestedChange('dimensions', 'unit', 'inch');
                                        handleInputChange('dimensionUnit', 'inch');
                                    }}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${(formData.dimensions?.unit || formData.dimensionUnit || 'cm') === 'inch'
                                        ? 'bg-primary text-white shadow-2xs'
                                        : 'text-text-muted hover:text-text-main'
                                        }`}
                                >
                                    inch
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Width ({(formData.dimensions?.unit || formData.dimensionUnit || 'cm')})
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder={(formData.dimensions?.unit || formData.dimensionUnit || 'cm') === 'inch' ? '18' : '45'}
                                    value={formData.dimensions?.width !== undefined && formData.dimensions?.width !== null ? formData.dimensions.width : ''}
                                    onChange={(e) => handleNestedChange('dimensions', 'width', e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-[10.5px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Length ({(formData.dimensions?.unit || formData.dimensionUnit || 'cm')})
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder={(formData.dimensions?.unit || formData.dimensionUnit || 'cm') === 'inch' ? '30' : '75'}
                                    value={formData.dimensions?.length !== undefined && formData.dimensions?.length !== null ? formData.dimensions.length : ''}
                                    onChange={(e) => handleNestedChange('dimensions', 'length', e.target.value)}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Capacity (Kg)
                            </label>
                            <input
                                type="number"
                                placeholder="50"
                                value={formData.bagCapacity || formData.capacity || ''}
                                onChange={(e) => handleInputChange('bagCapacity', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Fabric GSM
                            </label>
                            <input
                                type="number"
                                placeholder="75"
                                value={formData.fabricGSM || formData.gsm || ''}
                                onChange={(e) => handleInputChange('fabricGSM', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Product Description / Notes
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Heavy-duty Laminated PP Woven Sack with liner"
                            value={formData.bagType || ''}
                            onChange={(e) => handleInputChange('bagType', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {/* Color & Print Specification (Front/Back) */}
                    <div className="p-3.5 bg-app-bg border border-border rounded-xl space-y-3 font-sans">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                Color & Print Specification
                            </label>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                                {formData.colorAndPrint || 'Plain / Unprinted'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Base Fabric Colour
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Milky White, Yellow, Natural"
                                    value={formData.materialColour || ''}
                                    onChange={(e) => {
                                        const newBase = e.target.value;
                                        handleInputChange('materialColour', newBase);
                                        const sides = formData.printSides || 'NONE';
                                        const f = formData.frontColours || 0;
                                        const b = formData.backColours || 0;
                                        const specStr = formatPrintSpecString(sides, f, b);
                                        handleInputChange('colorAndPrint', newBase ? `${newBase} (${specStr})` : specStr);
                                    }}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                    Print Sides *
                                </label>
                                <select
                                    value={formData.printSides || 'NONE'}
                                    onChange={(e) => {
                                        const sides = e.target.value;
                                        handleInputChange('printSides', sides);
                                        const f = (sides === 'FRONT_ONLY' || sides === 'BOTH') ? (formData.frontColours || 1) : 0;
                                        const b = (sides === 'BACK_ONLY' || sides === 'BOTH') ? (formData.backColours || 1) : 0;
                                        handleInputChange('frontColours', f);
                                        handleInputChange('backColours', b);
                                        handleInputChange('printSpec', { printSides: sides, frontColours: f, backColours: b });
                                        const base = formData.materialColour || 'Milky White';
                                        const specStr = formatPrintSpecString(sides, f, b);
                                        handleInputChange('colorAndPrint', base ? `${base} (${specStr})` : specStr);
                                    }}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer font-semibold"
                                >
                                    <option value="NONE">None (Plain / Unprinted)</option>
                                    <option value="FRONT_ONLY">Front Only</option>
                                    <option value="BACK_ONLY">Back Only</option>
                                    <option value="BOTH">Both Sides (Front & Back)</option>
                                </select>
                            </div>
                        </div>

                        {/* Conditional Colour Inputs per side */}
                        {(formData.printSides === 'FRONT_ONLY' || formData.printSides === 'BACK_ONLY' || formData.printSides === 'BOTH') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {(formData.printSides === 'FRONT_ONLY' || formData.printSides === 'BOTH') && (
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                            Front Colours (Qty)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="8"
                                            placeholder="1"
                                            value={formData.frontColours || ''}
                                            onChange={(e) => {
                                                const f = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                handleInputChange('frontColours', f);
                                                const b = formData.backColours || 0;
                                                const sides = formData.printSides;
                                                handleInputChange('printSpec', { printSides: sides, frontColours: f, backColours: b });
                                                const base = formData.materialColour || 'Milky White';
                                                const specStr = formatPrintSpecString(sides, f, b);
                                                handleInputChange('colorAndPrint', base ? `${base} (${specStr})` : specStr);
                                            }}
                                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono font-bold"
                                        />
                                    </div>
                                )}

                                {(formData.printSides === 'BACK_ONLY' || formData.printSides === 'BOTH') && (
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">
                                            Back Colours (Qty)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="8"
                                            placeholder="1"
                                            value={formData.backColours || ''}
                                            onChange={(e) => {
                                                const b = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                handleInputChange('backColours', b);
                                                const f = formData.frontColours || 0;
                                                const sides = formData.printSides;
                                                handleInputChange('printSpec', { printSides: sides, frontColours: f, backColours: b });
                                                const base = formData.materialColour || 'Milky White';
                                                const specStr = formatPrintSpecString(sides, f, b);
                                                handleInputChange('colorAndPrint', base ? `${base} (${specStr})` : specStr);
                                            }}
                                            className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono font-bold"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Storage Bay / Location
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Finished Goods Warehouse - Bay 1"
                            value={formData.storageBayLocation || ''}
                            onChange={(e) => {
                                handleInputChange('storageBayLocation', e.target.value);
                                handleInputChange('warehouseLocation', e.target.value);
                            }}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Retail Price / Bag (₹)
                            </label>
                            <input
                                type="number"
                                step="any"
                                placeholder="22.00"
                                value={formData.retailPrice || formData.pricePerBag || ''}
                                onChange={(e) => {
                                    handleInputChange('retailPrice', e.target.value);
                                    handleInputChange('pricePerBag', e.target.value);
                                }}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Wholesale Price / Bag (₹)
                            </label>
                            <input
                                type="number"
                                step="any"
                                placeholder="18.50"
                                value={formData.wholesalePrice || ''}
                                onChange={(e) => handleInputChange('wholesalePrice', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono font-bold text-primary"
                            />
                        </div>
                    </div>

                    {/* Raw Materials Required (per unit/bag) */}
                    <div className="pt-3 border-t border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main">
                                    Raw Materials Required (per bag) *
                                </label>
                                <p className="text-[11px] text-text-muted mt-0.5">
                                    Define the raw material ingredients and quantities needed to produce 1 bag.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBomIngredients((prev) => [...prev, { rawMaterial: '', quantityPerUnit: '' }])}
                                className="text-xs bg-primary/10 text-primary hover:bg-primary/20 font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition-all cursor-pointer shrink-0"
                            >
                                <Plus size={13} />
                                <span>+ Add Material</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            {bomIngredients.map((item, idx) => {
                                const selectedRmId = typeof item.rawMaterial === 'object' ? item.rawMaterial?._id : item.rawMaterial;
                                const selectedRm = (rawMaterialsList || []).find((rm) => rm._id === selectedRmId);
                                const uomLabel = typeof selectedRm?.uom === 'object' ? (selectedRm.uom?.symbol || selectedRm.uom?.name) : (selectedRm?.uom || 'Kg');

                                return (
                                    <div key={idx} className="flex items-center gap-2 bg-app-bg p-2 rounded-lg border border-border">
                                        <div className="flex-1 min-w-0">
                                            <select
                                                required
                                                value={selectedRmId || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setBomIngredients((prev) =>
                                                        prev.map((ing, i) => (i === idx ? { ...ing, rawMaterial: val } : ing))
                                                    );
                                                }}
                                                className="h-9 w-full border border-border rounded-md px-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer truncate"
                                            >
                                                <option value="">-- Select Raw Material --</option>
                                                {(rawMaterialsList || []).map((rm) => (
                                                    <option key={rm._id} value={rm._id}>
                                                        {rm.code || 'RM'} - {rm.name} (Stock: {rm.currentStock || 0} {typeof rm.uom === 'object' ? rm.uom?.symbol : (rm.uom || 'kg')})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="w-28 relative">
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.0001"
                                                required
                                                placeholder="Qty/bag"
                                                value={item.quantityPerUnit || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setBomIngredients((prev) =>
                                                        prev.map((ing, i) => (i === idx ? { ...ing, quantityPerUnit: val } : ing))
                                                    );
                                                }}
                                                className="h-9 w-full border border-border rounded-md pl-2 pr-7 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-bold"
                                            />
                                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-text-muted uppercase pointer-events-none">
                                                {uomLabel}
                                            </span>
                                        </div>

                                        {bomIngredients.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setBomIngredients((prev) => prev.filter((_, i) => i !== idx))}
                                                className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-all cursor-pointer shrink-0"
                                                title="Remove Material"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* INKS USED (OPTIONAL) */}
                    <div className="space-y-3 pt-3.5 border-t border-border">
                        <div className="flex items-center justify-between pb-0.5">
                            <h4 className="text-[11px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5">
                                <span>INKS USED (OPTIONAL)</span>
                            </h4>
                            <span className="text-[10px] text-text-muted font-medium">Ink variants</span>
                        </div>

                        <div className="space-y-2">
                            {(inks || []).map((inkItem, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g., Red Ink"
                                        value={inkItem}
                                        onChange={(e) => {
                                            const updatedInks = [...(inks || [])];
                                            updatedInks[index] = e.target.value;
                                            setInks(updatedInks);
                                        }}
                                        className="h-10 flex-1 border border-border rounded-md px-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updatedInks = (inks || []).filter((_, i) => i !== index);
                                            setInks(updatedInks);
                                        }}
                                        className="h-10 px-3 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-border rounded-md transition-colors cursor-pointer"
                                        title="Delete Ink"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => setInks([...(inks || []), ''])}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:text-primary-hover border border-dashed border-primary/40 hover:border-primary rounded-md transition-colors cursor-pointer bg-primary/5"
                            >
                                <Plus size={14} />
                                <span>+ Add Ink</span>
                            </button>
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // BILL OF MATERIALS (BOM) FORM
        if (key === 'boms' || key === 'bom' || key === 'billofmaterials' || key === 'bill-of-materials') {
            return (
                <div className="space-y-4 font-sans text-xs">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            BOM / Recipe Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Recipe for 50kg Laminated PP Woven Sack"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Target Finished Good *
                        </label>
                        <select
                            required
                            value={typeof formData.finishedGood === 'object' ? formData.finishedGood?._id : (formData.finishedGood || (finishedGoodsList[0]?._id || ''))}
                            onChange={(e) => handleInputChange('finishedGood', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                        >
                            <option value="">-- Select Finished Good Spec --</option>
                            {finishedGoodsList.map((fg) => (
                                <option key={fg._id} value={fg._id}>
                                    {fg.code || 'FG'} - {fg.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* DYNAMIC INGREDIENTS / RAW MATERIALS SECTION */}
                    <div className="space-y-3 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-extrabold uppercase tracking-wider text-text-main">
                                Ingredients / Raw Materials *
                            </label>
                            <button
                                type="button"
                                onClick={() => setBomIngredients((prev) => [...prev, { rawMaterial: '', quantityPerUnit: '' }])}
                                className="text-xs text-primary hover:underline font-bold cursor-pointer flex items-center gap-1"
                            >
                                <Plus size={13} />
                                <span>Add Ingredient</span>
                            </button>
                        </div>

                        {bomIngredients.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-app-bg p-2.5 rounded-lg border border-border">
                                <div className="flex-1">
                                    <select
                                        required
                                        value={typeof item.rawMaterial === 'object' ? item.rawMaterial?._id : item.rawMaterial}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBomIngredients((prev) =>
                                                prev.map((ing, i) => (i === idx ? { ...ing, rawMaterial: val } : ing))
                                            );
                                        }}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer"
                                    >
                                        <option value="">-- Select Raw Material --</option>
                                        {(rawMaterialsList || []).map((rm) => (
                                            <option key={rm._id} value={rm._id}>
                                                {rm.code || 'RM'} - {rm.name || rm.materialName || 'Raw Material'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-28">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.0001"
                                        required
                                        placeholder="Qty/Unit"
                                        value={item.quantityPerUnit !== undefined ? item.quantityPerUnit : (item.quantity || '')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBomIngredients((prev) =>
                                                prev.map((ing, i) => (i === idx ? { ...ing, quantityPerUnit: val } : ing))
                                            );
                                        }}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold"
                                    />
                                </div>

                                {bomIngredients.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setBomIngredients((prev) => prev.filter((_, i) => i !== idx))}
                                        className="p-1.5 text-text-muted hover:text-rose-500 rounded transition-colors cursor-pointer"
                                        title="Remove Ingredient"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // Generic stub
        return (
            <div className="space-y-4 font-sans text-xs">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        Code / Identifier (Auto-suggested)
                    </label>
                    <input
                        type="text"
                        required
                        value={currentCode}
                        onChange={handleCodeChange}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono font-semibold uppercase tracking-wider"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                        {activeTabLabel} Name / Title *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder={`Enter ${activeTabLabel} name`}
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                    />
                </div>

                {renderIsActiveToggle()}
            </div>
        );
    };

    return (
        <div className="space-y-4 sm:space-y-5 font-sans w-full max-w-full">
            {/* Top Main Page Header with Dynamic Add Record Button */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 w-full">
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl font-bold text-text-main tracking-tight break-words">{title}</h1>
                    {description && <p className="text-xs text-text-muted mt-0.5 leading-relaxed break-words">{description}</p>}
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto shrink-0">
                    {/* Optional Custom Header Action Buttons */}
                    {typeof headerActions === 'function' ? headerActions(handleOpenDrawer) : headerActions}

                    {/* Top-Right Dynamic "Add New Record" Button (rendered only if custom headerActions is not supplied) */}
                    {!headerActions && (
                        <button
                            type="button"
                            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                            onClick={handleOpenDrawer}
                        >
                            <Plus size={15} />
                            <span>Add New {activeTabLabel} Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Bar */}
            {showTabBar && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-border pb-2.5 w-full max-w-full">
                    <div className="w-full sm:w-auto max-w-full overflow-x-auto pb-1 -mb-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                            {tabs.map((tab) => {
                                const isActive = tab.key === activeTabKey;
                                const isPlaceholderTab = tab.isPlaceholder || (!tab.resourcePath && !tab.customRender);
                                const count = isPlaceholderTab ? '—' : tabCounts[tab.key];
                                const TabIcon = tab.icon;

                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            handleTabChange(tab.key);
                                            setSearch('');
                                            setPage(1);
                                        }}
                                        className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${isActive
                                            ? 'bg-primary text-sidebar-bg font-medium px-3.5 sm:px-4 py-1.5 rounded-lg shadow-xs'
                                            : 'text-text-muted hover:text-text-main px-2.5 sm:px-3 py-1.5 rounded-lg border border-transparent hover:bg-app-bg'
                                            }`}
                                    >
                                        {TabIcon && <TabIcon size={14} className="shrink-0" />}
                                        <span className="truncate">{tab.label}</span>
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${isActive
                                                ? 'bg-sidebar-bg/20 text-sidebar-bg'
                                                : 'bg-status-neutral-bg text-status-neutral-text'
                                                }`}
                                        >
                                            {count !== undefined ? count : '...'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {tabBarActions && (
                        <div className="w-full sm:w-auto flex items-center justify-start sm:justify-end shrink-0 pt-1 sm:pt-0">
                            {tabBarActions}
                        </div>
                    )}
                </div>
            )}

            {/* Content Area */}
            {isTabPlaceholder ? (
                <div className="flex flex-col items-center justify-center p-14 bg-card-bg border border-border rounded-xl text-center shadow-2xs">
                    <Construction className="text-primary mb-3" size={38} />
                    <h3 className="text-base font-bold text-text-main mb-1">
                        {activeTab?.placeholderTitle || `${activeTab?.label} Module`}
                    </h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        {activeTab?.placeholderMessage || 'Coming Soon — Attendance & HR module component.'}
                    </p>
                </div>
            ) : activeTab?.customRender ? (
                typeof activeTab.customRender === 'function' ? activeTab.customRender(data, handleEditRow) : activeTab.customRender
            ) : (
                <>
                    {/* Show Inactive toggle — only visible on Customers tab */}
                    {isCustomersTab && (
                        <div className="flex items-center gap-2 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-text-muted hover:text-text-main transition-colors">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={showInactive}
                                        onChange={(e) => {
                                            setShowInactive(e.target.checked);
                                            setPage(1);
                                        }}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-checked:bg-rose-500 rounded-full transition-colors duration-200" />
                                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-4" />
                                </div>
                                <span>Show Inactive Customers</span>
                                {showInactive && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                        Showing All
                                    </span>
                                )}
                            </label>
                        </div>
                    )}
                    <DataTable
                        columns={activeTab?.columns || []}
                        data={data}
                        isLoading={isLoading}
                        emptyMessage={`No ${activeTab?.label || 'records'} found`}
                        search={search}
                        onSearchChange={setSearch}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        availableStatuses={activeTab?.availableStatuses || (() => {
                            const k = (activeTabKey || '').toLowerCase();
                            if (k === 'dispatches' || k === 'dispatch') return ['IN_TRANSIT', 'DELIVERED'];
                            if (k === 'sales-orders' || k === 'salesorders') return ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'CANCELLED'];
                            if (k === 'invoices' || k === 'invoice') return ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
                            if (k === 'purchase-orders' || k === 'purchaseorders') return ['DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED'];
                            if (k === 'customers' || k === 'customer') return ['Active', 'Inactive', 'Lead'];
                            if (k === 'machines' || k === 'machine') return ['Available', 'In Use', 'Under Maintenance', 'Out of Service'];
                            if (k === 'work-orders' || k === 'workorders' || k === 'stage-monitor') return ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
                            return ['Active', 'Inactive'];
                        })()}
                        pagination={pagination}
                        onPageChange={setPage}
                        activeTabLabel={activeTab?.label}
                        onView={handleViewRow}
                        isViewable={activeTab?.isViewable !== false}
                        onEdit={handleEditRow}
                        onDelete={handleDeleteRow}
                        onBulkDelete={bulkDeleteItems}
                        isEditable={isCurrentTabEditable}
                        isDeletable={(() => {
                            const k = (activeTabKey || '').toLowerCase();
                            const p = (activeTab?.resourcePath || '').toLowerCase();
                            if (activeTab?.isDeletable === false) return false;
                            if (k.includes('invoice') || p.includes('invoice')) return false;
                            if (k.includes('grn') || p.includes('grn')) return false;
                            if (k.includes('material-receipt') || p.includes('material-receipt')) return false;
                            if (k.includes('stock-transaction') || p.includes('stock-transaction') || k.includes('valuation') || k.includes('audit-ledger')) return false;
                            if (k.includes('qc-inspection') || p.includes('qc-inspection')) return false;
                            if (k.includes('dispatch') || p.includes('dispatch')) return false;
                            return true;
                        })()}
                        onExportCsv={handleExportCsv}
                    />
                </>
            )}


            {/* SLIDE-OUT DRAWER SHELL (UI) */}
            {isDrawerOpen && (
                <>
                    {/* Semi-transparent Backdrop Overlay */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                        onClick={() => setIsDrawerOpen(false)}
                    />

                    {/* Slide-out Drawer Panel (Spacious 680-700px on desktop, responsive 100% full-width on mobile) */}
                    <div className="fixed top-0 right-0 h-full w-full sm:w-[650px] md:w-[680px] lg:w-[700px] max-w-full bg-card-bg shadow-2xl z-50 flex flex-col border-l border-border font-sans transform transition-all duration-200 animate-in slide-in-from-right duration-200">
                        {/* Drawer Header */}
                        <div className="bg-sidebar-bg text-sidebar-text-active p-5 flex justify-between items-center border-b border-sidebar-hover shrink-0">
                            <div>
                                <h2 className="text-base font-extrabold tracking-tight">
                                    {editingItem ? `Edit ${activeTabLabel} Record` : `Add New ${activeTabLabel} Record`}
                                </h2>
                                <p className="text-xs text-sidebar-text mt-0.5">
                                    Industrial ERP Master Data Entry
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDrawerOpen(false)}
                                className="p-1.5 text-sidebar-text hover:text-sidebar-text-active rounded-lg hover:bg-sidebar-hover transition-all cursor-pointer"
                                title="Close Drawer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Drawer Body (Scrollable Form Container) */}
                        <form onSubmit={handleSaveRecord} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {renderDrawerForm()}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 border-t border-border bg-card-bg flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="bg-card-bg border border-border hover:bg-app-bg text-text-main font-semibold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-primary hover:bg-primary-hover text-sidebar-bg font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isLoading ? 'Saving...' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* INLINE SHIFT CREATION MODAL (Convenience inside Employee Form) */}
            {isInlineShiftModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setIsInlineShiftModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-xl shadow-2xl p-6 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center pb-3 mb-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Clock className="text-primary" size={20} />
                                <h3 className="text-sm font-extrabold text-text-main">Create New Work Shift</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsInlineShiftModalOpen(false)}
                                className="text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveInlineShift} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Shift Code *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. SHIFT_A"
                                    value={inlineShiftData.shiftCode}
                                    onChange={(e) => setInlineShiftData({ ...inlineShiftData, shiftCode: e.target.value.toUpperCase() })}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main font-mono font-semibold uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Shift Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Shift A (Morning)"
                                    value={inlineShiftData.name}
                                    onChange={(e) => setInlineShiftData({ ...inlineShiftData, name: e.target.value })}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Start Time *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={inlineShiftData.startTime}
                                        onChange={(e) => setInlineShiftData({ ...inlineShiftData, startTime: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        End Time *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={inlineShiftData.endTime}
                                        onChange={(e) => setInlineShiftData({ ...inlineShiftData, endTime: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Standard Hours
                                    </label>
                                    <input
                                        type="number"
                                        value={inlineShiftData.standardHours}
                                        onChange={(e) => setInlineShiftData({ ...inlineShiftData, standardHours: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Grace Period (Mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={inlineShiftData.gracePeriodMinutes}
                                        onChange={(e) => setInlineShiftData({ ...inlineShiftData, gracePeriodMinutes: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsInlineShiftModalOpen(false)}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingInlineShift}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-md text-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingInlineShift ? 'Creating...' : 'Create & Select Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inline Location Modal inside Employee Form */}
            {isInlineLocationModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setIsInlineLocationModalOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-md bg-card-bg border border-border rounded-xl p-6 shadow-2xl space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="text-primary" size={20} />
                                <h3 className="text-sm font-extrabold text-text-main">Create New Facility / Location</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsInlineLocationModalOpen(false)}
                                className="text-text-muted hover:text-text-main cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveInlineLocation} className="space-y-3.5 text-xs font-sans">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Location Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. LOC-001"
                                        value={inlineLocationData.code}
                                        onChange={(e) => setInlineLocationData({ ...inlineLocationData, code: e.target.value.toUpperCase() })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main font-mono font-semibold uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        Location Type *
                                    </label>
                                    <select
                                        value={inlineLocationData.type}
                                        onChange={(e) => setInlineLocationData({ ...inlineLocationData, type: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main cursor-pointer"
                                    >
                                        <option value="FACTORY">Factory</option>
                                        <option value="WAREHOUSE">Warehouse</option>
                                        <option value="GODOWN">Godown</option>
                                        <option value="DISPATCH_ZONE">Dispatch Zone</option>
                                        <option value="PRODUCTION_FLOOR">Production Floor</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Facility Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Vapi Unit #1 (GIDC Phase 3)"
                                    value={inlineLocationData.name}
                                    onChange={(e) => setInlineLocationData({ ...inlineLocationData, name: e.target.value })}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                    Address / Details
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Plot 42, GIDC Industrial Estate"
                                    value={inlineLocationData.address}
                                    onChange={(e) => setInlineLocationData({ ...inlineLocationData, address: e.target.value })}
                                    className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ahmedabad"
                                        value={inlineLocationData.city}
                                        onChange={(e) => setInlineLocationData({ ...inlineLocationData, city: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                        State
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Gujarat"
                                        value={inlineLocationData.state}
                                        onChange={(e) => setInlineLocationData({ ...inlineLocationData, state: e.target.value })}
                                        className="w-full border border-border rounded-md p-2 bg-card-bg text-text-main"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsInlineLocationModalOpen(false)}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingInlineLocation}
                                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-md text-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingInlineLocation ? 'Creating...' : 'Create & Select Facility'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Category Modal */}
            {categoryModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setCategoryModal({ isOpen: false, mode: 'ADD', categoryId: null, inputValue: '', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {categoryModal.mode === 'ADD' ? 'Add New Category' : 'Edit Category'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setCategoryModal({ isOpen: false, mode: 'ADD', categoryId: null, inputValue: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategoryModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Category Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. PP Resin Granules"
                                    value={categoryModal.inputValue}
                                    onChange={(e) => setCategoryModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setCategoryModal({ isOpen: false, mode: 'ADD', categoryId: null, inputValue: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={categoryModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {categoryModal.isSaving ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Bag Shape Modal */}
            {bagShapeModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setBagShapeModal({ isOpen: false, mode: 'ADD', shapeId: null, inputValue: '', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {bagShapeModal.mode === 'ADD' ? 'Add New Bag Shape' : 'Edit Bag Shape'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setBagShapeModal({ isOpen: false, mode: 'ADD', shapeId: null, inputValue: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBagShapeModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Bag Shape Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Gusseted, Valve, Block Bottom"
                                    value={bagShapeModal.inputValue}
                                    onChange={(e) => setBagShapeModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setBagShapeModal({ isOpen: false, mode: 'ADD', shapeId: null, inputValue: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={bagShapeModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {bagShapeModal.isSaving ? 'Saving...' : 'Save Bag Shape'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Production Section Modal */}
            {sectionModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setSectionModal({ isOpen: false, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {sectionModal.mode === 'ADD' ? 'Add New Section' : 'Edit Section'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSectionModal({ isOpen: false, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSectionModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Section Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Extrusion, Weaving, Lamination"
                                    value={sectionModal.inputValue}
                                    onChange={(e) => setSectionModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setSectionModal({ isOpen: false, mode: 'ADD', sectionId: null, inputValue: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sectionModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {sectionModal.isSaving ? 'Saving...' : 'Save Section'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Plant Location Modal */}
            {plantLocationModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setPlantLocationModal({ isOpen: false, mode: 'ADD', locationId: null, name: '', code: '', type: 'FACTORY', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {plantLocationModal.mode === 'ADD' ? 'Add New Plant Location' : 'Edit Plant Location'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPlantLocationModal({ isOpen: false, mode: 'ADD', locationId: null, name: '', code: '', type: 'FACTORY', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePlantLocationModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Plant / Facility Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Vapi Unit #1, Surat Extrusion Plant #2"
                                    value={plantLocationModal.name}
                                    onChange={(e) => setPlantLocationModal((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                        Facility Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. PLANT-001"
                                        value={plantLocationModal.code}
                                        onChange={(e) => setPlantLocationModal((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                        Facility Type
                                    </label>
                                    <select
                                        value={plantLocationModal.type}
                                        onChange={(e) => setPlantLocationModal((prev) => ({ ...prev, type: e.target.value }))}
                                        className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary cursor-pointer"
                                    >
                                        <option value="FACTORY">Factory / Plant</option>
                                        <option value="PRODUCTION_FLOOR">Production Floor</option>
                                        <option value="WAREHOUSE">Warehouse</option>
                                        <option value="GODOWN">Godown</option>
                                        <option value="DISPATCH_ZONE">Dispatch Zone</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setPlantLocationModal({ isOpen: false, mode: 'ADD', locationId: null, name: '', code: '', type: 'FACTORY', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={plantLocationModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {plantLocationModal.isSaving ? 'Saving...' : 'Save Location'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Generic Raw Material Attribute Modal */}
            {attributeModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', itemId: null, inputValue: '', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                {attributeModal.mode === 'ADD' ? `Add New ${attributeModal.attributeLabel}` : `Edit ${attributeModal.attributeLabel}`}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', itemId: null, inputValue: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAttributeModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    {attributeModal.attributeLabel} Option Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder={`e.g. Enter new option`}
                                    value={attributeModal.inputValue}
                                    onChange={(e) => setAttributeModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setAttributeModal({ isOpen: false, mode: 'ADD', attributeType: '', attributeLabel: '', itemId: null, inputValue: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={attributeModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {attributeModal.isSaving ? 'Saving...' : 'Save Option'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom UOM Modal */}
            {uomModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={() => setUomModal({ isOpen: false, name: '', abbreviation: '', isSaving: false })}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-full max-w-md p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">
                                Add New Unit of Measure (UOM)
                            </h3>
                            <button
                                type="button"
                                onClick={() => setUomModal({ isOpen: false, name: '', abbreviation: '', isSaving: false })}
                                className="text-text-muted hover:text-text-main p-1 rounded-md transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUomModal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Unit Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Kilogram, Metric Ton, Box"
                                    value={uomModal.name}
                                    onChange={(e) => setUomModal((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1.5">
                                    Abbreviation / Symbol *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. kg, MT, box"
                                    value={uomModal.abbreviation}
                                    onChange={(e) => setUomModal((prev) => ({ ...prev, abbreviation: e.target.value }))}
                                    className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans font-mono"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setUomModal({ isOpen: false, name: '', abbreviation: '', isSaving: false })}
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uomModal.isSaving}
                                    className="px-4 py-2 bg-primary text-white font-semibold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {uomModal.isSaving ? 'Saving UOM...' : 'Save UOM'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div
                        className="fixed inset-0"
                        onClick={closeConfirmModal}
                    />
                    <div className="relative z-10 bg-card-bg rounded-xl shadow-2xl w-[400px] p-6 border border-border space-y-4 font-sans animate-in zoom-in-95 duration-150">
                        <h3 className="text-lg font-bold text-text-main">{confirmModal.title}</h3>
                        <p className="text-sm text-text-muted mt-2">{confirmModal.message}</p>
                        <div className="mt-6 flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={closeConfirmModal}
                                className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (confirmModal.onConfirm) {
                                        await confirmModal.onConfirm();
                                    }
                                    closeConfirmModal();
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reusable Master Data Read-Only Detail View Modal (Eye icon) */}
            <DetailViewModal
                isOpen={detailModal.isOpen}
                onClose={() => setDetailModal({ isOpen: false, record: null, tabKey: '' })}
                record={detailModal.record}
                tabKey={detailModal.tabKey}
                tabLabel={activeTabLabel}
                onEdit={isCurrentTabEditable ? (rec) => handleEditRow(rec) : null}
            />
        </div>
    );
}
