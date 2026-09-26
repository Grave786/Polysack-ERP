const Supplier = require('../models/supplier.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * @desc    Create a new Supplier / Vendor
 * @route   POST /api/suppliers
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createSupplier = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Allow companyName or name from frontend body
        const rawName = req.body.name || req.body.companyName;
        const rawCode = req.body.code || req.body.supplierCode;

        const {
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin,
            paymentTerms,
            isActive
        } = req.body;

        // 1. Validation
        if (!rawName || !rawName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Supplier name is required.'
            });
        }

        if (!rawCode || !rawCode.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Supplier code is required.'
            });
        }

        const formattedName = rawName.trim();
        const formattedCode = rawCode.trim().toUpperCase();
        const formattedGstin = gstin && gstin.trim() ? gstin.trim().toUpperCase() : undefined;

        // 2. Check duplicate code per tenant
        const existingCode = await Supplier.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A supplier with code '${formattedCode}' already exists in your organization.`
            });
        }

        // 3. Check duplicate name per tenant
        const existingName = await Supplier.findOne({ name: formattedName, tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A supplier named '${formattedName}' already exists in your organization.`
            });
        }

        // 4. Check duplicate GSTIN per tenant if provided
        if (formattedGstin) {
            const existingGstin = await Supplier.findOne({ gstin: formattedGstin, tenant: tenantId });
            if (existingGstin) {
                return res.status(400).json({
                    success: false,
                    message: `A supplier with GSTIN '${formattedGstin}' already exists in your organization.`
                });
            }
        }

        // 5. Create Supplier
        const supplier = new Supplier({
            code: formattedCode,
            name: formattedName,
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin: formattedGstin,
            paymentTerms,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await supplier.save();

        return res.status(201).json({
            success: true,
            message: 'Supplier created successfully.',
            data: supplier
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createSupplier:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create supplier.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all suppliers scoped to user's tenant
 * @route   GET /api/suppliers
 * @access  Private (MASTER_DATA:READ permission)
 */
const getSuppliers = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { isActive, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { gstin: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [suppliers, total] = await Promise.all([
            Supplier.find(filter).sort({ code: 1 }).skip(skip).limit(limitNum),
            Supplier.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: suppliers.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: suppliers
        });
    } catch (error) {
        console.error('Error in getSuppliers:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch suppliers.',
            error: error.message
        });
    }
};

/**
 * @desc    Export suppliers to CSV respecting tenant & query filters
 * @route   GET /api/suppliers/export
 * @access  Private (MASTER_DATA:READ permission)
 */
const exportSuppliers = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
        if (search) {
            filter.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { gstin: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }

        const suppliers = await Supplier.find(filter).sort({ code: 1 });

        const fields = [
            { label: 'Supplier Code', key: 'code' },
            { label: 'Supplier Name', key: 'name' },
            { label: 'Contact Person', key: (s) => s.contactPerson || '' },
            { label: 'Phone', key: (s) => s.phone || '' },
            { label: 'Email', key: (s) => s.email || '' },
            { label: 'GSTIN', key: (s) => s.gstin || '' },
            { label: 'City', key: (s) => s.city || '' },
            { label: 'State', key: (s) => s.state || '' },
            { label: 'Payment Terms', key: (s) => s.paymentTerms || '' },
            { label: 'Is Active', key: (s) => s.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(suppliers, fields);
        return sendCsvResponse(res, `suppliers_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportSuppliers:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export suppliers to CSV.'
        });
    }
};

/**
 * @desc    Get supplier by ID scoped to user's tenant
 * @route   GET /api/suppliers/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getSupplierById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const supplier = await Supplier.findOne({ _id: req.params.id, tenant: tenantId });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: supplier
        });
    } catch (error) {
        console.error('Error in getSupplierById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve supplier.',
            error: error.message
        });
    }
};

/**
 * @desc    Update supplier scoped to user's tenant
 * @route   PUT /api/suppliers/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateSupplier = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const supplier = await Supplier.findOne({ _id: req.params.id, tenant: tenantId });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        const rawName = req.body.name || req.body.companyName;
        const rawCode = req.body.code || req.body.supplierCode;

        const {
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin,
            paymentTerms,
            isActive
        } = req.body;

        // Prevent modifying tenant
        delete req.body.tenant;

        if (rawCode) {
            const formattedCode = String(rawCode).trim().toUpperCase();
            if (formattedCode !== supplier.code) {
                const existingCode = await Supplier.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: supplier._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A supplier with code '${formattedCode}' already exists in your organization.`
                    });
                }
                supplier.code = formattedCode;
            }
        }

        if (rawName && rawName.trim() !== supplier.name) {
            const formattedName = rawName.trim();
            const existingName = await Supplier.findOne({
                name: formattedName,
                tenant: tenantId,
                _id: { $ne: supplier._id }
            });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: `A supplier named '${formattedName}' already exists in your organization.`
                });
            }
            supplier.name = formattedName;
        }

        if (gstin !== undefined) {
            const formattedGstin = gstin && gstin.trim() ? gstin.trim().toUpperCase() : undefined;
            if (formattedGstin && formattedGstin !== supplier.gstin) {
                const existingGstin = await Supplier.findOne({
                    gstin: formattedGstin,
                    tenant: tenantId,
                    _id: { $ne: supplier._id }
                });
                if (existingGstin) {
                    return res.status(400).json({
                        success: false,
                        message: `A supplier with GSTIN '${formattedGstin}' already exists in your organization.`
                    });
                }
            }
            supplier.gstin = formattedGstin;
        }

        if (contactPerson !== undefined) supplier.contactPerson = contactPerson;
        if (phone !== undefined) supplier.phone = phone;
        if (email !== undefined) supplier.email = email;
        if (address !== undefined) supplier.address = address;
        if (city !== undefined) supplier.city = city;
        if (state !== undefined) supplier.state = state;
        if (paymentTerms !== undefined) supplier.paymentTerms = paymentTerms;
        if (isActive !== undefined) supplier.isActive = isActive;

        await supplier.save();

        return res.status(200).json({
            success: true,
            message: 'Supplier updated successfully.',
            data: supplier
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateSupplier:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update supplier.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete supplier (isActive: false) scoped to user's tenant
 * @route   DELETE /api/suppliers/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteSupplier = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const supplier = await Supplier.findOne({ _id: req.params.id, tenant: tenantId });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found.'
            });
        }

        supplier.isActive = false;
        await supplier.save();

        return res.status(200).json({
            success: true,
            message: 'Supplier deactivated successfully.',
            data: supplier
        });
    } catch (error) {
        console.error('Error in deleteSupplier:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete supplier.',
            error: error.message
        });
    }
};

module.exports = {
    createSupplier,
    getSuppliers,
    exportSuppliers,
    getSupplierById,
    updateSupplier,
    deleteSupplier
};
