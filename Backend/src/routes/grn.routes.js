const express = require('express');
const router = express.Router();
const {
    createGRN,
    getGRNs,
    getGRNById
} = require('../controllers/grn.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

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

// NOTE: No PUT or DELETE routes are exposed for GRNs because goods receipts are immutable audit records.

module.exports = router;
