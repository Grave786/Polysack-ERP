const BagShape = require('../models/bagShape.model');
const FinishedGood = require('../models/finishedGood.model');

/**
 * @desc    Create a new Bag Shape
 * @route   POST /api/bag-shapes
 * @access  Private
 */
const createBagShape = async (req, res) => {
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
                message: 'Bag Shape name is required.'
            });
        }

        const trimmedName = String(name).trim();

        const existing = await BagShape.findOne({ name: trimmedName, tenant: tenantId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `A Bag Shape named '${trimmedName}' already exists.`
            });
        }

        const bagShape = new BagShape({
            name: trimmedName,
            description,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await bagShape.save();

        return res.status(201).json({
            success: true,
            message: 'Bag Shape created successfully.',
            data: bagShape
        });
    } catch (error) {
        console.error('Error in createBagShape:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Bag Shape.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Bag Shapes scoped to tenant
 * @route   GET /api/bag-shapes
 * @access  Private
 */
const getBagShapes = async (req, res) => {
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

        let bagShapes = await BagShape.find(filter).sort({ name: 1 });

        // Auto-seed defaults if collection is empty for tenant
        if (bagShapes.length === 0 && (!isActive || isActive === 'true' || isActive === true)) {
            const defaults = ['Gusseted', 'Flat / Tubular', 'Block Bottom', 'Pinch Bottom', 'Valve'];
            for (const shapeName of defaults) {
                await BagShape.updateOne(
                    { tenant: tenantId, name: shapeName },
                    { $setOnInsert: { tenant: tenantId, name: shapeName, isActive: true } },
                    { upsert: true }
                );
            }
            bagShapes = await BagShape.find(filter).sort({ name: 1 });
        }

        return res.status(200).json({
            success: true,
            count: bagShapes.length,
            data: bagShapes
        });
    } catch (error) {
        console.error('Error in getBagShapes:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Bag Shapes.',
            error: error.message
        });
    }
};

/**
 * @desc    Update a Bag Shape
 * @route   PUT /api/bag-shapes/:id
 * @access  Private
 */
const updateBagShape = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context missing.'
            });
        }

        const { name, description, isActive } = req.body;
        const bagShape = await BagShape.findOne({ _id: req.params.id, tenant: tenantId });

        if (!bagShape) {
            return res.status(404).json({
                success: false,
                message: 'Bag Shape not found.'
            });
        }

        if (name && name.trim() !== bagShape.name) {
            const trimmedName = name.trim();
            const existing = await BagShape.findOne({
                name: trimmedName,
                tenant: tenantId,
                _id: { $ne: bagShape._id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A Bag Shape with name '${trimmedName}' already exists.`
                });
            }

            const oldName = bagShape.name;
            bagShape.name = trimmedName;
            await FinishedGood.updateMany(
                { tenant: tenantId, bagShape: oldName },
                { $set: { bagShape: trimmedName } }
            );
        }

        if (description !== undefined) bagShape.description = description;
        if (isActive !== undefined) bagShape.isActive = isActive;

        await bagShape.save();

        return res.status(200).json({
            success: true,
            message: 'Bag Shape updated successfully.',
            data: bagShape
        });
    } catch (error) {
        console.error('Error in updateBagShape:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Bag Shape.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete / Deactivate a Bag Shape
 * @route   DELETE /api/bag-shapes/:id
 * @access  Private
 */
const deleteBagShape = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context missing.'
            });
        }

        const bagShape = await BagShape.findOne({ _id: req.params.id, tenant: tenantId });
        if (!bagShape) {
            return res.status(404).json({
                success: false,
                message: 'Bag Shape not found.'
            });
        }

        bagShape.isActive = false;
        await bagShape.save();

        return res.status(200).json({
            success: true,
            message: 'Bag Shape deactivated successfully.',
            data: bagShape
        });
    } catch (error) {
        console.error('Error in deleteBagShape:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Bag Shape.',
            error: error.message
        });
    }
};

module.exports = {
    createBagShape,
    getBagShapes,
    updateBagShape,
    deleteBagShape
};
