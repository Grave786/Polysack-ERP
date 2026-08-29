const express = require('express');
const router = express.Router();
const {
    createQCInspection,
    getQCInspections,
    getQCInspectionById,
    getPendingQcTargets
} = require('../controllers/qcInspection.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('QUALITY'));

/**
 * @route   GET /api/qc-inspections/pending-targets
 * @desc    Get pending QC targets with remaining uninspected quantities
 * @access  Private (QUALITY:READ)
 */
router.get('/pending-targets', authenticate, checkPermission('QUALITY', 'READ'), getPendingQcTargets);

/**
 * @route   POST /api/qc-inspections
 * @desc    Create a new Quality Control Inspection
 * @access  Private (QUALITY:CREATE)
 */
router.post('/', authenticate, checkPermission('QUALITY', 'CREATE'), createQCInspection);

/**
 * @route   GET /api/qc-inspections
 * @desc    Get all QC Inspections for current tenant
 * @access  Private (QUALITY:READ)
 */
router.get('/', authenticate, checkPermission('QUALITY', 'READ'), getQCInspections);

/**
 * @route   GET /api/qc-inspections/:id
 * @desc    Get QC Inspection by ID
 * @access  Private (QUALITY:READ)
 */
router.get('/:id', authenticate, checkPermission('QUALITY', 'READ'), getQCInspectionById);

const QCInspection = require('../models/qcInspection.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

/**
 * Immutable Audit Record Route Guards
 */
const rejectQCModification = (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'QC Inspection records are immutable quality audit records and cannot be modified or deleted after creation.'
    });
};

router.put('/:id', authenticate, rejectQCModification);
router.patch('/:id', authenticate, rejectQCModification);
router.delete('/:id', authenticate, rejectQCModification);
router.post('/bulk-delete', authenticate, createBulkDeleteHandler(QCInspection, { resourceName: 'QC Inspections', isImmutable: true }));

module.exports = router;
