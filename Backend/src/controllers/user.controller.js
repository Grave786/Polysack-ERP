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

/**
 * @desc    Toggle user active/inactive status (Soft delete)
 * @route   PATCH /api/users/:id/toggle-active
 * @access  Private (USERS:DELETE / USERS:UPDATE permission)
 */
const toggleUserActive = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = String(req.user?._id || req.user?.id);

        if (String(id) === currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'You cannot deactivate your own account.'
            });
        }

        const userTenant = req.user?.tenant || null;
        const userDoc = await User.findOne({ _id: id, tenant: userTenant });
        if (!userDoc) {
            return res.status(404).json({
                success: false,
                message: 'User not found in your organization.'
            });
        }

        userDoc.isActive = !userDoc.isActive;
        await userDoc.save();

        return res.status(200).json({
            success: true,
            message: `User '${userDoc.name}' is now ${userDoc.isActive ? 'Active' : 'Deactivated'}.`,
            data: {
                _id: userDoc._id,
                name: userDoc.name,
                email: userDoc.email,
                isActive: userDoc.isActive
            }
        });
    } catch (error) {
        console.error('Error in toggleUserActive:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user active status.'
        });
    }
};

/**
 * @desc    Hard delete user account
 * @route   DELETE /api/users/:id
 * @access  Private (USERS:DELETE permission)
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = String(req.user?._id || req.user?.id);

        if (String(id) === currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'You cannot delete your own account.'
            });
        }

        const userTenant = req.user?.tenant || null;
        const userDoc = await User.findOne({ _id: id, tenant: userTenant });
        if (!userDoc) {
            return res.status(404).json({
                success: false,
                message: 'User not found in your organization.'
            });
        }

        await User.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: `User '${userDoc.name}' deleted successfully.`
        });
    } catch (error) {
        console.error('Error in deleteUser:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete user.'
        });
    }
};

/**
 * @desc    Update current user's profile details (Name, Phone)
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { name, phone } = req.body;

        const userDoc = await User.findById(userId);
        if (!userDoc) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        if (name) userDoc.name = name.trim();
        if (phone !== undefined) userDoc.phone = phone.trim();

        await userDoc.save();

        const userResponse = userDoc.toObject();
        delete userResponse.password;

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            data: userResponse
        });
    } catch (error) {
        console.error('Error in updateProfile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile.'
        });
    }
};

/**
 * @desc    Change current user's password
 * @route   PUT /api/users/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both currentPassword and newPassword.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        const userDoc = await User.findById(userId).select('+password');
        if (!userDoc) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, userDoc.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password does not match.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        userDoc.password = await bcrypt.hash(newPassword, salt);
        await userDoc.save();

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully!'
        });
    } catch (error) {
        console.error('Error in changePassword:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to change password.'
        });
    }
};

module.exports = {
    createUser,
    getUsers,
    toggleUserActive,
    deleteUser,
    updateProfile,
    changePassword
};
