const express = require('express');
const router = express.Router();
const {
    createGRN,
    getGRNs,
    getGRNById,
    updateGRN
} = require('../controllers/grn.controller');
const { authenticate, checkPermission, checkTenantModule, requireTenantAdmin } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('PROCUREMENT'));

/**
 * @route   POST /api/grns
 * @desc    Process a Goods Receipt Note (Atomically updates stock & PO status)
 * @access  Private (PROCUREMENT:CREATE)
 */
router.post('/', authenticate, checkPermission('PROCUREMENT', 'CREATE'), createGRN);

/**
 * @route   GET /api/grns
 * @desc    Get all GRNs for current tenant
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/', authenticate, checkPermission('PROCUREMENT', 'READ'), getGRNs);

/**
 * @route   GET /api/grns/:id
 * @desc    Get GRN by ID
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/:id', authenticate, checkPermission('PROCUREMENT', 'READ'), getGRNById);

/**
 * @route   PUT /api/grns/:id
 * @desc    Update a Goods Receipt Note (Tenant Admin only)
 * @access  Private (Tenant Admin only)
 */
router.put('/:id', authenticate, requireTenantAdmin, updateGRN);
router.patch('/:id', authenticate, requireTenantAdmin, updateGRN);

const GRN = require('../models/grn.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

const rejectGRNDeletion = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Goods Receipt Note (GRN) records cannot be deleted after receipt.'
    });
};

router.delete('/:id', authenticate, rejectGRNDeletion);
router.post('/bulk-delete', authenticate, createBulkDeleteHandler(GRN, { resourceName: 'GRNs', isImmutable: true }));

module.exports = router;
