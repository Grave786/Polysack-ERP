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
            if (!existingRole.isActive) {
                existingRole.isActive = true;
                if (Array.isArray(permissions)) existingRole.permissions = permissions;
                await existingRole.save();
                await existingRole.populate('permissions');
                return res.status(200).json({
                    success: true,
                    message: `Role '${name}' reactivated successfully.`,
                    data: existingRole
                });
            }
            return res.status(400).json({
                success: false,
                message: `An active role named '${name}' already exists in your organization.`
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
        const { status, search } = req.query;

        const filter = {};
        if (userTenant) {
            filter.tenant = userTenant;
        } else {
            // Super Admin should ONLY see genuine platform-level roles (tenant: null)
            filter.$or = [
                { tenant: null },
                { tenant: { $exists: false } }
            ];
        }

        if (status && status !== 'All Statuses' && status !== 'All' && status !== 'ALL') {
            if (status.toLowerCase() === 'active') {
                filter.isActive = true;
            } else if (status.toLowerCase() === 'inactive' || status.toLowerCase() === 'deactivated') {
                filter.isActive = false;
            }
        }

        if (search && search.trim()) {
            filter.name = { $regex: search.trim(), $options: 'i' };
        }

        // Fetch roles strictly scoped to user's tenant with populated permissions
        const roles = await Role.find(filter).populate('permissions');

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

/**
 * @desc    Get all system permissions for building the permission matrix
 * @route   GET /api/roles/permissions
 * @access  Private
 */
const getAllPermissions = async (req, res) => {
    try {
        let permissions = await Permission.find().sort({ module: 1, action: 1 });

        // Auto-seed permissions if collection is empty
        if (!permissions || permissions.length === 0) {
            const modules = ['INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA', 'USERS', 'ROLES', 'QUALITY', 'CRM', 'DISPATCH', 'HR'];
            const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
            const docsToSeed = [];

            modules.forEach((module) => {
                actions.forEach((action) => {
                    docsToSeed.push({ module, action, description: `${action} access for ${module}` });
                });
            });

            permissions = await Permission.insertMany(docsToSeed);
        }

        const grouped = {};
        permissions.forEach((p) => {
            if (!grouped[p.module]) {
                grouped[p.module] = [];
            }
            grouped[p.module].push(p);
        });

        return res.status(200).json({
            success: true,
            count: permissions.length,
            data: permissions,
            grouped
        });
    } catch (error) {
        console.error('Error in getAllPermissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve permissions list.'
        });
    }
};

/**
 * @desc    Update a role's name, description, and assigned permissions
 * @route   PUT /api/roles/:id
 * @access  Private (ROLES:UPDATE)
 */
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions } = req.body;
        const userTenant = req.user?.tenant || null;

        const role = await Role.findOne({ _id: id, tenant: userTenant });
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found in your organization.'
            });
        }

        if (name) role.name = name.trim();
        if (description !== undefined) role.description = description.trim();
        if (Array.isArray(permissions)) role.permissions = permissions;

        await role.save();
        await role.populate('permissions');

        return res.status(200).json({
            success: true,
            message: 'Role updated successfully!',
            data: role
        });
    } catch (error) {
        console.error('Error in updateRole:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update role.'
        });
    }
};

/**
 * @desc    Delete a role
 * @route   DELETE /api/roles/:id
 * @access  Private (ROLES:DELETE)
 */
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const userTenant = req.user?.tenant || null;

        const role = await Role.findOne({ _id: id, tenant: userTenant });
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found in your organization.'
            });
        }

        const User = require('../models/user.model');
        const assignedUsersCount = await User.countDocuments({ role: id });
        if (assignedUsersCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role '${role.name}' because ${assignedUsersCount} user(s) are currently assigned to it. Please reassign those users to another role first.`
            });
        }

        role.isActive = false;
        await role.save();

        return res.status(200).json({
            success: true,
            message: `Role '${role.name}' deactivated successfully.`
        });
    } catch (error) {
        console.error('Error in deleteRole:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete role.'
        });
    }
};

/**
 * @desc    Toggle active/inactive status of a role
 * @route   PATCH /api/roles/:id/status
 * @access  Private (ROLES:UPDATE)
 */
const toggleRoleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userTenant = req.user?.tenant || null;

        const role = await Role.findOne({ _id: id, tenant: userTenant });
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found in your organization.'
            });
        }

        // Safety guard: prevent deactivating a role that still has users assigned
        if (role.isActive) {
            const User = require('../models/user.model');
            const assignedUsersCount = await User.countDocuments({ role: id });
            if (assignedUsersCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot deactivate role '${role.name}' — ${assignedUsersCount} user(s) are assigned to it. Reassign them first.`
                });
            }
        }

        role.isActive = !role.isActive;
        await role.save();

        const action = role.isActive ? 'reactivated' : 'deactivated';
        return res.status(200).json({
            success: true,
            message: `Role '${role.name}' ${action} successfully.`,
            data: { _id: role._id, isActive: role.isActive }
        });
    } catch (error) {
        console.error('Error in toggleRoleStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle role status.'
        });
    }
};

module.exports = {
    createRole,
    getRoles,
    getAllPermissions,
    updateRole,
    deleteRole,
    toggleRoleStatus
};
