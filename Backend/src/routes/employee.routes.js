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

router.use(authenticate);

/**
 * @route   POST /api/employees
 * @desc    Create a new Employee
 * @access  Private (HR:CREATE)
 */
router.post('/', authenticate, checkPermission('HR', 'CREATE'), createEmployee);

/**
 * @route   GET /api/employees
 * @desc    Get all Employees for current tenant
 * @access  Private (HR:READ)
 */
router.get('/', authenticate, checkPermission('HR', 'READ'), getEmployees);

/**
 * @route   GET /api/employees/export
 * @desc    Export Employees to CSV
 * @access  Private (HR:READ)
 */
router.get('/export', authenticate, checkPermission('HR', 'READ'), exportEmployeesCsv);

/**
 * @route   GET /api/employees/export-csv
 * @desc    Export Employees to CSV (legacy alias)
 * @access  Private (HR:READ)
 */
router.get('/export-csv', authenticate, checkPermission('HR', 'READ'), exportEmployeesCsv);

/**
 * @route   GET /api/employees/:id
 * @desc    Get Employee by ID
 * @access  Private (HR:READ)
 */
router.get('/:id', authenticate, checkPermission('HR', 'READ'), getEmployeeById);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update Employee by ID
 * @access  Private (HR:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('HR', 'UPDATE'), updateEmployee);

/**
 * @route   PATCH /api/employees/:id
 * @desc    Update Employee by ID (Partial)
 * @access  Private (HR:UPDATE)
 */
router.patch('/:id', authenticate, checkPermission('HR', 'UPDATE'), updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Soft delete Employee
 * @access  Private (HR:DELETE)
 */
const Employee = require('../models/employee.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('HR', 'DELETE'), deleteEmployee);

/**
 * @route   POST /api/employees/bulk-delete
 * @desc    Bulk soft delete Employees
 * @access  Private (HR:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('HR', 'DELETE'), createBulkDeleteHandler(Employee, { resourceName: 'Employees' }));

module.exports = router;
