import { useState, useEffect } from 'react';
import { useResourceApi } from '../../hooks/useResourceApi';
import DataTable from './DataTable';
import { Construction, Plus, X, Clock, Sparkles, Pencil, Trash2 } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

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

export default function TabbedResourcePage({ title, description, tabs = [], onAddClick = null, headerActions = null }) {
    const [activeTabKey, setActiveTabKey] = useState(tabs[0]?.key || '');
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

    // Form state values
    const [formData, setFormData] = useState({});

    // Dropdown list states for employees, raw materials, and finished goods
    const [shiftsList, setShiftsList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [categoriesList, setCategoriesList] = useState([]);
    const [uomsList, setUomsList] = useState([]);

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

    const activeTab = tabs.find((t) => t.key === activeTabKey) || tabs[0];
    const activeTabLabel = activeTab?.label || 'Record';

    const isTabPlaceholder = activeTab?.isPlaceholder || !activeTab?.resourcePath;

    const {
        data,
        pagination,
        isLoading,
        search,
        setSearch,
        page,
        setPage,
        createItem,
        updateItem,
        deleteItem
    } = useResourceApi(isTabPlaceholder ? null : activeTab?.resourcePath);

    // Keep tab count badge updated when pagination total changes for active tab
    useEffect(() => {
        if (activeTab && !isTabPlaceholder && pagination?.total !== undefined) {
            setTabCounts((prev) => ({
                ...prev,
                [activeTab.key]: pagination.total
            }));
        }
    }, [activeTab, isTabPlaceholder, pagination?.total]);

    // Fetch shift, location, category, and UOM options when active tab or drawer opens
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
        }
    };

    useEffect(() => {
        if (isDrawerOpen) {
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
            const response = await axiosInstance.get(`${activeTab.resourcePath}/export`, {
                params: { search },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${activeTabKey}_export_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('CSV export downloaded successfully!', { id: 'csv-export' });
        } catch (err) {
            console.error('Export CSV error:', err);
            toast.error('Failed to export CSV file', { id: 'csv-export' });
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
            payload.department = formData.department || 'PRODUCTION';
            payload.shiftAssignment = formData.shiftAssignment || (shiftsList[0]?._id || '');
            payload.facility = formData.facility || (locationsList[0]?._id || '');
            payload.monthlySalary = formData.monthlySalary !== undefined && formData.monthlySalary !== '' ? Number(formData.monthlySalary) : 0;
        }

        const key = activeTabKey?.toLowerCase() || '';
        if (key === 'raw-materials' || key === 'rawmaterials' || key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts') {
            const catVal = typeof formData.category === 'object' ? formData.category?._id : formData.category;
            const uomVal = typeof formData.uom === 'object' ? formData.uom?._id : formData.uom;
            payload.category = catVal || (categoriesList[0]?._id || '');
            payload.uom = uomVal || (uomsList[0]?._id || '');
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
     * Open Create Drawer and Pre-fill Suggested Code for ALL Entities
     */
    const handleOpenDrawer = () => {
        setEditingItem(null);

        const suggestedCode = generateSuggestedCode(activeTabKey, pagination?.total || 0);

        setFormData({
            code: suggestedCode,
            customerCode: suggestedCode,
            supplierCode: suggestedCode,
            employeeCode: suggestedCode,
            machineCode: suggestedCode,
            itemCode: suggestedCode,
            shiftCode: suggestedCode,
            startTime: '06:00',
            endTime: '14:00',
            standardHours: 8,
            gracePeriodMinutes: 15,
            isActive: true,
            status: activeTabKey === 'customers' ? 'ACTIVE_CUSTOMER' : (activeTabKey === 'machines' ? 'AVAILABLE' : 'Active')
        });

        if (onAddClick) {
            onAddClick(activeTabKey);
        } else {
            setIsDrawerOpen(true);
        }
    };

    const handleEditRow = (row) => {
        setEditingItem(row);
        const codeVal = row.code || row.customerCode || row.supplierCode || row.employeeCode || row.machineCode || row.itemCode || row.shiftCode || '';
        setFormData({
            ...row,
            code: codeVal,
            customerCode: codeVal,
            supplierCode: codeVal,
            employeeCode: codeVal,
            machineCode: codeVal,
            itemCode: codeVal,
            shiftCode: codeVal,
            shiftAssignment: typeof row.shiftAssignment === 'object' ? row.shiftAssignment?._id : row.shiftAssignment,
            facility: typeof row.facility === 'object' ? row.facility?._id : row.facility,
            isActive: row.isActive !== false
        });
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
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Employee Code (Auto-generated)
                        </label>
                        <input
                            type="text"
                            required
                            readOnly
                            value={currentCode}
                            className="w-full border border-border rounded-md p-2.5 bg-sidebar-hover/40 text-xs text-text-main font-mono font-semibold uppercase tracking-wider"
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
                                        {s.name} ({s.shiftCode} {s.startTime}–{s.endTime})
                                    </option>
                                ))}
                                <option value="__ADD_NEW_SHIFT__" className="font-bold text-primary">
                                    + Add New Shift...
                                </option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Facility / Location *
                            </label>
                            <select
                                name="facility"
                                required
                                value={formData.facility || (locationsList[0]?._id || '')}
                                onChange={(e) => handleInputChange('facility', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select Facility --</option>
                                {locationsList.map((l) => (
                                    <option key={l._id} value={l._id}>
                                        {l.name}
                                    </option>
                                ))}
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

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Section
                            </label>
                            <select
                                value={formData.section || 'Extrusion'}
                                onChange={(e) => handleInputChange('section', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="Extrusion">Extrusion</option>
                                <option value="Weaving">Weaving</option>
                                <option value="Lamination">Lamination</option>
                                <option value="Conversion">Conversion</option>
                                <option value="Printing">Printing</option>
                                <option value="Quality">Quality</option>
                            </select>
                        </div>

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
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Current Operator
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Ramesh Kumar"
                                value={formData.currentOperator || ''}
                                onChange={(e) => handleInputChange('currentOperator', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

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

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // RAW MATERIALS FORM
        if (key === 'raw-materials' || key === 'rawmaterials') {
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

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Raw Material Name / Title *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. High Density PP Resin Granules Grade 100"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
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
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Unit of Measure (UOM) *
                            </label>
                            <select
                                name="uom"
                                required
                                value={typeof formData.uom === 'object' ? formData.uom?._id : (formData.uom || (uomsList[0]?._id || ''))}
                                onChange={(e) => handleInputChange('uom', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select UOM --</option>
                                {uomsList.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name} ({u.symbol || u.name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Purchase Price (₹)
                            </label>
                            <input
                                type="number"
                                placeholder="125"
                                value={formData.pricePerUnit || ''}
                                onChange={(e) => handleInputChange('pricePerUnit', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Current Stock
                            </label>
                            <input
                                type="number"
                                placeholder="5000"
                                value={formData.currentStock || ''}
                                onChange={(e) => handleInputChange('currentStock', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Reorder Level
                            </label>
                            <input
                                type="number"
                                placeholder="1000"
                                value={formData.reorderLevel || ''}
                                onChange={(e) => handleInputChange('reorderLevel', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    {renderIsActiveToggle()}
                </div>
            );
        }

        // FINISHED GOODS FORM
        if (key === 'finished-goods' || key === 'finishedbags' || key === 'finishedproducts') {
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

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                            Product Specification / Title *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 50kg Laminated PP Woven Fertilizer Sack"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                        />
                    </div>

                    {/* Bag Type / Category Field Full Width */}
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
                            <option value="">-- Select Bag Type --</option>
                            {categoriesList.map((cat) => (
                                <option key={cat._id} value={cat._id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Unit of Measure (UOM) *
                            </label>
                            <select
                                name="uom"
                                required
                                value={typeof formData.uom === 'object' ? formData.uom?._id : (formData.uom || (uomsList[0]?._id || ''))}
                                onChange={(e) => handleInputChange('uom', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="">-- Select UOM --</option>
                                {uomsList.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name} ({u.symbol || u.name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Bag Shape
                            </label>
                            <select
                                name="bagShape"
                                value={formData.bagShape || 'Flat'}
                                onChange={(e) => handleInputChange('bagShape', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans cursor-pointer"
                            >
                                <option value="Flat">Flat</option>
                                <option value="Gusseted">Gusseted</option>
                                <option value="Tubular">Tubular</option>
                                <option value="Pinch Bottom">Pinch Bottom</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Width (cm)
                            </label>
                            <input
                                type="number"
                                placeholder="45"
                                value={formData.dimensions?.width || ''}
                                onChange={(e) => handleNestedChange('dimensions', 'width', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Length (cm)
                            </label>
                            <input
                                type="number"
                                placeholder="75"
                                value={formData.dimensions?.length || ''}
                                onChange={(e) => handleNestedChange('dimensions', 'length', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
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

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-main mb-1">
                                Price / Bag (₹)
                            </label>
                            <input
                                type="number"
                                placeholder="18"
                                value={formData.pricePerBag || formData.price || ''}
                                onChange={(e) => handleInputChange('pricePerBag', e.target.value)}
                                className="w-full border border-border rounded-md p-2.5 bg-card-bg text-xs text-text-main focus:outline-none focus:border-primary font-sans"
                            />
                        </div>
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
        <div className="space-y-5 font-sans">
            {/* Top Main Page Header with Dynamic Add Record Button */}
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-xl font-extrabold text-text-main tracking-tight">{title}</h1>
                    {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    {/* Optional Custom Header Action Buttons */}
                    {headerActions}

                    {/* Top-Right Dynamic "Add New Record" Button */}
                    <button
                        type="button"
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer shrink-0"
                        onClick={handleOpenDrawer}
                    >
                        <Plus size={15} />
                        <span>Add New {activeTabLabel} Record</span>
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            {showTabBar && (
                <div className="flex items-center gap-2 border-b border-border pb-2.5 overflow-x-auto">
                    {tabs.map((tab) => {
                        const isActive = tab.key === activeTabKey;
                        const isPlaceholderTab = tab.isPlaceholder || !tab.resourcePath;
                        const count = isPlaceholderTab ? '—' : tabCounts[tab.key];
                        const TabIcon = tab.icon;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => {
                                    setActiveTabKey(tab.key);
                                    setSearch('');
                                    setPage(1);
                                }}
                                className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${isActive
                                    ? 'bg-primary text-sidebar-bg font-bold shadow-xs px-3.5 py-2 rounded-full'
                                    : 'text-text-muted hover:text-text-main px-3 py-2 rounded-full border border-transparent'
                                    }`}
                            >
                                {TabIcon && <TabIcon size={15} className="shrink-0" />}
                                <span>{tab.label}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive
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
            ) : (
                <DataTable
                    columns={activeTab?.columns || []}
                    data={data}
                    isLoading={isLoading}
                    emptyMessage={`No ${activeTab?.label || 'records'} found`}
                    search={search}
                    onSearchChange={setSearch}
                    pagination={pagination}
                    onPageChange={setPage}
                    activeTabLabel={activeTab?.label}
                    onEdit={handleEditRow}
                    onDelete={handleDeleteRow}
                    onExportCsv={handleExportCsv}
                />
            )}

            {/* SLIDE-OUT DRAWER SHELL (UI) */}
            {isDrawerOpen && (
                <>
                    {/* Semi-transparent Backdrop Overlay */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                        onClick={() => setIsDrawerOpen(false)}
                    />

                    {/* Slide-out Drawer Panel */}
                    <div className="fixed top-0 right-0 h-full w-full max-w-md bg-card-bg shadow-2xl z-50 flex flex-col transform transition-transform border-l border-border font-sans">
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
                <>
                    <div
                        className="fixed inset-0 bg-black/60 z-50 transition-opacity"
                        onClick={() => setIsInlineShiftModalOpen(false)}
                    />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card-bg border border-border rounded-xl shadow-2xl z-50 p-6 font-sans">
                        <div className="flex justify-between items-center pb-3 mb-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Clock className="text-primary" size={20} />
                                <h3 className="text-sm font-extrabold text-text-main">Create New Work Shift</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsInlineShiftModalOpen(false)}
                                className="text-text-muted hover:text-text-main"
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
                                    className="px-3 py-1.5 border border-border rounded-lg text-text-main font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingInlineShift}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-sidebar-bg font-bold rounded-lg disabled:opacity-50"
                                >
                                    {isSavingInlineShift ? 'Creating...' : 'Create & Select Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Custom Category Modal */}
            {categoryModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card-bg rounded-lg shadow-xl w-96 p-6 border border-border space-y-4 font-sans animate-in fade-in zoom-in duration-150">
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
                                    className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-sidebar-hover transition-colors cursor-pointer"
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

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-card-bg rounded-lg shadow-2xl w-[400px] p-6 border border-border space-y-4 font-sans animate-in fade-in zoom-in duration-150">
                        <h3 className="text-lg font-bold text-text-main">{confirmModal.title}</h3>
                        <p className="text-sm text-text-muted mt-2">{confirmModal.message}</p>
                        <div className="mt-6 flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={closeConfirmModal}
                                className="px-4 py-2 border border-border rounded-md text-xs font-semibold text-text-main hover:bg-sidebar-hover transition-colors cursor-pointer"
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
        </div>
    );
}
