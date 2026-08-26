const mongoose = require('mongoose');
const Roster = require('../models/roster.model');
const Employee = require('../models/employee.model');
const Shift = require('../models/shift.model');

/**
 * @desc    Assign Shift Roster to Employee(s)
 * @route   POST /api/rosters
 * @access  Private (USERS:CREATE / MASTER_DATA:CREATE permission)
 */
const createRoster = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const {
            employee,
            employees,
            shift,
            startDate,
            endDate,
            overtimeRule
        } = req.body;

        const targetEmployeeIds = Array.isArray(employees) && employees.length > 0
            ? employees
            : (employee ? [employee] : []);

        if (targetEmployeeIds.length === 0 || !shift || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please select at least one Employee, Shift, Start Date, and End Date.'
            });
        }

        const shiftDoc = await Shift.findOne({ _id: shift, tenant: tenantId, isActive: true });
        if (!shiftDoc) {
            return res.status(400).json({
                success: false,
                message: 'Selected Shift master not found or is inactive.'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        let initialStatus = 'ACTIVE';
        if (start > today) {
            initialStatus = 'UPCOMING';
        } else if (end < today) {
            initialStatus = 'COMPLETED';
        }

        const createdRosters = [];

        for (const empId of targetEmployeeIds) {
            const empDoc = await Employee.findOne({ _id: empId, tenant: tenantId });
            if (!empDoc) continue;

            const roster = new Roster({
                tenant: tenantId,
                employee: empDoc._id,
                shift: shiftDoc._id,
                startDate: start,
                endDate: end,
                overtimeRule: overtimeRule || 'REQUIRES_APPROVAL',
                status: initialStatus,
                assignedBy: req.user._id || req.user.id
            });

            await roster.save();

            // Update Employee's current shift assignment if active
            if (initialStatus === 'ACTIVE') {
                empDoc.shiftAssignment = shiftDoc._id;
                await empDoc.save();
            }

            await roster.populate([
                { path: 'employee', select: 'employeeCode name department designation' },
                { path: 'shift', select: 'shiftCode name startTime endTime standardHours' }
            ]);

            createdRosters.push(roster);
        }

        return res.status(201).json({
            success: true,
            message: `Shift Roster assigned successfully to ${createdRosters.length} employee(s).`,
            data: createdRosters
        });
    } catch (error) {
        console.error('Error in createRoster:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to assign shift roster.'
        });
    }
};

/**
 * @desc    Get all Shift Rosters with pagination and filters
 * @route   GET /api/rosters
 * @access  Private (USERS:READ / MASTER_DATA:READ permission)
 */
const getRosters = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, shift, employee, search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId, isActive: true };

        if (status && status !== 'All Statuses' && status !== 'All') {
            filter.status = status.toUpperCase();
        }

        if (shift) filter.shift = shift;
        if (employee) filter.employee = employee;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [rosters, total] = await Promise.all([
            Roster.find(filter)
                .populate('employee', 'employeeCode name department designation')
                .populate('shift', 'shiftCode name startTime endTime standardHours')
                .sort({ startDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Roster.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: rosters.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: rosters
        });
    } catch (error) {
        console.error('Error in getRosters:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch shift rosters.',
            error: error.message
        });
    }
};

/**
 * @desc    Delete Shift Roster
 * @route   DELETE /api/rosters/:id
 * @access  Private
 */
const deleteRoster = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }

        const roster = await Roster.findOne({ _id: req.params.id, tenant: tenantId });
        if (!roster) {
            return res.status(404).json({
                success: false,
                message: 'Shift Roster not found.'
            });
        }

        roster.isActive = false;
        await roster.save();

        return res.status(200).json({
            success: true,
            message: 'Shift Roster deleted successfully.'
        });
    } catch (error) {
        console.error('Error in deleteRoster:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete shift roster.'
        });
    }
};

module.exports = {
    createRoster,
    getRosters,
    deleteRoster
};
