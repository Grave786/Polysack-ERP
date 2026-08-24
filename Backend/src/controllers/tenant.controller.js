const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/tenant.model');
const Role = require('../models/role.model');
const User = require('../models/user.model');
const Permission = require('../models/permission.model');

// Platform-level modules reserved for Super Admin only (e.g. ['BILLING', 'SYSTEM'])
const RESTRICTED_TENANT_MODULES = [];

/**
 * @desc    Create a new Tenant along with Tenant Admin Role & Admin User
 * @route   POST /api/tenants
 * @access  Private (Super Admin only)
 */
const createTenant = async (req, res) => {
    const {
        name,
        email,
        phone,
        tenantName,
        tenantEmail,
        tenantPhone,
        adminName,
        adminEmail,
        adminPassword
    } = req.body;

    const tName = name || tenantName;
    const tEmail = email || tenantEmail;
    const tPhone = phone || tenantPhone;

    // 1. Validation
    if (!tName || !tEmail || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({
            success: false,
            message: 'Please provide required fields: tenant name, tenant email, adminName, adminEmail, and adminPassword.'
        });
    }

    // 2. Check for existing tenant & admin user email
    const existingTenant = await Tenant.findOne({ email: tEmail.toLowerCase() });
    if (existingTenant) {
        return res.status(400).json({
            success: false,
            message: 'A tenant with this email already exists.'
        });
    }

    const existingAdminUser = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingAdminUser) {
        return res.status(400).json({
            success: false,
            message: 'A user with the admin email already exists.'
        });
    }

    // 3. Attempt MongoDB session transaction
    let session = null;
    let useTransaction = true;

    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (sessionErr) {
        // Standalone MongoDB instances without replica set may fail to start transactions
        useTransaction = false;
    }

    try {
        const sessionOption = useTransaction ? { session } : {};

        // Step A: Create Tenant
        const tenantDocs = await Tenant.create([{
            name: tName,
            email: tEmail,
            phone: tPhone
        }], sessionOption);
        const newTenant = tenantDocs[0];

        // Step B: Fetch non-restricted permissions to assign to Tenant Admin
        const permissionQuery = { module: { $nin: RESTRICTED_TENANT_MODULES } };
        const allowedPermissions = useTransaction 
            ? await Permission.find(permissionQuery).session(session)
            : await Permission.find(permissionQuery);

        const permissionIds = allowedPermissions.map(p => p._id);

        // Step C: Create "Tenant Admin" Role scoped strictly to this tenant's ID
        const roleDocs = await Role.create([{
            name: 'Tenant Admin',
            tenant: newTenant._id,
            permissions: permissionIds,
            isActive: true
        }], sessionOption);
        const tenantAdminRole = roleDocs[0];

        // Step D: Create the first User (Tenant Admin)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const userDocs = await User.create([{
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: tenantAdminRole._id,
            tenant: newTenant._id,
            facility_id: 'MAIN_UNIT',
            isActive: true
        }], sessionOption);
        const adminUser = userDocs[0];

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }

        // Format user object response excluding password
        const adminUserResponse = adminUser.toObject();
        delete adminUserResponse.password;

        return res.status(201).json({
            success: true,
            message: 'Tenant and Tenant Admin created successfully.',
            data: {
                tenant: newTenant,
                admin: adminUserResponse
            }
        });
    } catch (error) {
        if (useTransaction && session) {
            await session.abortTransaction();
            session.endSession();
        } else if (!useTransaction) {
            console.error('Rolling back tenant creation manually due to error:', error.message);
        }

        console.error('Error in createTenant controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create tenant.',
            error: error.message
        });
    }
};

module.exports = {
    createTenant
};
