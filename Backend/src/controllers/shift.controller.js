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

        const { shiftCode, name, startTime, endTime, standardHours, gracePeriodMinutes } = req.body;

        if (!shiftCode || !name || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide shiftCode, name, startTime, and endTime.'
            });
        }

        const existingShift = await Shift.findOne({ shiftCode: shiftCode.trim().toUpperCase(), tenant: tenantId });
        if (existingShift) {
            return res.status(400).json({
                success: false,
                message: `Shift code '${shiftCode}' already exists for your organization.`
            });
        }

        const shift = new Shift({
            tenant: tenantId,
            shiftCode: shiftCode.trim().toUpperCase(),
            name: name.trim(),
            startTime: startTime.trim(),
            endTime: endTime.trim(),
            standardHours: standardHours !== undefined ? Number(standardHours) : 8,
            gracePeriodMinutes: gracePeriodMinutes !== undefined ? Number(gracePeriodMinutes) : 15,
            isActive: true
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

        const { search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId, isActive: true };

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
 * @route   PUT /api/shifts/:id
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

        const { name, startTime, endTime, standardHours, gracePeriodMinutes } = req.body;

        if (name) shift.name = name.trim();
        if (startTime) shift.startTime = startTime.trim();
        if (endTime) shift.endTime = endTime.trim();
        if (standardHours !== undefined) shift.standardHours = Number(standardHours);
        if (gracePeriodMinutes !== undefined) shift.gracePeriodMinutes = Number(gracePeriodMinutes);

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
            message: `Shift '${shift.name}' deleted successfully.`
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
    getShiftById,
    updateShift,
    deleteShift
};
