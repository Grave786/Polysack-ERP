const Section = require('../models/section.model');
const Machine = require('../models/machine.model');

const DEFAULT_SECTIONS = [
    'Extrusion',
    'Weaving',
    'Lamination',
    'Printing',
    'Cutting & Sewing',
    'Sewing',
    'Stitching',
    'Handle Attachment',
    'Baling',
    'Quality',
    'Maintenance',
    'Conversion'
];

/**
 * @desc    Create a new Section
 * @route   POST /api/sections
 * @access  Private
 */
const createSection = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const { name, description, isActive } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Section name is required.'
            });
        }

        const trimmedName = String(name).trim();

        const existing = await Section.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
            tenant: tenantId
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `A Section named '${trimmedName}' already exists.`
            });
        }

        const section = new Section({
            name: trimmedName,
            description,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await section.save();

        return res.status(201).json({
            success: true,
            message: 'Section created successfully.',
            data: section
        });
    } catch (error) {
        console.error('Error in createSection:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Section.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Sections scoped to tenant (auto-seed defaults if empty)
 * @route   GET /api/sections
 * @access  Private
 */
const getSections = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context missing.'
            });
        }

        const { isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        let sections = await Section.find(filter).sort({ name: 1 });

        // Auto-seed defaults if collection is empty for tenant
        if (sections.length === 0 && (!isActive || isActive === 'true' || isActive === true)) {
            for (const sectionName of DEFAULT_SECTIONS) {
                await Section.updateOne(
                    { tenant: tenantId, name: sectionName },
                    { $setOnInsert: { tenant: tenantId, name: sectionName, isActive: true } },
                    { upsert: true }
                );
            }
            sections = await Section.find(filter).sort({ name: 1 });
        }

        return res.status(200).json({
            success: true,
            count: sections.length,
            data: sections
        });
    } catch (error) {
        console.error('Error in getSections:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Sections.',
            error: error.message
        });
    }
};

/**
 * @desc    Update a Section
 * @route   PUT /api/sections/:id
 * @access  Private
 */
const updateSection = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context missing.'
            });
        }

        const { name, description, isActive } = req.body;
        const section = await Section.findOne({ _id: req.params.id, tenant: tenantId });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: 'Section not found.'
            });
        }

        if (name && name.trim() !== section.name) {
            const trimmedName = name.trim();
            const existing = await Section.findOne({
                name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
                tenant: tenantId,
                _id: { $ne: section._id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A Section named '${trimmedName}' already exists.`
                });
            }

            const oldName = section.name;
            section.name = trimmedName;

            // Cascade name update to any machines using the old section name
            await Machine.updateMany(
                { tenant: tenantId, section: { $regex: new RegExp(`^${oldName}$`, 'i') } },
                { $set: { section: trimmedName } }
            );
        }

        if (description !== undefined) section.description = description;
        if (isActive !== undefined) section.isActive = isActive;

        await section.save();

        return res.status(200).json({
            success: true,
            message: 'Section updated successfully.',
            data: section
        });
    } catch (error) {
        console.error('Error in updateSection:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Section.',
            error: error.message
        });
    }
};

/**
 * @desc    Delete or deactivate a Section
 * @route   DELETE /api/sections/:id
 * @access  Private
 */
const deleteSection = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context missing.'
            });
        }

        const section = await Section.findOne({ _id: req.params.id, tenant: tenantId });
        if (!section) {
            return res.status(404).json({
                success: false,
                message: 'Section not found.'
            });
        }

        // Check if any active machines are assigned to this section
        const inUseCount = await Machine.countDocuments({
            tenant: tenantId,
            section: { $regex: new RegExp(`^${section.name}$`, 'i') }
        });

        if (inUseCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete section '${section.name}' because it is currently assigned to ${inUseCount} machine(s). Please reassign them first.`
            });
        }

        await Section.deleteOne({ _id: section._id, tenant: tenantId });

        return res.status(200).json({
            success: true,
            message: 'Section deleted successfully.',
            data: section
        });
    } catch (error) {
        console.error('Error in deleteSection:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Section.',
            error: error.message
        });
    }
};

module.exports = {
    DEFAULT_SECTIONS,
    createSection,
    getSections,
    updateSection,
    deleteSection
};
