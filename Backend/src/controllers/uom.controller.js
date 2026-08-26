const UOM = require('../models/uom.model');

/**
 * @desc    Create a new Unit of Measure (UOM)
 * @route   POST /api/uom
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createUOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { name, symbol, abbreviation, type, isBaseUnit, conversionFactor, isActive } = req.body;
        const finalAbbr = abbreviation || symbol;

        // 1. Basic validation
        if (!name || !finalAbbr) {
            return res.status(400).json({
                success: false,
                message: 'Please provide required fields: name and abbreviation (or symbol).'
            });
        }

        // 2. Check for duplicate name in this tenant
        const existingName = await UOM.findOne({ name, tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A UOM with the name '${name}' already exists in your organization.`
            });
        }

        // 3. Create UOM (tenant overridden from req.user.tenant)
        const newUom = new UOM({
            name: name.trim(),
            abbreviation: finalAbbr.trim(),
            symbol: finalAbbr.trim(),
            type: type || 'COUNT',
            isBaseUnit: isBaseUnit || false,
            conversionFactor: conversionFactor !== undefined ? conversionFactor : 1,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await newUom.save();

        return res.status(201).json({
            success: true,
            message: 'UOM created successfully.',
            data: newUom
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createUOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create UOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all UOMs scoped to user's tenant with filtering and pagination
 * @route   GET /api/uom
 * @access  Private (MASTER_DATA:READ permission)
 */
const getUOMs = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { type, status, isActive, search, page = 1, limit = 20 } = req.query;

        // Build filter strictly scoped to req.user.tenant
        const filter = { tenant: tenantId };

        if (type) {
            filter.type = type;
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
                { symbol: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [uoms, total] = await Promise.all([
            UOM.find(filter).sort({ name: 1 }).skip(skip).limit(limitNum),
            UOM.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: uoms.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: uoms
        });
    } catch (error) {
        console.error('Error in getUOMs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch UOMs.',
            error: error.message
        });
    }
};

/**
 * @desc    Get UOM by ID strictly scoped to user's tenant
 * @route   GET /api/uom/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getUOMById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const uom = await UOM.findOne({ _id: req.params.id, tenant: tenantId });

        if (!uom) {
            return res.status(404).json({
                success: false,
                message: 'UOM not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: uom
        });
    } catch (error) {
        console.error('Error in getUOMById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve UOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Update UOM scoped to user's tenant
 * @route   PUT /api/uom/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateUOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const uom = await UOM.findOne({ _id: req.params.id, tenant: tenantId });

        if (!uom) {
            return res.status(404).json({
                success: false,
                message: 'UOM not found.'
            });
        }

        const { name, symbol, type, isBaseUnit, conversionFactor, isActive } = req.body;

        // Prevent tenant modification
        delete req.body.tenant;

        if (name && name !== uom.name) {
            const existing = await UOM.findOne({ name, tenant: tenantId, _id: { $ne: uom._id } });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A UOM with the name '${name}' already exists in your organization.`
                });
            }
            uom.name = name;
        }

        if (symbol && symbol !== uom.symbol) {
            const existing = await UOM.findOne({ symbol, tenant: tenantId, _id: { $ne: uom._id } });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A UOM with the symbol '${symbol}' already exists in your organization.`
                });
            }
            uom.symbol = symbol;
        }

        if (type) uom.type = type;
        if (isBaseUnit !== undefined) uom.isBaseUnit = isBaseUnit;
        if (conversionFactor !== undefined) uom.conversionFactor = conversionFactor;
        if (isActive !== undefined) uom.isActive = isActive;

        await uom.save();

        return res.status(200).json({
            success: true,
            message: 'UOM updated successfully.',
            data: uom
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateUOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update UOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete UOM (set isActive: false) scoped to user's tenant
 * @route   DELETE /api/uom/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteUOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const uom = await UOM.findOne({ _id: req.params.id, tenant: tenantId });

        if (!uom) {
            return res.status(404).json({
                success: false,
                message: 'UOM not found.'
            });
        }

        uom.isActive = false;
        await uom.save();

        return res.status(200).json({
            success: true,
            message: 'UOM deactivated successfully.',
            data: uom
        });
    } catch (error) {
        console.error('Error in deleteUOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete UOM.',
            error: error.message
        });
    }
};

module.exports = {
    createUOM,
    getUOMs,
    getUOMById,
    updateUOM,
    deleteUOM
};
