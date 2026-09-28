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
                if (Array.isArray(permissions)) {
                    existingRole.permissions = await resolveToCanonicalPermissionIds(permissions);
                }
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
        const canonicalPermIds = await resolveToCanonicalPermissionIds(permissions);
        const newRole = await Role.create({
            name,
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
    'USERS', 'ROLES', 'QUALITY', 'DISPATCH', 'HR', 'ANALYTICS', 'CRM', 'COMPANY_SETTINGS'
];
const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'];

const ORIGINAL_8_MODULES = [
    'INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA',
    'USERS', 'ROLES', 'QUALITY'
];

const NEW_5_MODULES = ['DISPATCH', 'HR', 'ANALYTICS', 'CRM', 'COMPANY_SETTINGS'];

const MODULE_ALIASES = {
    'BAG INVENTORY & STOCK MASTER': 'INVENTORY',
    'SHOP FLOOR & WORK ORDERS': 'PRODUCTION',
    'PURCHASE ORDERS & GRN INWARD': 'PROCUREMENT',
    'POS BILLING & SALES ORDERS': 'SALES',
    'PRODUCTS, RAW MATERIALS & MACHINES': 'MASTER_DATA',
    'USER ACCOUNTS & ACCESS CONTROL': 'USERS',
    'ROLES & PERMISSION MATRICES': 'ROLES',
    'QUALITY CONTROL & COA CERTIFICATES': 'QUALITY',
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
let lastReconcileTime = 0;
const RECONCILE_THROTTLE_MS = 3000;

/**
 * Idempotently ensures all permissions exist, deduplicates duplicate documents,
 * and repairs Tenant Admin, Reader, Assistant Admin, Account Executive, and Store Manager.
 */
const ensurePermissionsAndReconcileRoles = async (force = false) => {
    const now = Date.now();
    if (!force && canonicalPermissionsCache && (now - lastReconcileTime < RECONCILE_THROTTLE_MS)) {
        return canonicalPermissionsCache;
    }

    try {
        // 1. Fetch all existing permission documents from MongoDB
        const allPermDocs = await Permission.find({});

        // 2. Fetch all roles to know which permissions are already referenced
        const allRoles = await Role.find({});
        const referencedPermIdSet = new Set();
        allRoles.forEach((r) => {
            (r.permissions || []).forEach((pId) => {
                if (pId) referencedPermIdSet.add(String(pId._id || pId));
            });
        });

        // 3. Group permission docs by normalized module:action
        const groupedDocs = new Map();
        allPermDocs.forEach((doc) => {
            const key = getPermKey(doc.module, doc.action);
            if (!groupedDocs.has(key)) {
                groupedDocs.set(key, []);
            }
            groupedDocs.get(key).push(doc);
        });

        const canonicalDocMap = new Map(); // key -> canonicalDoc
        const idToCanonicalMap = new Map(); // anyIdStr -> canonicalDoc._id
        const duplicateIdsToDelete = [];

        // Build canonical set for all 65 permissions (13 modules x 5 actions)
        for (const moduleName of MATRIX_MODULES) {
            for (const actionName of ACTIONS) {
                const key = `${moduleName}:${actionName}`;
                const docs = groupedDocs.get(key) || [];

                let canonicalDoc = null;
                if (docs.length > 0) {
                    // Prefer document already referenced by roles, else oldest document
                    canonicalDoc = docs.find((d) => referencedPermIdSet.has(String(d._id))) || docs[0];

                    // Map all duplicate documents to this canonical document
                    docs.forEach((d) => {
                        idToCanonicalMap.set(String(d._id), canonicalDoc._id);
                        if (String(d._id) !== String(canonicalDoc._id)) {
                            duplicateIdsToDelete.push(d._id);
                        }
                    });
                } else {
                    // Create if missing
                    canonicalDoc = await Permission.create({
                        module: moduleName,
                        action: actionName,
                        description: `Allows ${actionName} operations on ${moduleName} module`
                    });
                    idToCanonicalMap.set(String(canonicalDoc._id), canonicalDoc._id);
                }

                canonicalDocMap.set(key, canonicalDoc);
            }
        }

        // Map any leftover docs
        allPermDocs.forEach((doc) => {
            const key = getPermKey(doc.module, doc.action);
            if (canonicalDocMap.has(key)) {
                const canonicalDoc = canonicalDocMap.get(key);
                idToCanonicalMap.set(String(doc._id), canonicalDoc._id);
                if (String(doc._id) !== String(canonicalDoc._id) && !duplicateIdsToDelete.some((id) => String(id) === String(doc._id))) {
                    duplicateIdsToDelete.push(doc._id);
                }
            }
        });

        // 4. Safely repair Tenant Admin, Reader, Assistant Admin, Account Executive, Store Manager
        const all65Ids = Array.from(canonicalDocMap.values()).map((d) => d._id);
        const reader40Ids = Array.from(canonicalDocMap.entries())
            .filter(([key]) => {
                const [mod] = key.split(':');
                return ORIGINAL_8_MODULES.includes(mod);
            })
            .map(([, doc]) => doc._id);

        for (const role of allRoles) {
            const rName = (role.name || '').trim();
            const lowerName = rName.toLowerCase();

            if (lowerName === 'tenant admin' || lowerName === 'admin' || (lowerName.includes('admin') && !lowerName.includes('assistant'))) {
                // Tenant Admin gets all 65 permissions automatically
                role.permissions = all65Ids;
                await role.save();
            } else if (lowerName === 'reader') {
                // Reader keeps EXACTLY the 40 original permissions
                role.permissions = reader40Ids;
                await role.save();
            } else if (lowerName === 'assistant admin' || lowerName === 'account executive' || lowerName === 'store manager') {
                // Map existing permissions to canonical IDs without adding new modules
                const currentPermIds = (role.permissions || []).map((p) => String(p._id || p));
                const mappedCanonicalIds = new Set();

                currentPermIds.forEach((idStr) => {
                    const cId = idToCanonicalMap.get(idStr);
                    if (cId) {
                        const foundEntry = Array.from(canonicalDocMap.entries()).find(([, d]) => String(d._id) === String(cId));
                        if (foundEntry) {
                            const [mod] = foundEntry[0].split(':');
                            if (!NEW_5_MODULES.includes(mod)) {
                                mappedCanonicalIds.add(cId);
                            }
                        } else {
                            mappedCanonicalIds.add(cId);
                        }
                    }
                });

                role.permissions = Array.from(mappedCanonicalIds);
                await role.save();
            }
        }

        // 5. Delete duplicate documents now that references are canonicalized
        if (duplicateIdsToDelete.length > 0) {
            await Permission.deleteMany({ _id: { $in: duplicateIdsToDelete } });
            console.log(`[RBAC Reconciliation] Merged and deleted ${duplicateIdsToDelete.length} duplicate permission documents.`);
        }

        // 6. Enforce unique index on { module: 1, action: 1 }
        try {
            await Permission.collection.createIndex({ module: 1, action: 1 }, { unique: true });
        } catch (idxErr) {
            console.warn('[RBAC Reconciliation] Index creation notice:', idxErr.message);
        }

        // Update cache
        canonicalPermissionsCache = Array.from(canonicalDocMap.values());
        lastReconcileTime = Date.now();

        return canonicalPermissionsCache;
    } catch (err) {
        console.error('Error in ensurePermissionsAndReconcileRoles:', err);
        return [];
    }
};

/**
 * Resolves an array of permission IDs, objects, or 'MODULE:ACTION' keys to canonical Permission ObjectIds.
 */
const resolveToCanonicalPermissionIds = async (permissionsInput) => {
    if (!Array.isArray(permissionsInput)) return [];

    const canonicalDocs = await ensurePermissionsAndReconcileRoles();
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
            if (doc) resultSet.add(doc._id);
            continue;
        }

        // If populated object { module, action } or { _id, module, action }
        if (typeof item === 'object') {
            if (item.module && item.action) {
                const doc = keyToDocMap.get(getPermKey(item.module, item.action));
                if (doc) {
                    resultSet.add(doc._id);
                    continue;
                }
            }
            if (item._id) {
                const doc = idToDocMap.get(String(item._id));
                if (doc) {
                    resultSet.add(doc._id);
                    continue;
                }
            }
        }

        // If string / ObjectId
        const doc = idToDocMap.get(String(item));
        if (doc) {
            resultSet.add(doc._id);
        }
    }

    return Array.from(resultSet);
};

/**
 * @desc    Get all system permissions for building the permission matrix
 * @route   GET /api/roles/permissions
 * @access  Private
 */
const getAllPermissions = async (req, res) => {
    try {
        await ensurePermissionsAndReconcileRoles();

        const permissions = await Permission.find({ module: { $in: MATRIX_MODULES } }).sort({ module: 1, action: 1 });

        // Ensure distinct by module:action
        const seen = new Set();
        const distinctPermissions = [];
        permissions.forEach((p) => {
            const key = getPermKey(p.module, p.action);
            if (!seen.has(key)) {
                seen.add(key);
                distinctPermissions.push(p);
            }
        });

        const grouped = {};
        distinctPermissions.forEach((p) => {
            if (!grouped[p.module]) {
                grouped[p.module] = [];
            }
            grouped[p.module].push(p);
        });

        return res.status(200).json({
            success: true,
            count: distinctPermissions.length,
            data: distinctPermissions,
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
        if (Array.isArray(permissions)) {
            role.permissions = await resolveToCanonicalPermissionIds(permissions);
        }

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
    toggleRoleStatus,
    ensurePermissions: ensurePermissionsAndReconcileRoles,
    ensurePermissionsAndReconcileRoles,
    resolveToCanonicalPermissionIds,
    normalizeModule,
    normalizeAction,
    getPermKey
};
