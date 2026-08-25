const BOM = require('../models/bom.model');
const FinishedGood = require('../models/finishedGood.model');
const RawMaterial = require('../models/rawMaterial.model');

/**
 * @desc    Create a new BOM (Bill of Materials)
 * @route   POST /api/boms
 * @access  Private (PRODUCTION:CREATE permission)
 */
const createBOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;

        const { finishedGood, name, items, replaceExisting, isActive } = req.body;

        if (!finishedGood || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide finishedGood and at least one item in the items array.'
            });
        }

        // 1. Verify Finished Good exists and belongs to tenant
        const fgDoc = await FinishedGood.findOne({ _id: finishedGood, tenant: tenantId });
        if (!fgDoc) {
            return res.status(400).json({
                success: false,
                message: 'Finished Good does not exist or does not belong to your organization.'
            });
        }

        // 2. Validate items: check duplicate rawMaterials and verify tenant ownership
        const rawMaterialIds = new Set();
        for (const item of items) {
            if (!item.rawMaterial || !item.quantityPerUnit || Number(item.quantityPerUnit) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each item must have a valid rawMaterial ObjectId and a positive quantityPerUnit > 0.'
                });
            }

            const rmIdStr = String(item.rawMaterial);
            if (rawMaterialIds.has(rmIdStr)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate rawMaterial '${rmIdStr}' found in items array.`
                });
            }
            rawMaterialIds.add(rmIdStr);
        }

        // Batch verify all raw materials exist and belong to tenant
        const foundRawMaterials = await RawMaterial.find({
            _id: { $in: Array.from(rawMaterialIds) },
            tenant: tenantId
        });

        if (foundRawMaterials.length !== rawMaterialIds.size) {
            return res.status(400).json({
                success: false,
                message: 'One or more specified Raw Materials do not exist or do not belong to your organization.'
            });
        }

        const willBeActive = isActive !== undefined ? Boolean(isActive) : true;

        // 3. Handle active BOM rule (only 1 active BOM per finishedGood + tenant)
        if (willBeActive) {
            const existingActiveBom = await BOM.findOne({
                finishedGood,
                tenant: tenantId,
                isActive: true
            });

            if (existingActiveBom) {
                if (replaceExisting === true) {
                    existingActiveBom.isActive = false;
                    await existingActiveBom.save();
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'An active BOM already exists for this finished good. Pass "replaceExisting: true" to deactivate the old BOM automatically.'
                    });
                }
            }
        }

        // 4. Create new BOM
        const bom = new BOM({
            tenant: tenantId,
            finishedGood,
            name: name ? String(name).trim() : `Recipe for ${fgDoc.name}`,
            items: items.map(i => ({
                rawMaterial: i.rawMaterial,
                quantityPerUnit: Number(i.quantityPerUnit)
            })),
            isActive: willBeActive
        });

        await bom.save();

        await bom.populate([
            { path: 'finishedGood', select: 'name code' },
            { path: 'items.rawMaterial', select: 'name code uom' }
        ]);

        return res.status(201).json({
            success: true,
            message: 'BOM created successfully.',
            data: bom
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createBOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create BOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all BOMs scoped to user's tenant
 * @route   GET /api/boms
 * @access  Private (PRODUCTION:READ permission)
 */
const getBOMs = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { finishedGood, isActive, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (finishedGood) {
            filter.finishedGood = finishedGood;
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [boms, total] = await Promise.all([
            BOM.find(filter)
                .populate('finishedGood', 'name code')
                .populate({
                    path: 'items.rawMaterial',
                    select: 'name code uom',
                    populate: { path: 'uom', select: 'name symbol' }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            BOM.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: boms.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: boms
        });
    } catch (error) {
        console.error('Error in getBOMs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch BOMs.',
            error: error.message
        });
    }
};

/**
 * @desc    Get BOM by ID scoped to user's tenant
 * @route   GET /api/boms/:id
 * @access  Private (PRODUCTION:READ permission)
 */
const getBOMById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const bom = await BOM.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('finishedGood', 'name code')
            .populate({
                path: 'items.rawMaterial',
                select: 'name code uom',
                populate: { path: 'uom', select: 'name symbol' }
            });

        if (!bom) {
            return res.status(404).json({
                success: false,
                message: 'BOM not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: bom
        });
    } catch (error) {
        console.error('Error in getBOMById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve BOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Update BOM (full items replacement)
 * @route   PUT /api/boms/:id
 * @access  Private (PRODUCTION:UPDATE permission)
 */
const updateBOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const bom = await BOM.findOne({ _id: req.params.id, tenant: tenantId });
        if (!bom) {
            return res.status(404).json({
                success: false,
                message: 'BOM not found.'
            });
        }

        delete req.body.tenant;

        const { name, items, isActive, replaceExisting } = req.body;

        // If items are provided, validate full replacement
        if (items !== undefined) {
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'items must be a non-empty array.'
                });
            }

            const rawMaterialIds = new Set();
            for (const item of items) {
                if (!item.rawMaterial || !item.quantityPerUnit || Number(item.quantityPerUnit) <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each item must have a valid rawMaterial ObjectId and a positive quantityPerUnit > 0.'
                    });
                }

                const rmIdStr = String(item.rawMaterial);
                if (rawMaterialIds.has(rmIdStr)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate rawMaterial '${rmIdStr}' found in items array.`
                    });
                }
                rawMaterialIds.add(rmIdStr);
            }

            const foundRawMaterials = await RawMaterial.find({
                _id: { $in: Array.from(rawMaterialIds) },
                tenant: tenantId
            });

            if (foundRawMaterials.length !== rawMaterialIds.size) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more specified Raw Materials do not exist or do not belong to your organization.'
                });
            }

            bom.items = items.map(i => ({
                rawMaterial: i.rawMaterial,
                quantityPerUnit: Number(i.quantityPerUnit)
            }));
        }

        // Handle isActive state changes
        if (isActive !== undefined) {
            const newIsActive = Boolean(isActive);
            if (newIsActive && !bom.isActive) {
                // Changing from false to true -> check if another active BOM exists
                const existingActiveBom = await BOM.findOne({
                    finishedGood: bom.finishedGood,
                    tenant: tenantId,
                    isActive: true,
                    _id: { $ne: bom._id }
                });

                if (existingActiveBom) {
                    if (replaceExisting === true) {
                        existingActiveBom.isActive = false;
                        await existingActiveBom.save();
                    } else {
                        return res.status(400).json({
                            success: false,
                            message: 'Another active BOM already exists for this finished good. Pass "replaceExisting: true" to deactivate it automatically.'
                        });
                    }
                }
            }
            bom.isActive = newIsActive;
        }

        if (name !== undefined) {
            bom.name = String(name).trim();
        }

        await bom.save();

        await bom.populate([
            { path: 'finishedGood', select: 'name code' },
            { path: 'items.rawMaterial', select: 'name code uom' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'BOM updated successfully.',
            data: bom
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateBOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update BOM.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete BOM (isActive: false)
 * @route   DELETE /api/boms/:id
 * @access  Private (PRODUCTION:DELETE permission)
 */
const deleteBOM = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const bom = await BOM.findOne({ _id: req.params.id, tenant: tenantId });
        if (!bom) {
            return res.status(404).json({
                success: false,
                message: 'BOM not found.'
            });
        }

        bom.isActive = false;
        await bom.save();

        return res.status(200).json({
            success: true,
            message: 'BOM deactivated successfully.',
            data: bom
        });
    } catch (error) {
        console.error('Error in deleteBOM:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete BOM.',
            error: error.message
        });
    }
};

module.exports = {
    createBOM,
    getBOMs,
    getBOMById,
    updateBOM,
    deleteBOM
};
