const mongoose = require('mongoose');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

/**
 * @desc    Create a new custom role scoped to current tenant
 * @route   POST /api/roles
 * @access  Private (ROLES:CREATE permission)
 */
const createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;
        const userTenant = req.user?.tenant || null;

        // 1. Validation
        if (!name || !String(name).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required.'
            });
        }

        const trimmedName = String(name).trim();

        // 2. Check duplicate role within the same tenant (case-insensitive)
        const duplicateQuery = {
            name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        };
        if (userTenant) {
            duplicateQuery.tenant = userTenant;
        } else {
            duplicateQuery.$or = [{ tenant: null }, { tenant: { $exists: false } }];
        }

        const existingRole = await Role.findOne(duplicateQuery);
        if (existingRole) {
            if (!existingRole.isActive) {
                existingRole.isActive = true;
                if (description !== undefined) {
                    existingRole.description = typeof description === 'string' ? description.trim() : '';
                }
                if (Array.isArray(permissions)) {
                    existingRole.permissions = await resolveToCanonicalPermissionIds(permissions);
                }
                await existingRole.save();
                await existingRole.populate('permissions');
                return res.status(200).json({
                    success: true,
                    message: `Role '${trimmedName}' reactivated successfully.`,
                    data: existingRole
                });
            }
            return res.status(400).json({
                success: false,
                message: `An active role named '${trimmedName}' already exists in your organization.`
            });
        }

        // 3. Create role
        const canonicalPermIds = await resolveToCanonicalPermissionIds(permissions);
        const newRole = await Role.create({
            name: trimmedName,
            description: typeof description === 'string' ? description.trim() : '',
            tenant: userTenant,
            permissions: canonicalPermIds,
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

        if (error.code === 11000 || error.name === 'MongoServerError') {
            return res.status(400).json({
                success: false,
                message: 'A role with this name already exists in your organization.',
                error: error.message
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors || {}).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ') || 'Validation error creating role.',
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create role.',
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
        await ensurePermissionsAndReconcileRoles();

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

        // Sanitize populated permissions so no nulls/orphans or duplicates are sent to the client
        const sanitizedRoles = roles.map((role) => {
            const roleObj = role.toObject ? role.toObject() : { ...role };
            if (Array.isArray(roleObj.permissions)) {
                const seenKeys = new Set();
                roleObj.permissions = roleObj.permissions.filter((p) => {
                    if (!p || !p.module || !p.action) return false;
                    const key = getPermKey(p.module, p.action);
                    if (seenKeys.has(key)) return false;
                    seenKeys.add(key);
                    return true;
                });
            }
            return roleObj;
        });

        return res.status(200).json({
            success: true,
            count: sanitizedRoles.length,
            data: sanitizedRoles
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

const MATRIX_MODULES = [
    'INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA',
    'USERS', 'ROLES', 'QUALITY', 'APPROVALS', 'DISPATCH', 'HR', 'ANALYTICS', 'CRM', 'COMPANY_SETTINGS'
];
const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'];

const ORIGINAL_8_MODULES = [
    'INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA',
    'USERS', 'ROLES', 'QUALITY'
];

const NEW_5_MODULES = ['APPROVALS', 'DISPATCH', 'HR', 'ANALYTICS', 'CRM', 'COMPANY_SETTINGS'];

const MODULE_ALIASES = {
    'BAG INVENTORY & STOCK MASTER': 'INVENTORY',
    'SHOP FLOOR & WORK ORDERS': 'PRODUCTION',
    'PURCHASE ORDERS & GRN INWARD': 'PROCUREMENT',
    'POS BILLING & SALES ORDERS': 'SALES',
    'PRODUCTS, RAW MATERIALS & MACHINES': 'MASTER_DATA',
    'USER ACCOUNTS & ACCESS CONTROL': 'USERS',
    'ROLES & PERMISSION MATRICES': 'ROLES',
    'QUALITY CONTROL & COA CERTIFICATES': 'QUALITY',
    'APPROVALS & WORKFLOWS': 'APPROVALS',
    'APPROVALS': 'APPROVALS',
    'DISPATCH & DELIVERY': 'DISPATCH',
    'ATTENDANCE & HR MANAGEMENT': 'HR',
    'ANALYTICS & REPORTS': 'ANALYTICS',
    'CUSTOMER CRM & COMPLAINTS': 'CRM',
    'COMPANY SETTINGS & GST PROFILE': 'COMPANY_SETTINGS',
};

const ACTION_ALIASES = {
    'VIEW': 'READ',
    'EDIT': 'UPDATE',
    'WRITE': 'UPDATE',
    'MODIFY': 'UPDATE',
    'REMOVE': 'DELETE'
};

const normalizeModule = (m) => {
    if (!m) return '';
    const clean = String(m).trim().toUpperCase();
    return MODULE_ALIASES[clean] || clean;
};

const normalizeAction = (a) => {
    if (!a) return '';
    const clean = String(a).trim().toUpperCase();
    return ACTION_ALIASES[clean] || clean;
};

const getPermKey = (m, a) => `${normalizeModule(m)}:${normalizeAction(a)}`;

// Global memory cache of canonical permissions
let canonicalPermissionsCache = null;
let hasReconciledRolesOnBoot = false;

/**
 * Ensures all canonical permissions exist in the database and returns the array of permission docs.
 * Cached in memory so repeated calls don't query MongoDB repeatedly.
 */
const ensureCanonicalPermissions = async (force = false) => {
    if (!force && canonicalPermissionsCache && canonicalPermissionsCache.length > 0) {
        return canonicalPermissionsCache;
    }

    try {
        const allPermDocs = await Permission.find({});
        const groupedDocs = new Map();

        allPermDocs.forEach((doc) => {
            const key = getPermKey(doc.module, doc.action);
            if (!groupedDocs.has(key)) {
                groupedDocs.set(key, []);
            }
            groupedDocs.get(key).push(doc);
        });

        const canonicalDocMap = new Map();
        const duplicateIdsToDelete = [];

        for (const moduleName of MATRIX_MODULES) {
            for (const actionName of ACTIONS) {
                const key = `${moduleName}:${actionName}`;
                const docs = groupedDocs.get(key) || [];

                let canonicalDoc = null;
                if (docs.length > 0) {
                    canonicalDoc = docs[0];
                    for (let i = 1; i < docs.length; i++) {
                        duplicateIdsToDelete.push(docs[i]._id);
                    }
                } else {
                    canonicalDoc = await Permission.create({
                        module: moduleName,
                        action: actionName,
                        description: `Allows ${actionName} operations on ${moduleName} module`
                    });
                }
                canonicalDocMap.set(key, canonicalDoc);
            }
        }

        // Clean up duplicate permission documents if any
        if (duplicateIdsToDelete.length > 0) {
            try {
                await Permission.deleteMany({ _id: { $in: duplicateIdsToDelete } });
            } catch (delErr) {
                console.warn('[RBAC] Non-fatal duplicate permission delete notice:', delErr.message);
            }
        }

        canonicalPermissionsCache = Array.from(canonicalDocMap.values());
        return canonicalPermissionsCache;
    } catch (err) {
        console.error('Error in ensureCanonicalPermissions:', err);
        return canonicalPermissionsCache || [];
    }
};

/**
 * Ensures permissions exist and runs one-time default role assignment on boot or when forced.
 * Never mutates or overwrites user-customized roles during runtime.
 */
const ensurePermissionsAndReconcileRoles = async (force = false) => {
    const canonicalDocs = await ensureCanonicalPermissions(force);

    // Only run default role reconciliation once on boot or when force is explicitly true
    if (!hasReconciledRolesOnBoot || force) {
        hasReconciledRolesOnBoot = true;
        try {
            const allRoles = await Role.find({});
            const canonicalDocMap = new Map();
            canonicalDocs.forEach((d) => {
                canonicalDocMap.set(getPermKey(d.module, d.action), d);
            });

            const allIds = Array.from(canonicalDocMap.values()).map((d) => d._id);
            const readerIds = Array.from(canonicalDocMap.entries())
                .filter(([key]) => {
                    const [mod] = key.split(':');
                    return ORIGINAL_8_MODULES.includes(mod);
                })
                .map(([, doc]) => doc._id);

            for (const role of allRoles) {
                try {
                    const rName = (role.name || '').trim();
                    const lowerName = rName.toLowerCase();

                    // Only assign default permissions if the role has no permissions set yet,
                    // preserving user-configured roles from being overwritten
                    if (!role.permissions || role.permissions.length === 0) {
                        if (lowerName === 'tenant admin' || lowerName === 'admin' || (lowerName.includes('admin') && !lowerName.includes('assistant'))) {
                            role.permissions = allIds;
                            await role.save();
                        } else if (lowerName === 'reader') {
                            role.permissions = readerIds;
                            await role.save();
                        }
                    }
                } catch (roleErr) {
                    console.warn(`[RBAC] Non-fatal notice reconciling role '${role.name}':`, roleErr.message);
                }
            }
        } catch (err) {
            console.warn('[RBAC] Error during one-time role reconciliation:', err.message);
        }
    }

    return canonicalDocs;
};

/**
 * Resolves an array of permission IDs, objects, or 'MODULE:ACTION' keys to canonical Permission ObjectIds.
 * Does not mutate or lock any Role documents.
 */
const resolveToCanonicalPermissionIds = async (permissionsInput) => {
    if (!Array.isArray(permissionsInput)) return [];

    const canonicalDocs = await ensureCanonicalPermissions();
    const keyToDocMap = new Map();
    const idToDocMap = new Map();

    canonicalDocs.forEach((doc) => {
        keyToDocMap.set(getPermKey(doc.module, doc.action), doc);
        idToDocMap.set(String(doc._id), doc);
    });

    const resultSet = new Set();

    for (const item of permissionsInput) {
        if (!item) continue;

        // If string in 'MODULE:ACTION' format
        if (typeof item === 'string' && item.includes(':')) {
            const [m, a] = item.split(':');
            const doc = keyToDocMap.get(getPermKey(m, a));
            if (doc) resultSet.add(String(doc._id));
            continue;
        }

        // If populated object { module, action } or { _id, module, action }
        if (typeof item === 'object') {
            if (item.module && item.action) {
                const doc = keyToDocMap.get(getPermKey(item.module, item.action));
                if (doc) {
                    resultSet.add(String(doc._id));
                    continue;
                }
            }
            if (item._id) {
                const idStr = String(item._id);
                const doc = idToDocMap.get(idStr);
                if (doc) {
                    resultSet.add(String(doc._id));
                } else if (mongoose.Types.ObjectId.isValid(idStr)) {
                    resultSet.add(idStr);
                }
                continue;
            }
        }

        // If string / ObjectId
        const idStr = String(item);
        const doc = idToDocMap.get(idStr);
        if (doc) {
            resultSet.add(String(doc._id));
        } else if (mongoose.Types.ObjectId.isValid(idStr)) {
            resultSet.add(idStr);
        }
    }

    return Array.from(resultSet).map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * @desc    Get all system permissions for building the permission matrix
 * @route   GET /api/roles/permissions
 * @access  Private
 */
const getAllPermissions = async (req, res) => {
    try {
        const canonicalDocs = await ensureCanonicalPermissions();

        const sortedPermissions = [...canonicalDocs].sort((a, b) => {
            if (a.module !== b.module) return a.module.localeCompare(b.module);
            return a.action.localeCompare(b.action);
        });

        const grouped = {};
        sortedPermissions.forEach((p) => {
            if (!grouped[p.module]) {
                grouped[p.module] = [];
            }
            grouped[p.module].push(p);
        });

        return res.status(200).json({
            success: true,
            count: sortedPermissions.length,
            data: sortedPermissions,
            grouped
        });
    } catch (error) {
        console.error('Error in getAllPermissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve permissions list.',
            error: error.message
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
        const { name, description, permissions, isActive } = req.body;
        const userTenant = req.user?.tenant || null;
        const isSuperAdmin = !userTenant || req.user?.email === process.env.SUPER_ADMIN_EMAIL || req.user?.role === 'SUPER_ADMIN' || req.user?.role?.name === 'SUPER_ADMIN';

        // 1. Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID format.'
            });
        }

        // 2. Find Role (respecting tenant boundaries)
        let role;
        if (isSuperAdmin) {
            role = await Role.findById(id);
        } else {
            role = await Role.findOne({ _id: id, tenant: userTenant });
        }

        if (!role) {
            // Check if it's a system template role belonging to no tenant
            const systemRole = await Role.findOne({ _id: id, tenant: null });
            if (systemRole && !isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'System default template roles cannot be modified directly. Please create a custom role.'
                });
            }
            return res.status(404).json({
                success: false,
                message: 'Role not found in your organization.'
            });
        }

        // 3. Name validation and duplicate check
        if (name !== undefined) {
            const trimmedName = String(name).trim();
            if (!trimmedName) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name cannot be empty.'
                });
            }

            // Check if another role with this name exists in the same tenant
            const duplicateQuery = {
                name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                _id: { $ne: role._id }
            };
            if (role.tenant) {
                duplicateQuery.tenant = role.tenant;
            } else {
                duplicateQuery.$or = [{ tenant: null }, { tenant: { $exists: false } }];
            }

            const existingWithSameName = await Role.findOne(duplicateQuery);
            if (existingWithSameName) {
                return res.status(400).json({
                    success: false,
                    message: `A role named '${trimmedName}' already exists in your organization.`
                });
            }

            role.name = trimmedName;
        }

        // 4. Update description
        if (description !== undefined) {
            role.description = typeof description === 'string' ? description.trim() : '';
        }

        // 5. Update isActive if provided
        if (typeof isActive === 'boolean') {
            role.isActive = isActive;
        }

        // 6. Update permissions
        if (Array.isArray(permissions)) {
            role.permissions = await resolveToCanonicalPermissionIds(permissions);
        }

        // 7. Save role
        await role.save();
        await role.populate('permissions');

        return res.status(200).json({
            success: true,
            message: 'Role updated successfully!',
            data: role
        });
    } catch (error) {
        console.error('Error in updateRole:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID value for field '${error.path}'.`,
                error: error.message
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors || {}).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ') || 'Validation error saving role.',
                error: error.message
            });
        }

        if (error.code === 11000 || error.name === 'MongoServerError') {
            return res.status(400).json({
                success: false,
                message: 'A role with this name already exists in your organization.',
                error: error.message
            });
        }

        if (error.name === 'VersionError') {
            return res.status(409).json({
                success: false,
                message: 'Role was concurrently modified by another process. Please refresh and try again.',
                error: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update role.',
            error: error.message
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
        const isSuperAdmin = !userTenant || req.user?.email === process.env.SUPER_ADMIN_EMAIL || req.user?.role === 'SUPER_ADMIN' || req.user?.role?.name === 'SUPER_ADMIN';

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID format.'
            });
        }

        let role;
        if (isSuperAdmin) {
            role = await Role.findById(id);
        } else {
            role = await Role.findOne({ _id: id, tenant: userTenant });
        }

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
            message: error.message || 'Failed to delete role.',
            error: error.message
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
        const isSuperAdmin = !userTenant || req.user?.email === process.env.SUPER_ADMIN_EMAIL || req.user?.role === 'SUPER_ADMIN' || req.user?.role?.name === 'SUPER_ADMIN';

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID format.'
            });
        }

        let role;
        if (isSuperAdmin) {
            role = await Role.findById(id);
        } else {
            role = await Role.findOne({ _id: id, tenant: userTenant });
        }

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
            message: error.message || 'Failed to toggle role status.',
            error: error.message
        });
    }
};

module.exports = {
    createRole,
    getRoles,
    getAllPermissions,
    updateRole,
    deleteRole,
    toggleRoleStatus,
    ensurePermissions: ensurePermissionsAndReconcileRoles,
    ensurePermissionsAndReconcileRoles,
    ensureCanonicalPermissions,
    resolveToCanonicalPermissionIds,
    normalizeModule,
    normalizeAction,
    getPermKey
};
