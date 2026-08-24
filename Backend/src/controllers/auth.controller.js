const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Private (Super Admin / Admin with USERS:CREATE permission)
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role, tenant, facility_id } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: name, email, password, and role.'
            });
        }

        // 2. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists.'
            });
        }

        // 3. Verify that the requested role exists and is active
        const roleExists = await Role.findById(role);
        if (!roleExists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID provided.'
            });
        }
        if (!roleExists.isActive) {
            return res.status(400).json({
                success: false,
                message: 'The selected role is currently inactive.'
            });
        }

        // Determine tenant: scoped to creator's tenant or passed explicitly
        const userTenant = req.user?.tenant || tenant || null;

        // 4. Hash the password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Create new user
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            tenant: userTenant,
            facility_id: facility_id || 'MAIN_UNIT'
        });

        // 6. Exclude password from response object
        const userResponse = newUser.toObject();
        delete userResponse.password;

        return res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            data: userResponse
        });
    } catch (error) {
        console.error('Error in register controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during user registration.',
            error: error.message
        });
    }
};

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password.'
            });
        }

        // 2. Find user by email and explicitly select password (select: false in schema)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 3. Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact your system administrator.'
            });
        }

        // 4. Compare input password with hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 5. Generate JWT token using generateToken utility
        const token = generateToken(user);

        // 6. Exclude password from user object in response
        const userResponse = user.toObject();
        delete userResponse.password;

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            data: userResponse
        });
    } catch (error) {
        console.error('Error in login controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authentication.',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login
};
