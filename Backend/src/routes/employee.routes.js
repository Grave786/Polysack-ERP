const express = require('express');
const router = express.Router();
const {
    createEmployee,
    getEmployees,
    exportEmployeesCsv,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
} = require('../controllers/employee.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/employees
 * @desc    Create a new Employee
 * @access  Private (USERS:CREATE / MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('USERS', 'CREATE'), createEmployee);

/**
 * @route   GET /api/employees
 * @desc    Get all Employees for current tenant
 * @access  Private (USERS:READ / MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('USERS', 'READ'), getEmployees);

/**
 * @route   GET /api/employees/export-csv
 * @desc    Export Employees to CSV
 * @access  Private (USERS:READ / MASTER_DATA:READ)
 */
router.get('/export-csv', authenticate, checkPermission('USERS', 'READ'), exportEmployeesCsv);

/**
 * @route   GET /api/employees/:id
 * @desc    Get Employee by ID
 * @access  Private (USERS:READ / MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('USERS', 'READ'), getEmployeeById);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update Employee by ID
 * @access  Private (USERS:UPDATE / MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('USERS', 'UPDATE'), updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Soft delete Employee
 * @access  Private (USERS:DELETE / MASTER_DATA:DELETE)
 */
router.delete('/:id', authenticate, checkPermission('USERS', 'DELETE'), deleteEmployee);

module.exports = router;
