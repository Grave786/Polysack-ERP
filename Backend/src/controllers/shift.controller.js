const Shift = require('../models/shift.model');

/**
 * @desc    Create a new Work Shift
 * @route   POST /api/shifts
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createShift = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;

        const rawCode = req.body.shiftCode || req.body.code;
        const name = req.body.name;
        const startTime = req.body.startTime || '06:00';
        const endTime = req.body.endTime || '14:00';
        const standardHours = req.body.standardHours;
        const gracePeriodMinutes = req.body.gracePeriodMinutes;
        const isActive = req.body.isActive;

        if (!rawCode || !name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide shiftCode and name.'
            });
        }

        const formattedCode = rawCode.trim().toUpperCase();

        const existingShift = await Shift.findOne({ shiftCode: formattedCode, tenant: tenantId });
        if (existingShift) {
            return res.status(400).json({
                success: false,
                message: `Shift code '${formattedCode}' already exists for your organization.`
            });
        }

        const shift = new Shift({
            tenant: tenantId,
            shiftCode: formattedCode,
            name: name.trim(),
            startTime: String(startTime).trim(),
            endTime: String(endTime).trim(),
            standardHours: standardHours !== undefined ? Number(standardHours) : 8,
            gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : 15,
            isActive: isActive !== undefined ? isActive : true
        });

        await shift.save();

        return res.status(201).json({
            success: true,
            message: `Shift '${shift.name}' created successfully.`,
            data: shift
        });
    } catch (error) {
        console.error('Error in createShift:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create shift.'
        });
    }
};

/**
 * @desc    Get all Shifts for user's tenant
 * @route   GET /api/shifts
 * @access  Private (MASTER_DATA:READ permission)
 */
const getShifts = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { search, status, isActive, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId };

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.$or = [
                { shiftCode: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [shifts, total] = await Promise.all([
            Shift.find(filter).sort({ shiftCode: 1 }).skip(skip).limit(limitNum),
            Shift.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: shifts.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: shifts
        });
    } catch (error) {
        console.error('Error in getShifts:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch shifts.',
            error: error.message
        });
    }
};

/**
 * @desc    Seed standard shifts (Shift A, Shift B, Night Shift) if zero shifts exist
 * @route   POST /api/shifts/seed-default
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const seedDefaultShifts = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const existingCount = await Shift.countDocuments({ tenant: tenantId });
        if (existingCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Tenant already has ${existingCount} shift record(s). Default seeding is only available when no shifts exist.`
            });
        }

        const defaultShifts = [
            {
                tenant: tenantId,
                shiftCode: 'SHIFT_A',
                name: 'Shift A',
                startTime: '06:00',
                endTime: '14:00',
                standardHours: 8,
                gracePeriodMinutes: 15,
                isActive: true
            },
            {
                tenant: tenantId,
                shiftCode: 'SHIFT_B',
                name: 'Shift B',
                startTime: '14:00',
                endTime: '22:00',
                standardHours: 8,
                gracePeriodMinutes: 15,
                isActive: true
            },
            {
                tenant: tenantId,
                shiftCode: 'SHIFT_NIGHT',
                name: 'Night Shift',
                startTime: '22:00',
                endTime: '06:00',
                standardHours: 8,
                gracePeriodMinutes: 15,
                isActive: true
            }
        ];

        const inserted = await Shift.insertMany(defaultShifts);

        return res.status(201).json({
            success: true,
            message: 'Standard shifts (Shift A, Shift B, Night Shift) created successfully.',
            data: inserted
        });
    } catch (error) {
        console.error('Error in seedDefaultShifts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to seed default shifts.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Shift by ID
 * @route   GET /api/shifts/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getShiftById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const shift = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: shift
        });
    } catch (error) {
        console.error('Error in getShiftById:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve shift.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Shift details
 * @route   PUT /api/shifts/:id or PATCH /api/shifts/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateShift = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;

        const shift = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found.'
            });
        }

        const { shiftCode, name, startTime, endTime, standardHours, gracePeriodMinutes, isActive } = req.body;

        if (shiftCode && shiftCode.trim().toUpperCase() !== shift.shiftCode) {
            const formattedCode = shiftCode.trim().toUpperCase();
            const existingCode = await Shift.findOne({
                shiftCode: formattedCode,
                tenant: tenantId,
                _id: { $ne: shift._id }
            });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: `Shift code '${formattedCode}' already exists for your organization.`
                });
            }
            shift.shiftCode = formattedCode;
        }

        if (name) shift.name = name.trim();
        if (startTime) shift.startTime = startTime.trim();
        if (endTime) shift.endTime = endTime.trim();
        if (standardHours !== undefined) shift.standardHours = Number(standardHours);
        if (gracePeriodMinutes !== undefined) shift.gracePeriodMinutes = Number(gracePeriodMinutes);
        if (isActive !== undefined) shift.isActive = isActive;

        await shift.save();

        return res.status(200).json({
            success: true,
            message: `Shift '${shift.name}' updated successfully.`,
            data: shift
        });
    } catch (error) {
        console.error('Error in updateShift:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update shift.'
        });
    }
};

/**
 * @desc    Soft Delete Shift
 * @route   DELETE /api/shifts/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteShift = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const shift = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
        if (!shift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found.'
            });
        }

        shift.isActive = false;
        await shift.save();

        return res.status(200).json({
            success: true,
            message: `Shift '${shift.name}' deactivated successfully.`,
            data: shift
        });
    } catch (error) {
        console.error('Error in deleteShift:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to delete shift.',
            error: error.message
        });
    }
};

module.exports = {
    createShift,
    getShifts,
    seedDefaultShifts,
    getShiftById,
    updateShift,
    deleteShift
};
