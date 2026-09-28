const express = require('express');
const router = express.Router();
const multer = require('multer');
const { manualPunch, getAttendanceLogs, importBiometricCsv } = require('../controllers/attendance.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('HR'));

// Multer memory storage configuration for CSV uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * @route   POST /api/attendance/manual-punch
 * @desc    Manual Punch / Attendance Log Entry
 * @access  Private (HR:CREATE)
 */
router.post('/manual-punch', authenticate, checkPermission('HR', 'CREATE'), manualPunch);

/**
 * @route   POST /api/attendance/biometric-import
 * @desc    Import Biometric Attendance CSV File
 * @access  Private (HR:CREATE)
 */
router.post('/biometric-import', authenticate, checkPermission('HR', 'CREATE'), upload.single('file'), importBiometricCsv);

/**
 * @route   GET /api/attendance
 * @desc    Get Attendance Logs with filtering and pagination
 * @access  Private (HR:READ)
 */
router.get('/', authenticate, checkPermission('HR', 'READ'), getAttendanceLogs);

module.exports = router;
