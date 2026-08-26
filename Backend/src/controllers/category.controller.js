const Category = require('../models/category.model');
const RawMaterial = require('../models/rawMaterial.model');
const FinishedGood = require('../models/finishedGood.model');

/**
 * @desc    Create a new Category
 * @route   POST /api/categories
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createCategory = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { name, type, parentCategory, description, isActive } = req.body;

        // 1. Basic validation
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: name and type.'
            });
        }

        // 2. Validate parent category existence and tenant isolation
        const parentId = parentCategory || null;
        if (parentId) {
            const parentDoc = await Category.findOne({ _id: parentId, tenant: tenantId });
            if (!parentDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Parent category does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Check for duplicate name under same parent and tenant
        const existingCategory = await Category.findOne({
            name,
            tenant: tenantId,
            parentCategory: parentId
        });

        if (existingCategory) {
            if (existingCategory.isActive) {
                return res.status(400).json({
                    success: false,
                    message: `A category named '${name}' already exists under the selected parent.`
                });
            }

            // Reactivate soft-deleted category
            existingCategory.isActive = true;
            if (type) {
                existingCategory.type = type;
            }
            if (description !== undefined) {
                existingCategory.description = description;
            }

            await existingCategory.save();

            if (existingCategory.parentCategory) {
                await existingCategory.populate('parentCategory', 'name type');
            }

            return res.status(200).json({
                success: true,
                message: 'Category reactivated successfully.',
                data: existingCategory
            });
        }

        // 4. Create Category (tenant overridden from req.user.tenant)
        const category = new Category({
            name,
            type,
            parentCategory: parentId,
            description,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await category.save();

        if (category.parentCategory) {
            await category.populate('parentCategory', 'name type');
        }

        return res.status(201).json({
            success: true,
            message: 'Category created successfully.',
            data: category
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createCategory:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create category.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all categories scoped to user's tenant with filtering and pagination
 * @route   GET /api/categories
 * @access  Private (MASTER_DATA:READ permission)
 */
const getCategories = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { type, parentCategory, status, isActive, search, page = 1, limit = 20 } = req.query;

        // Filter strictly scoped to req.user.tenant
        const filter = { tenant: tenantId };

        if (type) {
            filter.type = type;
        }

        if (parentCategory !== undefined) {
            filter.parentCategory = parentCategory === 'null' || parentCategory === '' ? null : parentCategory;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [categories, total] = await Promise.all([
            Category.find(filter)
                .populate('parentCategory', 'name type')
                .sort({ name: 1 })
                .skip(skip)
                .limit(limitNum),
            Category.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: categories.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: categories
        });
    } catch (error) {
        console.error('Error in getCategories:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch categories.',
            error: error.message
        });
    }
};

/**
 * @desc    Get category by ID scoped to user's tenant
 * @route   GET /api/categories/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getCategoryById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const category = await Category.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('parentCategory', 'name type');

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error in getCategoryById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve category.',
            error: error.message
        });
    }
};

/**
 * @desc    Update category scoped to user's tenant
 * @route   PUT /api/categories/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateCategory = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const category = await Category.findOne({ _id: req.params.id, tenant: tenantId });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.'
            });
        }

        const { name, type, parentCategory, description, isActive } = req.body;

        // Prevent tenant modification
        delete req.body.tenant;

        const targetParent = parentCategory !== undefined 
            ? (parentCategory === '' || parentCategory === 'null' ? null : parentCategory)
            : category.parentCategory;

        const targetName = name || category.name;

        // Check unique constraint if name or parentCategory changes
        if (targetName !== category.name || String(targetParent) !== String(category.parentCategory)) {
            const existing = await Category.findOne({
                name: targetName,
                tenant: tenantId,
                parentCategory: targetParent,
                _id: { $ne: category._id }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `A category named '${targetName}' already exists under the target parent.`
                });
            }
        }

        if (name) category.name = name;
        if (type) category.type = type;
        if (parentCategory !== undefined) category.parentCategory = targetParent;
        if (description !== undefined) category.description = description;
        if (isActive !== undefined) category.isActive = isActive;

        await category.save();

        if (category.parentCategory) {
            await category.populate('parentCategory', 'name type');
        }

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully.',
            data: category
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateCategory:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update category.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete category (set isActive: false). Blocked if active child categories exist.
 * @route   DELETE /api/categories/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteCategory = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const category = await Category.findOne({ _id: req.params.id, tenant: tenantId });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found.'
            });
        }

        // Check if category has any active child categories
        const activeChild = await Category.findOne({
            parentCategory: category._id,
            tenant: tenantId,
            isActive: true
        });

        if (activeChild) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate category because it has active child categories. Please deactivate or reassign the child categories first.'
            });
        }

        // Check if active Raw Materials or Finished Goods reference this category
        const [linkedRawMaterials, linkedFinishedGoods] = await Promise.all([
            RawMaterial.countDocuments({ category: category._id, tenant: tenantId, isActive: true }),
            FinishedGood.countDocuments({ category: category._id, tenant: tenantId, isActive: true })
        ]);

        if (linkedRawMaterials > 0 || linkedFinishedGoods > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete this category because it is currently assigned to active items. Please reassign or delete those items first.'
            });
        }

        category.isActive = false;
        await category.save();

        return res.status(200).json({
            success: true,
            message: 'Category deactivated successfully.',
            data: category
        });
    } catch (error) {
        console.error('Error in deleteCategory:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete category.',
            error: error.message
        });
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
};
