const Location = require('../models/location.model');
const User = require('../models/user.model');

/**
 * @desc    Create a new Location / Facility
 * @route   POST /api/locations
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createLocation = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { name, code, type, address, city, state, isActive } = req.body;

        // 1. Validation
        if (!name || !code || !type) {
            return res.status(400).json({
                success: false,
                message: 'Please provide required fields: name, code, and type.'
            });
        }

        const formattedCode = String(code).trim().toUpperCase();

        // 2. Duplicate checks per tenant
        const existingName = await Location.findOne({ name: String(name).trim(), tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A location with the name '${name}' already exists in your organization.`
            });
        }

        const existingCode = await Location.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A location with the code '${formattedCode}' already exists in your organization.`
            });
        }

        // 3. Create Location
        const location = new Location({
            name,
            code: formattedCode,
            type,
            address,
            city,
            state,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await location.save();

        return res.status(201).json({
            success: true,
            message: 'Location created successfully.',
            data: location
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createLocation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create location.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all locations scoped to user's tenant
 * @route   GET /api/locations
 * @access  Private (MASTER_DATA:READ permission)
 */
const getLocations = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        const { type, status, isActive, search, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (tenantId) {
            filter.tenant = tenantId;
        } else {
            // Super Admin context (no tenant)
            const isSuperAdmin = !req.user?.tenant || req.user?.roleName === 'SUPER_ADMIN' || req.user?.role?.name === 'SUPER_ADMIN' || req.user?.email === 'superadmin@polysack.com';
            if (!isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Tenant context is missing or invalid. Please log in again.'
                });
            }
        }

        if (type) {
            filter.type = type;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [locations, total] = await Promise.all([
            Location.find(filter).sort({ name: 1 }).skip(skip).limit(limitNum),
            Location.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: locations.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: locations
        });
    } catch (error) {
        console.error('Error in getLocations:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch locations.',
            error: error.message
        });
    }
};

/**
 * @desc    Get location by ID scoped to user's tenant
 * @route   GET /api/locations/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getLocationById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const location = await Location.findOne({ _id: req.params.id, tenant: tenantId });

        if (!location) {
            return res.status(404).json({
                success: false,
                message: 'Location not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        console.error('Error in getLocationById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve location.',
            error: error.message
        });
    }
};

/**
 * @desc    Update location scoped to user's tenant
 * @route   PUT /api/locations/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateLocation = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const location = await Location.findOne({ _id: req.params.id, tenant: tenantId });

        if (!location) {
            return res.status(404).json({
                success: false,
                message: 'Location not found.'
            });
        }

        const { name, code, type, address, city, state, isActive } = req.body;

        // Prevent modifying tenant
        delete req.body.tenant;

        if (name && name.trim() !== location.name) {
            const existingName = await Location.findOne({
                name: name.trim(),
                tenant: tenantId,
                _id: { $ne: location._id }
            });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: `A location with the name '${name}' already exists in your organization.`
                });
            }
            location.name = name.trim();
        }

        if (code) {
            const formattedCode = String(code).trim().toUpperCase();
            if (formattedCode !== location.code) {
                const existingCode = await Location.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: location._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A location with the code '${formattedCode}' already exists in your organization.`
                    });
                }
                location.code = formattedCode;
            }
        }

        if (type) location.type = type;
        if (address !== undefined) location.address = address;
        if (city !== undefined) location.city = city;
        if (state !== undefined) location.state = state;
        if (isActive !== undefined) location.isActive = isActive;

        await location.save();

        return res.status(200).json({
            success: true,
            message: 'Location updated successfully.',
            data: location
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateLocation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update location.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete location (isActive: false) scoped to user's tenant
 * @route   DELETE /api/locations/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteLocation = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const location = await Location.findOne({ _id: req.params.id, tenant: tenantId });

        if (!location) {
            return res.status(404).json({
                success: false,
                message: 'Location not found.'
            });
        }

        // Check if any active user references this location
        const activeUser = await User.findOne({
            tenant: tenantId,
            isActive: true,
            $or: [
                { facility: location._id },
                { facility_id: location.code }
            ]
        });

        if (activeUser) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate location because active user accounts are currently assigned to it. Please reassign the users first.'
            });
        }

        location.isActive = false;
        await location.save();

        return res.status(200).json({
            success: true,
            message: 'Location deactivated successfully.',
            data: location
        });
    } catch (error) {
        console.error('Error in deleteLocation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete location.',
            error: error.message
        });
    }
};

module.exports = {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation
};
