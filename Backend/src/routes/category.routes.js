const express = require('express');
const router = express.Router();
const {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require('../controllers/category.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

/**
 * @route   POST /api/categories
 * @desc    Create a new Category
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createCategory);

/**
 * @route   GET /api/categories
 * @desc    Get all Categories for current tenant
 * @access  Private (Authenticated users)
 */
router.get('/', authenticate, getCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Get Category by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', authenticate, getCategoryById);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update Category by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateCategory);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Soft delete Category by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
const Category = require('../models/category.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteCategory);

/**
 * @route   POST /api/categories/bulk-delete
 * @desc    Bulk soft delete Categories
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(Category, { resourceName: 'Categories' }));

module.exports = router;
