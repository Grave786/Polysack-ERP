const RawMaterialAttribute = require('../models/rawMaterialAttribute.model');
const {
    RAW_MATERIAL_ATTRIBUTE_TYPES,
    DEFAULT_RAW_MATERIAL_ATTRIBUTES
} = require('../constants/rawMaterialAttributes.constants');

/**
 * Helper to auto-seed default attributes for a tenant if none exist
 */
const autoSeedTenantAttributes = async (tenantId, attributeType = null) => {
    try {
        const typesToSeed = attributeType ? [attributeType] : RAW_MATERIAL_ATTRIBUTE_TYPES;

        for (const type of typesToSeed) {
            const count = await RawMaterialAttribute.countDocuments({
                tenant: tenantId,
                attributeType: type
            });

            if (count === 0 && DEFAULT_RAW_MATERIAL_ATTRIBUTES[type]) {
                const defaults = DEFAULT_RAW_MATERIAL_ATTRIBUTES[type];
                for (const optionName of defaults) {
                    await RawMaterialAttribute.updateOne(
                        { tenant: tenantId, attributeType: type, name: optionName },
                        {
                            $setOnInsert: {
                                tenant: tenantId,
                                attributeType: type,
                                name: optionName,
                                isActive: true
                            }
                        },
                        { upsert: true }
                    );
                }
            }
        }
    } catch (seedErr) {
        console.error('Error auto-seeding raw material attributes for tenant:', seedErr);
    }
};

/**
 * @desc    Get all Raw Material attributes scoped to tenant
 * @route   GET /api/raw-material-attributes
 * @access  Private
 */
const getRawMaterialAttributes = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { type, isActive, search } = req.query;

        // Auto-seed defaults if missing
        await autoSeedTenantAttributes(tenantId, type || null);

        const filter = { tenant: tenantId };

        if (type) {
            filter.attributeType = type;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const items = await RawMaterialAttribute.find(filter).sort({ name: 1 });

        // If specific type was requested, return standard array
        if (type) {
            return res.status(200).json({
                success: true,
                count: items.length,
                data: items
            });
        }

        // If no type filter was requested, return both grouped object and full list
        const grouped = {};
        for (const t of RAW_MATERIAL_ATTRIBUTE_TYPES) {
            grouped[t] = [];
        }
        for (const item of items) {
            if (grouped[item.attributeType]) {
                grouped[item.attributeType].push(item);
            }
        }

        return res.status(200).json({
            success: true,
            count: items.length,
            data: grouped,
            list: items
        });
    } catch (error) {
        console.error('Error in getRawMaterialAttributes:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch raw material attributes.',
            error: error.message
        });
    }
};

/**
 * @desc    Create a new Raw Material attribute option
 * @route   POST /api/raw-material-attributes
 * @access  Private
 */
const createRawMaterialAttribute = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { attributeType, name, description, isActive } = req.body;

        if (!attributeType || !RAW_MATERIAL_ATTRIBUTE_TYPES.includes(attributeType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid or missing attributeType. Allowed types: ${RAW_MATERIAL_ATTRIBUTE_TYPES.join(', ')}`
            });
        }

        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Attribute name is required.'
            });
        }

        const trimmedName = String(name).trim();

        // Check for duplicate within same tenant and attributeType
        const existing = await RawMaterialAttribute.findOne({
            tenant: tenantId,
            attributeType,
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `An option named '${trimmedName}' already exists in this master list.`
            });
        }

        const newAttr = new RawMaterialAttribute({
            tenant: tenantId,
            attributeType,
            name: trimmedName,
            description: description ? String(description).trim() : '',
            isActive: isActive !== undefined ? isActive : true
        });

        await newAttr.save();

        return res.status(201).json({
            success: true,
            message: 'Option added successfully.',
            data: newAttr
        });
    } catch (error) {
        console.error('Error in createRawMaterialAttribute:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create attribute option.',
            error: error.message
        });
    }
};

/**
 * @desc    Update a Raw Material attribute option
 * @route   PUT /api/raw-material-attributes/:id
 * @access  Private
 */
const updateRawMaterialAttribute = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const attr = await RawMaterialAttribute.findOne({ _id: req.params.id, tenant: tenantId });
        if (!attr) {
            return res.status(404).json({
                success: false,
                message: 'Attribute option not found.'
            });
        }

        const { name, description, isActive } = req.body;

        if (name && String(name).trim()) {
            const trimmedName = String(name).trim();
            if (trimmedName.toLowerCase() !== attr.name.toLowerCase()) {
                const existing = await RawMaterialAttribute.findOne({
                    tenant: tenantId,
                    attributeType: attr.attributeType,
                    name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
                    _id: { $ne: attr._id }
                });

                if (existing) {
                    return res.status(400).json({
                        success: false,
                        message: `An option named '${trimmedName}' already exists in this master list.`
                    });
                }
            }
            attr.name = trimmedName;
        }

        if (description !== undefined) {
            attr.description = String(description).trim();
        }

        if (isActive !== undefined) {
            attr.isActive = Boolean(isActive);
        }

        await attr.save();

        return res.status(200).json({
            success: true,
            message: 'Attribute option updated successfully.',
            data: attr
        });
    } catch (error) {
        console.error('Error in updateRawMaterialAttribute:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update attribute option.',
            error: error.message
        });
    }
};

/**
 * @desc    Delete a Raw Material attribute option
 * @route   DELETE /api/raw-material-attributes/:id
 * @access  Private
 */
const deleteRawMaterialAttribute = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const attr = await RawMaterialAttribute.findOneAndDelete({ _id: req.params.id, tenant: tenantId });
        if (!attr) {
            return res.status(404).json({
                success: false,
                message: 'Attribute option not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Option '${attr.name}' deleted successfully.`
        });
    } catch (error) {
        console.error('Error in deleteRawMaterialAttribute:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete attribute option.',
            error: error.message
        });
    }
};

module.exports = {
    getRawMaterialAttributes,
    createRawMaterialAttribute,
    updateRawMaterialAttribute,
    deleteRawMaterialAttribute,
    autoSeedTenantAttributes
};
