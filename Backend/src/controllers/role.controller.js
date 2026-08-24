const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

/**
 * @desc    Create a new custom role scoped to current tenant
 * @route   POST /api/roles
 * @access  Private (ROLES:CREATE permission)
 */
const createRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;
        const userTenant = req.user?.tenant || null;

        // 1. Validation
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required.'
            });
        }

        // 2. Check duplicate role within the same tenant
        const existingRole = await Role.findOne({ name, tenant: userTenant });
        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: `A role named '${name}' already exists in your organization.`
            });
        }

        // 3. Create role
        const newRole = await Role.create({
            name,
            tenant: userTenant,
            permissions: Array.isArray(permissions) ? permissions : [],
            isActive: true
        });

        // 4. Populate permissions for detailed response
        await newRole.populate('permissions');

        return res.status(201).json({
            success: true,
            message: 'Role created successfully.',
            data: newRole
        });
    } catch (error) {
        console.error('Error in createRole controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create role.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all roles scoped to current tenant
 * @route   GET /api/roles
 * @access  Private (ROLES:READ permission)
 */
const getRoles = async (req, res) => {
    try {
        const userTenant = req.user?.tenant || null;

        // Fetch roles strictly scoped to user's tenant with populated permissions
        const roles = await Role.find({ tenant: userTenant }).populate('permissions');

        return res.status(200).json({
            success: true,
            count: roles.length,
            data: roles
        });
    } catch (error) {
        console.error('Error in getRoles controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve roles.',
            error: error.message
        });
    }
};

module.exports = {
    createRole,
    getRoles
};
