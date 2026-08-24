const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Role = require('../models/role.model');

/**
 * @desc    Create a new user scoped to current tenant
 * @route   POST /api/users
 * @access  Private (USERS:CREATE permission)
 */
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, facility_id } = req.body;
        const userTenant = req.user?.tenant || null;

        // 1. Validate required input
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: name, email, password, and role.'
            });
        }

        // 2. Check duplicate email
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        // 3. Verify role existence and tenant scope
        const roleDoc = await Role.findById(role);
        if (!roleDoc) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID provided.'
            });
        }
        if (!roleDoc.isActive) {
            return res.status(400).json({
                success: false,
                message: 'The selected role is inactive.'
            });
        }

        // Enforce that role belongs to the caller's tenant
        if (userTenant && roleDoc.tenant && roleDoc.tenant.toString() !== userTenant.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: The selected role does not belong to your organization.'
            });
        }

        // 4. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Create user linked strictly to caller's tenant
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            tenant: userTenant,
            facility_id: facility_id || 'MAIN_UNIT',
            isActive: true
        });

        // 6. Exclude password from response
        const userResponse = newUser.toObject();
        delete userResponse.password;

        return res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: userResponse
        });
    } catch (error) {
        console.error('Error in createUser controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create user.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all users scoped strictly to current tenant
 * @route   GET /api/users
 * @access  Private (USERS:READ permission)
 */
const getUsers = async (req, res) => {
    try {
        const userTenant = req.user?.tenant || null;

        // Fetch users strictly filtered by caller's tenant, excluding password
        const users = await User.find({ tenant: userTenant })
            .select('-password')
            .populate({
                path: 'role',
                populate: {
                    path: 'permissions'
                }
            });

        return res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Error in getUsers controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve users.',
            error: error.message
        });
    }
};

module.exports = {
    createUser,
    getUsers
};
