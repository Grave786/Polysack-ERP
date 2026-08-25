const mongoose = require('mongoose');
const AttendanceLog = require('../models/attendanceLog.model');
const Employee = require('../models/employee.model');
const Shift = require('../models/shift.model');

/**
 * Helper to calculate server-computed hoursWorked, overtimeHours, and attendance status
 */
const calculateAttendanceMetrics = (checkIn, checkOut, shiftDoc, statusOverride) => {
    if (statusOverride === 'ON_LEAVE') {
        return { hoursWorked: 0, overtimeHours: 0, status: 'ON_LEAVE' };
    }

    if (statusOverride === 'ABSENT') {
        return { hoursWorked: 0, overtimeHours: 0, status: 'ABSENT' };
    }

    if (!checkIn) {
        return { hoursWorked: 0, overtimeHours: 0, status: 'ABSENT' };
    }

    if (checkIn && !checkOut) {
        return { hoursWorked: 0, overtimeHours: 0, status: 'INCOMPLETE' };
    }

    const inTime = new Date(checkIn).getTime();
    const outTime = new Date(checkOut).getTime();

    if (isNaN(inTime) || isNaN(outTime)) {
        throw new Error('Invalid checkIn or checkOut timestamp format.');
    }

    if (outTime < inTime) {
        throw new Error('checkOut timestamp cannot be earlier than checkIn timestamp.');
    }

    const diffMs = outTime - inTime;
    const hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    const stdHours = shiftDoc?.standardHours || 8;
    const overtimeHours = Number(Math.max(0, hoursWorked - stdHours).toFixed(2));

    let status = 'PRESENT';
    if (hoursWorked > 0 && hoursWorked < (stdHours / 2)) {
        status = 'HALF_DAY';
    } else if (hoursWorked === 0) {
        status = 'ABSENT';
    }

    return {
        hoursWorked,
        overtimeHours,
        status: statusOverride || status
    };
};

/**
 * @desc    Manual Punch / Attendance Log Entry
 * @route   POST /api/attendance/manual-punch
 * @access  Private (USERS:CREATE / MASTER_DATA:CREATE permission)
 */
const manualPunch = async (req, res) => {
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
            shift,
            date,
            checkIn,
            checkOut,
            status,
            remarks
        } = req.body;

        if (!employee || !date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide employee ObjectId and attendance calendar date.'
            });
        }

        const calendarDate = new Date(date);
        if (isNaN(calendarDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid calendar date format (expected YYYY-MM-DD).'
            });
        }
        calendarDate.setUTCHours(0, 0, 0, 0);

        // Check if AttendanceLog already exists for this employee on this calendar date
        const existingLog = await AttendanceLog.findOne({
            tenant: tenantId,
            employee,
            date: calendarDate
        });

        if (existingLog) {
            return res.status(400).json({
                success: false,
                message: `Attendance log already exists for this employee on ${calendarDate.toISOString().split('T')[0]}. Duplicate punches are not allowed.`
            });
        }

        // Fetch Employee
        const employeeDoc = await Employee.findOne({ _id: employee, tenant: tenantId, isActive: true });
        if (!employeeDoc) {
            return res.status(400).json({
                success: false,
                message: 'Employee not found or is inactive.'
            });
        }

        // Fetch assigned or specified Shift
        const shiftId = shift || employeeDoc.shiftAssignment;
        const shiftDoc = await Shift.findOne({ _id: shiftId, tenant: tenantId, isActive: true });
        if (!shiftDoc) {
            return res.status(400).json({
                success: false,
                message: 'Assigned shift not found or is inactive.'
            });
        }

        // Calculate metrics
        const metrics = calculateAttendanceMetrics(checkIn, checkOut, shiftDoc, status);

        const attendanceLog = new AttendanceLog({
            tenant: tenantId,
            employee: employeeDoc._id,
            shift: shiftDoc._id,
            date: calendarDate,
            checkIn: checkIn ? new Date(checkIn) : null,
            checkOut: checkOut ? new Date(checkOut) : null,
            source: 'MANUAL',
            hoursWorked: metrics.hoursWorked,
            overtimeHours: metrics.overtimeHours,
            status: metrics.status,
            remarks: remarks ? remarks.trim() : undefined,
            loggedBy: req.user._id || req.user.id
        });

        await attendanceLog.save();

        await attendanceLog.populate([
            { path: 'employee', select: 'employeeCode name department designation' },
            { path: 'shift', select: 'shiftCode name startTime endTime standardHours' },
            { path: 'loggedBy', select: 'name email' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Attendance log logged successfully for ${employeeDoc.name} on ${calendarDate.toISOString().split('T')[0]}.`,
            data: attendanceLog
        });
    } catch (error) {
        console.error('Error in manualPunch:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to record manual attendance punch.'
        });
    }
};

/**
 * @desc    Get Attendance Logs with filtering and pagination
 * @route   GET /api/attendance
 * @access  Private (USERS:READ / MASTER_DATA:READ permission)
 */
const getAttendanceLogs = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const {
            startDate,
            endDate,
            employee,
            department,
            facility,
            shift,
            status,
            page = 1,
            limit = 20
        } = req.query;

        const filter = { tenant: tenantId };

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setUTCHours(0, 0, 0, 0);
                filter.date.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        if (employee) filter.employee = employee;
        if (shift) filter.shift = shift;
        if (status) filter.status = status;

        // If department or facility filter is specified, query matching Employee ObjectIds
        if (department || facility) {
            const empFilter = { tenant: tenantId, isActive: true };
            if (department) empFilter.department = department;
            if (facility) empFilter.facility = facility;

            const matchingEmps = await Employee.find(empFilter).select('_id');
            const empIds = matchingEmps.map(e => e._id);
            filter.employee = { $in: empIds };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [logs, total] = await Promise.all([
            AttendanceLog.find(filter)
                .populate({
                    path: 'employee',
                    select: 'employeeCode name department designation facility',
                    populate: { path: 'facility', select: 'name code' }
                })
                .populate('shift', 'shiftCode name startTime endTime standardHours')
                .populate('loggedBy', 'name email')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            AttendanceLog.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: logs.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: logs
        });
    } catch (error) {
        console.error('Error in getAttendanceLogs:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance logs.',
            error: error.message
        });
    }
};

/**
 * @desc    Import Biometric Attendance CSV File
 * @route   POST /api/attendance/biometric-import
 * @access  Private (USERS:CREATE / MASTER_DATA:CREATE permission)
 */
const importBiometricCsv = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a valid CSV file.'
            });
        }

        const { Readable } = require('stream');
        const csvParser = require('csv-parser');

        const rows = [];
        await new Promise((resolve, reject) => {
            const stream = Readable.from(req.file.buffer);
            stream
                .pipe(csvParser())
                .on('data', (data) => rows.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Uploaded CSV file is empty.'
            });
        }

        // Fetch all active Employees for tenant and map by uppercase employeeCode
        const activeEmployees = await Employee.find({ tenant: tenantId, isActive: true })
            .populate('shiftAssignment', 'shiftCode name startTime endTime standardHours');

        const employeeMap = new Map();
        for (const emp of activeEmployees) {
            if (emp.employeeCode) {
                employeeMap.set(emp.employeeCode.trim().toUpperCase(), emp);
            }
        }

        let totalRows = rows.length;
        let inserted = 0;
        let updated = 0;
        let failed = 0;
        const errors = [];
        const bulkOps = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 1;

            const empCode = row.employeeCode ? String(row.employeeCode).trim().toUpperCase() : null;
            const dateStr = row.date ? String(row.date).trim() : null;
            const checkInRaw = row.checkIn ? String(row.checkIn).trim() : null;
            const checkOutRaw = row.checkOut ? String(row.checkOut).trim() : null;

            if (!empCode || !dateStr || !checkInRaw) {
                failed++;
                errors.push({ row: rowIndex, message: 'Missing required columns: employeeCode, date, or checkIn.' });
                continue;
            }

            const employeeDoc = employeeMap.get(empCode);
            if (!employeeDoc) {
                failed++;
                errors.push({ row: rowIndex, message: `Employee code '${empCode}' not found.` });
                continue;
            }

            const calendarDate = new Date(dateStr);
            if (isNaN(calendarDate.getTime())) {
                failed++;
                errors.push({ row: rowIndex, message: `Invalid date format '${dateStr}' (expected YYYY-MM-DD).` });
                continue;
            }
            calendarDate.setUTCHours(0, 0, 0, 0);

            // Parse CheckIn
            let parsedCheckIn = null;
            if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(checkInRaw)) {
                parsedCheckIn = new Date(`${dateStr}T${checkInRaw}:00.000Z`);
            } else {
                parsedCheckIn = new Date(checkInRaw);
            }

            if (isNaN(parsedCheckIn.getTime())) {
                failed++;
                errors.push({ row: rowIndex, message: `Invalid checkIn timestamp '${checkInRaw}'.` });
                continue;
            }

            // Parse CheckOut (optional)
            let parsedCheckOut = null;
            if (checkOutRaw) {
                if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(checkOutRaw)) {
                    parsedCheckOut = new Date(`${dateStr}T${checkOutRaw}:00.000Z`);
                    if (parsedCheckOut < parsedCheckIn) {
                        parsedCheckOut.setDate(parsedCheckOut.getDate() + 1);
                    }
                } else {
                    parsedCheckOut = new Date(checkOutRaw);
                }

                if (isNaN(parsedCheckOut.getTime())) {
                    parsedCheckOut = null;
                }
            }

            // Calculate metrics
            const shiftDoc = employeeDoc.shiftAssignment;
            const stdHours = shiftDoc?.standardHours || 8;

            let hoursWorked = 0;
            let overtimeHours = 0;
            let status = 'INCOMPLETE';

            if (parsedCheckIn && parsedCheckOut) {
                const diffMs = parsedCheckOut.getTime() - parsedCheckIn.getTime();
                if (diffMs >= 0) {
                    hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
                    overtimeHours = Number(Math.max(0, hoursWorked - stdHours).toFixed(2));

                    if (hoursWorked >= (stdHours / 2)) {
                        status = 'PRESENT';
                    } else if (hoursWorked > 0) {
                        status = 'HALF_DAY';
                    } else {
                        status = 'ABSENT';
                    }
                }
            }

            bulkOps.push({
                updateOne: {
                    filter: {
                        tenant: tenantId,
                        employee: employeeDoc._id,
                        date: calendarDate
                    },
                    update: {
                        $set: {
                            tenant: tenantId,
                            employee: employeeDoc._id,
                            shift: shiftDoc ? shiftDoc._id : employeeDoc.shiftAssignment,
                            date: calendarDate,
                            checkIn: parsedCheckIn,
                            checkOut: parsedCheckOut,
                            source: 'BIOMETRIC',
                            hoursWorked,
                            overtimeHours,
                            status,
                            loggedBy: req.user._id || req.user.id
                        }
                    },
                    upsert: true
                }
            });
        }

        if (bulkOps.length > 0) {
            const bulkResult = await AttendanceLog.bulkWrite(bulkOps);
            inserted = bulkResult.upsertedCount || 0;
            updated = (bulkResult.modifiedCount || 0) + ((bulkResult.matchedCount || 0) - (bulkResult.upsertedCount || 0));
        }

        return res.status(200).json({
            success: true,
            message: `Biometric CSV import processed: ${inserted} inserted, ${updated} updated, ${failed} failed.`,
            data: {
                totalRows,
                inserted,
                updated,
                failed,
                errors
            }
        });
    } catch (error) {
        console.error('Error in importBiometricCsv:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process biometric CSV import.',
            error: error.message
        });
    }
};

module.exports = {
    manualPunch,
    getAttendanceLogs,
    importBiometricCsv
};
