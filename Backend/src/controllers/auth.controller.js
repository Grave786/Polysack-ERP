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

        // 2. Find user by email, select password and populate role with permissions & tenant
        const user = await User.findOne({ email })
            .select('+password')
            .populate('tenant')
            .populate({
                path: 'role',
                populate: {
                    path: 'permissions'
                }
            });

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

        // 4b. Verify Tenant active status (if tenant-scoped user)
        if (user.tenant) {
            const Tenant = require('../models/tenant.model');
            const tenantDoc = await Tenant.findById(user.tenant).select('isActive name').lean();
            if (!tenantDoc || tenantDoc.isActive === false) {
                return res.status(403).json({
                    success: false,
                    code: 'TENANT_SUSPENDED',
                    message: "Your organization's account has been suspended. Please contact support."
                });
            }
        }

        // 5. Generate JWT token using generateToken utility
        const token = generateToken(user);

        if (user.tenant && (!user.role || !user.role.isActive)) {
            const activeRole = await Role.findOne({ tenant: user.tenant, isActive: true }).populate('permissions');
            if (activeRole) {
                console.log(`✅ [Auto-Heal Login] Re-linking user '${user.email}' (${user._id}) to active tenant role '${activeRole.name}' (${activeRole._id})`);
                await User.updateOne({ _id: user._id }, { role: activeRole._id });
                user.role = activeRole;
            }
        }

        // 6. Exclude password & format permissions/isSuperAdmin in user object
        const userResponse = formatUserResponse(user);

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

const DEFAULT_TENANT_MODULES = [
    'MASTER_DATA', 'PRODUCTION', 'QUALITY', 'INVENTORY',
    'POS', 'SALES', 'PROCUREMENT', 'CRM', 'DISPATCH', 'HR', 'ANALYTICS'
];

/**
 * Helper to format user response with isSuperAdmin, tenantEnabledModules & permittedModules
 */
const formatUserResponse = (userDoc) => {
    const userObj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
    delete userObj.password;

    const userRoleName = typeof userObj.role === 'object' ? userObj.role?.name : userObj.role;
    const isSuperAdmin = Boolean(
        !userObj.tenant ||
        userObj.email === (process.env.SUPER_ADMIN_EMAIL || 'superadmin@polysack.com') ||
        userRoleName === 'SUPER_ADMIN' ||
        userRoleName === 'Super Admin'
    );

    let tenantEnabledModules = DEFAULT_TENANT_MODULES;
    if (userObj.tenant && typeof userObj.tenant === 'object' && Array.isArray(userObj.tenant.enabledModules) && userObj.tenant.enabledModules.length > 0) {
        tenantEnabledModules = userObj.tenant.enabledModules;
    }

    let permittedModules = [];
    if (isSuperAdmin) {
        permittedModules = ['SUPER_ADMIN_PANEL', 'TENANTS', 'USERS', 'ROLES', 'DASHBOARD'];
    } else if (userObj.role && Array.isArray(userObj.role.permissions)) {
        const permSet = new Set();
        userObj.role.permissions.forEach((p) => {
            if (p.module) permSet.add(p.module);
        });
        permittedModules = Array.from(permSet);
    }

    userObj.isSuperAdmin = isSuperAdmin;
    userObj.tenantEnabledModules = tenantEnabledModules;
    userObj.permittedModules = permittedModules;
    return userObj;
};

/**
 * @desc    Get currently logged in user session
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const user = await User.findById(userId)
            .select('-password')
            .populate('tenant')
            .populate({
                path: 'role',
                populate: {
                    path: 'permissions'
                }
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        if (user.tenant && (!user.role || !user.role.isActive)) {
            const activeRole = await Role.findOne({ tenant: user.tenant, isActive: true }).populate('permissions');
            if (activeRole) {
                console.log(`✅ [Auto-Heal Auth] Re-linking user '${user.email}' (${user._id}) to active tenant role '${activeRole.name}' (${activeRole._id})`);
                await User.updateOne({ _id: user._id }, { role: activeRole._id });
                user.role = activeRole;
            }
        }

        const userResponse = formatUserResponse(user);

        return res.status(200).json({
            success: true,
            data: userResponse
        });
    } catch (error) {
        console.error('Error in getMe controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving user context.'
        });
    }
};

module.exports = {
    register,
    login,
    getMe
};
