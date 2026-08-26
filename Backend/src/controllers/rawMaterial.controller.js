const RawMaterial = require('../models/rawMaterial.model');
const Category = require('../models/category.model');
const UOM = require('../models/uom.model');
const Supplier = require('../models/supplier.model');
const Location = require('../models/location.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * @desc    Create a new Raw Material
 * @route   POST /api/raw-materials
 * @access  Private (INVENTORY:CREATE permission)
 */
const createRawMaterial = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Always strip currentStock from body (read-only, updated via StockTransaction only)
        delete req.body.currentStock;
        delete req.body.tenant;

        const {
            code,
            name,
            category,
            uom,
            defaultSupplier,
            defaultLocation,
            reorderLevel,
            pricePerUnit,
            isActive
        } = req.body;

        // 1. Basic validation
        if (!code || !name || !category || !uom) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: code, name, category, and uom.'
            });
        }

        const formattedCode = String(code).trim().toUpperCase();
        const formattedName = String(name).trim();

        // 2. Validate tenant-ownership of referenced models
        const categoryDoc = await Category.findOne({ _id: category, tenant: tenantId });
        if (!categoryDoc) {
            return res.status(400).json({
                success: false,
                message: 'Category does not exist or does not belong to your organization.'
            });
        }

        const uomDoc = await UOM.findOne({ _id: uom, tenant: tenantId });
        if (!uomDoc) {
            return res.status(400).json({
                success: false,
                message: 'UOM does not exist or does not belong to your organization.'
            });
        }

        if (defaultSupplier) {
            const supplierDoc = await Supplier.findOne({ _id: defaultSupplier, tenant: tenantId });
            if (!supplierDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Default supplier does not exist or does not belong to your organization.'
                });
            }
        }

        if (defaultLocation) {
            const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Default location does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Duplicate checks
        const existingCode = await RawMaterial.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A Raw Material with code '${formattedCode}' already exists in your organization.`
            });
        }

        const existingName = await RawMaterial.findOne({ name: formattedName, tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A Raw Material with name '${formattedName}' already exists in your organization.`
            });
        }

        // 4. Create RawMaterial
        const rawMaterial = new RawMaterial({
            code: formattedCode,
            name: formattedName,
            category,
            uom,
            defaultSupplier: defaultSupplier || null,
            defaultLocation: defaultLocation || null,
            reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 0,
            pricePerUnit: pricePerUnit !== undefined ? Number(pricePerUnit) : 0,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await rawMaterial.save();

        await rawMaterial.populate([
            { path: 'category', select: 'name type' },
            { path: 'uom', select: 'name symbol type' },
            { path: 'defaultSupplier', select: 'name contactPerson phone' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        return res.status(201).json({
            success: true,
            message: 'Raw Material created successfully.',
            data: rawMaterial
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createRawMaterial:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Raw Material.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Raw Materials scoped to user's tenant
 * @route   GET /api/raw-materials
 * @access  Private (INVENTORY:READ permission)
 */
const getRawMaterials = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { category, uom, status, isActive, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (category) {
            filter.category = category;
        }

        if (uom) {
            filter.uom = uom;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            RawMaterial.find(filter)
                .populate('category', 'name type')
                .populate('uom', 'name symbol type')
                .populate('defaultSupplier', 'name contactPerson phone')
                .populate('defaultLocation', 'name code type')
                .sort({ name: 1 })
                .skip(skip)
                .limit(limitNum),
            RawMaterial.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: items.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: items
        });
    } catch (error) {
        console.error('Error in getRawMaterials:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Raw Materials.',
            error: error.message
        });
    }
};

/**
 * @desc    Export Raw Materials to CSV
 * @route   GET /api/raw-materials/export
 * @access  Private (INVENTORY:READ permission)
 */
const exportRawMaterials = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { category, uom, status, isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (category) filter.category = category;
        if (uom) filter.uom = uom;
        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        const items = await RawMaterial.find(filter)
            .populate('category', 'name')
            .populate('uom', 'name symbol')
            .sort({ name: 1 });

        const fields = [
            { label: 'Item Code', key: 'code' },
            { label: 'Material Name', key: 'name' },
            { label: 'Category', key: (r) => (typeof r.category === 'object' ? r.category?.name : r.category) || '' },
            { label: 'UOM', key: (r) => (typeof r.uom === 'object' ? r.uom?.symbol || r.uom?.name : r.uom) || 'kg' },
            { label: 'Reorder Level', key: (r) => r.reorderLevel || 0 },
            { label: 'Current Stock', key: (r) => r.currentStock || 0 },
            { label: 'Price Per Unit (INR)', key: (r) => r.pricePerUnit || 0 },
            { label: 'Is Active', key: (r) => r.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(items, fields);
        return sendCsvResponse(res, `raw_materials_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportRawMaterials:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export raw materials to CSV.'
        });
    }
};

/**
 * @desc    Get Raw Material by ID scoped to user's tenant
 * @route   GET /api/raw-materials/:id
 * @access  Private (INVENTORY:READ permission)
 */
const getRawMaterialById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const rawMaterial = await RawMaterial.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('category', 'name type')
            .populate('uom', 'name symbol type')
            .populate('defaultSupplier', 'name contactPerson phone')
            .populate('defaultLocation', 'name code type');

        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                message: 'Raw Material not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: rawMaterial
        });
    } catch (error) {
        console.error('Error in getRawMaterialById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Raw Material.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Raw Material scoped to user's tenant (currentStock is read-only)
 * @route   PUT /api/raw-materials/:id
 * @access  Private (INVENTORY:UPDATE permission)
 */
const updateRawMaterial = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const rawMaterial = await RawMaterial.findOne({ _id: req.params.id, tenant: tenantId });
        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                message: 'Raw Material not found.'
            });
        }

        // Always strip currentStock and tenant from body
        delete req.body.currentStock;
        delete req.body.tenant;

        const {
            code,
            name,
            category,
            uom,
            defaultSupplier,
            defaultLocation,
            reorderLevel,
            pricePerUnit,
            isActive
        } = req.body;

        if (code) {
            const formattedCode = String(code).trim().toUpperCase();
            if (formattedCode !== rawMaterial.code) {
                const existingCode = await RawMaterial.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: rawMaterial._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A Raw Material with code '${formattedCode}' already exists in your organization.`
                    });
                }
                rawMaterial.code = formattedCode;
            }
        }

        if (name && name.trim() !== rawMaterial.name) {
            const formattedName = name.trim();
            const existingName = await RawMaterial.findOne({
                name: formattedName,
                tenant: tenantId,
                _id: { $ne: rawMaterial._id }
            });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: `A Raw Material with name '${formattedName}' already exists in your organization.`
                });
            }
            rawMaterial.name = formattedName;
        }

        if (category && String(category) !== String(rawMaterial.category)) {
            const categoryDoc = await Category.findOne({ _id: category, tenant: tenantId });
            if (!categoryDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Category does not exist or does not belong to your organization.'
                });
            }
            rawMaterial.category = category;
        }

        if (uom && String(uom) !== String(rawMaterial.uom)) {
            const uomDoc = await UOM.findOne({ _id: uom, tenant: tenantId });
            if (!uomDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'UOM does not exist or does not belong to your organization.'
                });
            }
            rawMaterial.uom = uom;
        }

        if (defaultSupplier !== undefined) {
            if (defaultSupplier) {
                const supplierDoc = await Supplier.findOne({ _id: defaultSupplier, tenant: tenantId });
                if (!supplierDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Default supplier does not exist or does not belong to your organization.'
                    });
                }
                rawMaterial.defaultSupplier = defaultSupplier;
            } else {
                rawMaterial.defaultSupplier = null;
            }
        }

        if (defaultLocation !== undefined) {
            if (defaultLocation) {
                const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
                if (!locationDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Default location does not exist or does not belong to your organization.'
                    });
                }
                rawMaterial.defaultLocation = defaultLocation;
            } else {
                rawMaterial.defaultLocation = null;
            }
        }

        if (reorderLevel !== undefined) rawMaterial.reorderLevel = Number(reorderLevel);
        if (pricePerUnit !== undefined) rawMaterial.pricePerUnit = Number(pricePerUnit);
        if (isActive !== undefined) rawMaterial.isActive = isActive;

        await rawMaterial.save();

        await rawMaterial.populate([
            { path: 'category', select: 'name type' },
            { path: 'uom', select: 'name symbol type' },
            { path: 'defaultSupplier', select: 'name contactPerson phone' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Raw Material updated successfully.',
            data: rawMaterial
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateRawMaterial:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Raw Material.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Raw Material (isActive: false) scoped to user's tenant
 * @route   DELETE /api/raw-materials/:id
 * @access  Private (INVENTORY:DELETE permission)
 */
const deleteRawMaterial = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const rawMaterial = await RawMaterial.findOne({ _id: req.params.id, tenant: tenantId });
        if (!rawMaterial) {
            return res.status(404).json({
                success: false,
                message: 'Raw Material not found.'
            });
        }

        rawMaterial.isActive = false;
        await rawMaterial.save();

        return res.status(200).json({
            success: true,
            message: 'Raw Material deactivated successfully.',
            data: rawMaterial
        });
    } catch (error) {
        console.error('Error in deleteRawMaterial:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Raw Material.',
            error: error.message
        });
    }
};

module.exports = {
    createRawMaterial,
    getRawMaterials,
    exportRawMaterials,
    getRawMaterialById,
    updateRawMaterial,
    deleteRawMaterial
};
