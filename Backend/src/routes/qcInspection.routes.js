const express = require('express');
const router = express.Router();
const {
    createQCInspection,
    getQCInspections,
    getQCInspectionById
} = require('../controllers/qcInspection.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

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
