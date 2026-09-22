const express = require('express');
const router = express.Router();
const {
    createMaterialReceipt,
    getMaterialReceipts,
    getMaterialReceiptById
} = require('../controllers/materialReceipt.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

// All routes require authentication + PROCUREMENT module
router.use(authenticate);
router.use(checkTenantModule('PROCUREMENT'));

/**
 * @route   POST /api/material-receipts
 * @desc    Log a new Job-Work / Purchase Material Receipt (create-only, audit record)
 * @access  Private (PROCUREMENT:CREATE)
 */
router.post('/', checkPermission('PROCUREMENT', 'CREATE'), createMaterialReceipt);

/**
 * @route   GET /api/material-receipts
 * @desc    List all Material Receipts for current tenant
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/', checkPermission('PROCUREMENT', 'READ'), getMaterialReceipts);

/**
 * @route   GET /api/material-receipts/:id
 * @desc    Get a single Material Receipt by ID
 * @access  Private (PROCUREMENT:READ)
 */
router.get('/:id', checkPermission('PROCUREMENT', 'READ'), getMaterialReceiptById);

// ─── Immutability enforcement ──────────────────────────────────────────────────
// Material Receipts are audit records and CANNOT be modified or deleted after creation.
const rejectModification = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'Material Receipt records are immutable audit records and cannot be modified or deleted after creation.'
    });
};

router.put('/:id', rejectModification);
router.patch('/:id', rejectModification);
router.delete('/:id', rejectModification);

module.exports = router;
