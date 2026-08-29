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

// NOTE: No PUT or DELETE routes are exposed for QCInspections because audit records are immutable once issued.

module.exports = router;
