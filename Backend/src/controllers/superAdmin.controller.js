const mongoose = require('mongoose');
const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const Role = require('../models/role.model');

/**
 * @desc    Get all tenant organizations with user count and tenant admin info
 * @route   GET /api/super-admin/tenants
 * @access  Private (Super Admin Only)
 */
const getAllTenants = async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ createdAt: -1 });

        // Aggregate user counts per tenant
        const userCounts = await User.aggregate([
            { $match: { tenant: { $ne: null } } },
            { $group: { _id: '$tenant', count: { $sum: 1 } } }
        ]);

        const userCountMap = {};
        userCounts.forEach((item) => {
            userCountMap[String(item._id)] = item.count;
        });

        // Query Tenant Admin roles to find the admin user for each tenant
        const adminRoleDocs = await Role.find({
            name: { $in: ['TENANT_ADMIN', 'Tenant Admin', 'Tenant Administrator', 'Admin', 'ADMIN'] }
        }).select('_id');
        const adminRoleIds = adminRoleDocs.map((r) => r._id);

        const tenantAdminUsers = await User.find({
            tenant: { $ne: null },
            $or: [
                { role: { $in: adminRoleIds } },
                { roleName: { $in: ['TENANT_ADMIN', 'Tenant Admin', 'Tenant Administrator', 'Admin', 'ADMIN'] } }
            ]
        })
            .select('name email tenant createdAt')
            .sort({ createdAt: 1 });

        const tenantAdminMap = {};
        tenantAdminUsers.forEach((u) => {
            const tId = String(u.tenant);
            if (!tenantAdminMap[tId]) {
                tenantAdminMap[tId] = {
                    name: u.name,
                    email: u.email
                };
            }
        });

        const data = tenants.map((t) => {
            const tObj = t.toObject();
            tObj.userCount = userCountMap[String(t._id)] || 0;
            tObj.tenantAdmin = tenantAdminMap[String(t._id)] || null;
            return tObj;
        });

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error in getAllTenants:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch platform tenants list.',
            error: error.message
        });
    }
};

/**
 * @desc    Get specific tenant's company profile & GST details by tenantId
 * @route   GET /api/super-admin/tenants/:tenantId/company-profile
 * @access  Private (Super Admin Only)
 */
const getTenantProfileByTenantId = async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tenant ID parameter.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant organization not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        console.error('Error in getTenantProfileByTenantId:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant company profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Update specific tenant's company profile & GST details by tenantId
 * @route   PATCH /api/super-admin/tenants/:tenantId/company-profile
 * @access  Private (Super Admin Only)
 */
const updateTenantProfileByTenantId = async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tenant ID parameter.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant organization not found.'
            });
        }

        const {
            companyName,
            name,
            gstin,
            stateName,
            stateCode,
            pan,
            phone,
            email,
            registeredAddress,
            productionSettings
        } = req.body;

        if (companyName) tenant.companyName = companyName.trim();
        if (name) tenant.name = name.trim();
        if (gstin !== undefined) tenant.gstin = gstin.trim().toUpperCase();
        if (stateName) tenant.stateName = stateName.trim();
        if (stateCode) tenant.stateCode = stateCode.trim();
        if (pan !== undefined) tenant.pan = pan.trim().toUpperCase();
        if (phone !== undefined) tenant.phone = phone.trim();
        if (email !== undefined) tenant.email = email.trim();

        if (registeredAddress && typeof registeredAddress === 'object') {
            tenant.registeredAddress = {
                line1: registeredAddress.line1 || tenant.registeredAddress?.line1 || '',
                line2: registeredAddress.line2 || tenant.registeredAddress?.line2 || '',
                city: registeredAddress.city || tenant.registeredAddress?.city || '',
                pincode: registeredAddress.pincode || tenant.registeredAddress?.pincode || ''
            };
        }

        if (productionSettings && typeof productionSettings === 'object') {
            tenant.productionSettings = {
                activeStartingStage: productionSettings.activeStartingStage || tenant.productionSettings?.activeStartingStage || 'FLEXO_PRINTING',
                stageConfigs: Array.isArray(productionSettings.stageConfigs)
                    ? productionSettings.stageConfigs
                    : (tenant.productionSettings?.stageConfigs || [])
            };
        }

        await tenant.save();

        return res.status(200).json({
            success: true,
            message: 'Tenant company profile & GST settings updated successfully.',
            data: tenant
        });
    } catch (error) {
        console.error('Error in updateTenantProfileByTenantId:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update tenant company profile.'
        });
    }
};

/**
 * @desc    Toggle tenant active / suspended status
 * @route   PATCH /api/super-admin/tenants/:tenantId/status
 * @access  Private (Super Admin Only)
 */
const toggleTenantStatus = async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(tenantId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tenant ID parameter.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant organization not found.'
            });
        }

        tenant.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !tenant.isActive;
        await tenant.save();

        // Invalidate in-memory tenant status cache immediately
        const { clearTenantStatusCache } = require('../middlewares/rbac.middleware');
        clearTenantStatusCache(tenantId);

        return res.status(200).json({
            success: true,
            message: `Tenant status updated to ${tenant.isActive ? 'Active' : 'Suspended'}.`,
            data: tenant
        });
    } catch (error) {
        console.error('Error in toggleTenantStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update tenant status.',
            error: error.message
        });
    }
};

/**
 * @desc    Get top-level Tenant Administrators across tenant organizations (1 per tenant)
 * @route   GET /api/super-admin/tenant-admins
 * @access  Private (Super Admin Only)
 */
const getTenantAdmins = async (req, res) => {
    try {
        const { search } = req.query;

        // Query Tenant Admin roles
        const adminRoleDocs = await Role.find({
            name: { $in: ['TENANT_ADMIN', 'Tenant Admin', 'Tenant Administrator', 'Admin', 'ADMIN'] }
        }).select('_id name');
        const adminRoleIds = adminRoleDocs.map((r) => r._id);

        const users = await User.find({
            tenant: { $ne: null },
            $or: [
                { role: { $in: adminRoleIds } },
                { roleName: { $in: ['TENANT_ADMIN', 'Tenant Admin', 'Tenant Administrator', 'Admin', 'ADMIN'] } }
            ]
        })
            .select('-password')
            .populate('tenant', 'name companyName subdomain status isActive email phone')
            .populate('role', 'name permissions')
            .sort({ createdAt: -1 });

        // Filter strictly for Tenant Admins
        const tenantAdmins = users.filter((u) => {
            const roleName = (u.role?.name || u.roleName || (typeof u.role === 'string' ? u.role : '')).toUpperCase();
            return roleName === 'TENANT_ADMIN' || roleName === 'TENANT ADMIN' || roleName === 'TENANT ADMINISTRATOR' || roleName === 'ADMIN';
        });

        // Deduplicate to guarantee exactly one primary admin row per tenant organization
        const seenTenants = new Set();
        const deduplicatedAdmins = [];
        for (const admin of tenantAdmins) {
            const tenantKey = String(admin.tenant?._id || admin.tenant);
            if (!seenTenants.has(tenantKey)) {
                seenTenants.add(tenantKey);
                deduplicatedAdmins.push(admin);
            }
        }

        let data = deduplicatedAdmins;

        if (search && search.trim()) {
            const s = search.trim().toLowerCase();
            data = data.filter((u) => {
                const name = (u.name || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const company = (u.tenant?.companyName || u.tenant?.name || '').toLowerCase();
                const subdomain = (u.tenant?.subdomain || '').toLowerCase();
                return name.includes(s) || email.includes(s) || company.includes(s) || subdomain.includes(s);
            });
        }

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Error in getTenantAdmins:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant administrators list.',
            error: error.message
        });
    }
};

/**
 * @desc    Update enabled modules list for a specific tenant
 * @route   PATCH /api/super-admin/tenants/:tenantId/modules
 * @access  Private (Super Admin Only)
 */
const updateTenantModules = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { enabledModules } = req.body;

        if (!Array.isArray(enabledModules)) {
            return res.status(400).json({
                success: false,
                message: 'enabledModules must be an array of module identifiers.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant organization not found.'
            });
        }

        tenant.enabledModules = enabledModules;
        await tenant.save();

        // Invalidate in-memory cache so live requests immediately apply new module rules
        const { clearTenantStatusCache } = require('../middlewares/rbac.middleware');
        clearTenantStatusCache(tenantId);

        return res.status(200).json({
            success: true,
            message: `Module access for '${tenant.companyName || tenant.name}' updated successfully.`,
            data: {
                tenantId: tenant._id,
                companyName: tenant.companyName || tenant.name,
                enabledModules: tenant.enabledModules
            }
        });
    } catch (error) {
        console.error('Error in updateTenantModules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update tenant module access.',
            error: error.message
        });
    }
};

module.exports = {
    getAllTenants,
    getTenantProfileByTenantId,
    updateTenantProfileByTenantId,
    toggleTenantStatus,
    getTenantAdmins,
    updateTenantModules
};
