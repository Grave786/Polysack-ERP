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
 * @access  Private (USERS:CREATE)
 */
router.post('/manual-punch', authenticate, checkPermission('USERS', 'CREATE'), manualPunch);

/**
 * @route   POST /api/attendance/biometric-import
 * @desc    Import Biometric Attendance CSV File
 * @access  Private (USERS:CREATE)
 */
router.post('/biometric-import', authenticate, checkPermission('USERS', 'CREATE'), upload.single('file'), importBiometricCsv);

/**
 * @route   GET /api/attendance
 * @desc    Get Attendance Logs with filtering and pagination
 * @access  Private (USERS:READ)
 */
router.get('/', authenticate, checkPermission('USERS', 'READ'), getAttendanceLogs);

module.exports = router;
