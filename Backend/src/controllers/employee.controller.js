const Employee = require('../models/employee.model');
const Shift = require('../models/shift.model');
const Location = require('../models/location.model');
const User = require('../models/user.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * Helper function to auto-generate unique Employee code per tenant (EMP-0001, EMP-0002...)
 */
const generateEmployeeCode = async (tenantId) => {
    const prefix = 'EMP-';

    const lastEmployee = await Employee.findOne({
        tenant: tenantId,
        employeeCode: { $regex: `^${prefix}\\d{4,}$` }
    }).sort({ employeeCode: -1 });

    let nextNumber = 1;
    if (lastEmployee && lastEmployee.employeeCode) {
        const parts = lastEmployee.employeeCode.split('-');
        const lastSeq = parseInt(parts[1], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

/**
 * @desc    Create a new Employee (Plant Workforce Staff / Master Data)
 * @route   POST /api/employees
 * @access  Private (USERS:CREATE / MASTER_DATA:CREATE permission)
 */
const createEmployee = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;
        delete req.body.employeeCode;

        const {
            name,
            department,
            designation,
            dateOfJoining,
            shiftAssignment,
            facility,
            linkedUser,
            monthlySalary,
            isActive
        } = req.body;

        if (!name || !department || !shiftAssignment || !facility) {
            return res.status(400).json({
                success: false,
                message: 'Please provide required fields: name, department, shiftAssignment, and facility.'
            });
        }

        // Validate Shift existence
        const shiftDoc = await Shift.findOne({ _id: shiftAssignment, tenant: tenantId, isActive: true });
        if (!shiftDoc) {
            return res.status(400).json({
                success: false,
                message: 'Assigned Shift does not exist or does not belong to your organization.'
            });
        }

        // Validate Facility / Location existence
        const locationDoc = await Location.findOne({ _id: facility, tenant: tenantId, isActive: true });
        if (!locationDoc) {
            return res.status(400).json({
                success: false,
                message: 'Assigned Facility / Location does not exist or does not belong to your organization.'
            });
        }

        // Validate optional Linked User
        if (linkedUser) {
            const userDoc = await User.findOne({ _id: linkedUser, tenant: tenantId, isActive: true });
            if (!userDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Linked User does not exist or does not belong to your organization.'
                });
            }
        }

        const employeeCode = await generateEmployeeCode(tenantId);

        const employee = new Employee({
            tenant: tenantId,
            employeeCode,
            name: name.trim(),
            department,
            designation: designation ? designation.trim() : undefined,
            dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
            shiftAssignment,
            facility,
            linkedUser: linkedUser || null,
            monthlySalary: monthlySalary !== undefined ? Number(monthlySalary) : 0,
            isActive: isActive !== undefined ? isActive : true
        });

        await employee.save();

        await employee.populate([
            { path: 'shiftAssignment', select: 'shiftCode name startTime endTime' },
            { path: 'facility', select: 'name code type' },
            { path: 'linkedUser', select: 'name email role' }
        ]);

        const responseData = employee.toObject();
        responseData.code = employeeCode;

        return res.status(201).json({
            success: true,
            message: `Employee '${employee.name}' (${employeeCode}) created successfully.`,
            data: responseData
        });
    } catch (error) {
        console.error('Error in createEmployee:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create employee.'
        });
    }
};

/**
 * @desc    Get all Employees for user's tenant
 * @route   GET /api/employees
 * @access  Private (USERS:READ / MASTER_DATA:READ permission)
 */
const getEmployees = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { department, facility, shift, status, isActive, search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId };

        if (department) filter.department = department;
        if (facility) filter.facility = facility;
        if (shift) filter.shiftAssignment = shift;
        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

        if (search) {
            filter.$or = [
                { employeeCode: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { designation: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [employees, total] = await Promise.all([
            Employee.find(filter)
                .populate('shiftAssignment', 'shiftCode name startTime endTime standardHours')
                .populate('facility', 'name code type')
                .populate('linkedUser', 'name email role')
                .sort({ employeeCode: 1 })
                .skip(skip)
                .limit(limitNum),
            Employee.countDocuments(filter)
        ]);

        const formattedList = employees.map((emp) => {
            const obj = emp.toObject();
            obj.code = emp.employeeCode;
            return obj;
        });

        return res.status(200).json({
            success: true,
            count: formattedList.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: formattedList
        });
    } catch (error) {
        console.error('Error in getEmployees:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employees.',
            error: error.message
        });
    }
};

/**
 * @desc    Export Employees to CSV
 * @route   GET /api/employees/export or GET /api/employees/export-csv
 * @access  Private (USERS:READ / MASTER_DATA:READ permission)
 */
const exportEmployeesCsv = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { department, facility, shift, status, isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (department) filter.department = department;
        if (facility) filter.facility = facility;
        if (shift) filter.shiftAssignment = shift;
        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

        if (search) {
            filter.$or = [
                { employeeCode: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { designation: { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await Employee.find(filter)
            .populate('shiftAssignment', 'name shiftCode')
            .populate('facility', 'name')
            .sort({ employeeCode: 1 });

        const fields = [
            { label: 'Employee Code', key: 'employeeCode' },
            { label: 'Employee Name', key: 'name' },
            { label: 'Department', key: (e) => e.department || '' },
            { label: 'Designation', key: (e) => e.designation || '' },
            { label: 'Shift', key: (e) => (typeof e.shiftAssignment === 'object' ? e.shiftAssignment?.name : '') || '' },
            { label: 'Facility', key: (e) => (typeof e.facility === 'object' ? e.facility?.name : '') || '' },
            { label: 'Monthly Salary (INR)', key: (e) => e.monthlySalary || 0 },
            { label: 'Is Active', key: (e) => e.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(employees, fields);
        return sendCsvResponse(res, `employees_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportEmployeesCsv:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export employees to CSV.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Employee by ID
 * @route   GET /api/employees/:id
 * @access  Private (USERS:READ / MASTER_DATA:READ permission)
 */
const getEmployeeById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const employee = await Employee.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('shiftAssignment', 'shiftCode name startTime endTime standardHours gracePeriodMinutes')
            .populate('facility', 'name code type')
            .populate('linkedUser', 'name email role');

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found.'
            });
        }

        const responseData = employee.toObject();
        responseData.code = employee.employeeCode;

        return res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error in getEmployeeById:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve employee.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Employee details
 * @route   PUT /api/employees/:id or PATCH /api/employees/:id
 * @access  Private (USERS:UPDATE / MASTER_DATA:UPDATE permission)
 */
const updateEmployee = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;
        delete req.body.employeeCode;

        const employee = await Employee.findOne({ _id: req.params.id, tenant: tenantId });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found.'
            });
        }

        const {
            name,
            department,
            designation,
            dateOfJoining,
            shiftAssignment,
            facility,
            linkedUser,
            monthlySalary,
            isActive
        } = req.body;

        if (name) employee.name = name.trim();
        if (department) employee.department = department;
        if (designation !== undefined) employee.designation = designation ? designation.trim() : '';
        if (dateOfJoining) employee.dateOfJoining = new Date(dateOfJoining);
        if (monthlySalary !== undefined) employee.monthlySalary = Number(monthlySalary);
        if (isActive !== undefined) employee.isActive = isActive;

        if (shiftAssignment) {
            const shiftDoc = await Shift.findOne({ _id: shiftAssignment, tenant: tenantId, isActive: true });
            if (!shiftDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned Shift does not exist or does not belong to your organization.'
                });
            }
            employee.shiftAssignment = shiftAssignment;
        }

        if (facility) {
            const locationDoc = await Location.findOne({ _id: facility, tenant: tenantId, isActive: true });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned Facility / Location does not exist or does not belong to your organization.'
                });
            }
            employee.facility = facility;
        }

        if (linkedUser !== undefined) {
            if (linkedUser) {
                const userDoc = await User.findOne({ _id: linkedUser, tenant: tenantId, isActive: true });
                if (!userDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Linked User does not exist or does not belong to your organization.'
                    });
                }
                employee.linkedUser = linkedUser;
            } else {
                employee.linkedUser = null;
            }
        }

        await employee.save();

        await employee.populate([
            { path: 'shiftAssignment', select: 'shiftCode name startTime endTime' },
            { path: 'facility', select: 'name code type' },
            { path: 'linkedUser', select: 'name email role' }
        ]);

        const responseData = employee.toObject();
        responseData.code = employee.employeeCode;

        return res.status(200).json({
            success: true,
            message: `Employee '${employee.name}' updated successfully.`,
            data: responseData
        });
    } catch (error) {
        console.error('Error in updateEmployee:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update employee.'
        });
    }
};

/**
 * @desc    Soft Delete Employee
 * @route   DELETE /api/employees/:id
 * @access  Private (USERS:DELETE / MASTER_DATA:DELETE permission)
 */
const deleteEmployee = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const employee = await Employee.findOne({ _id: req.params.id, tenant: tenantId });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found.'
            });
        }

        employee.isActive = false;
        await employee.save();

        return res.status(200).json({
            success: true,
            message: `Employee '${employee.name}' deactivated successfully.`,
            data: employee
        });
    } catch (error) {
        console.error('Error in deleteEmployee:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to delete employee.',
            error: error.message
        });
    }
};

module.exports = {
    createEmployee,
    getEmployees,
    exportEmployeesCsv,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
};
