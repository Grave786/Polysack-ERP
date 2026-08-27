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

        // Auto-seed default UOMs, Locations, Shifts, and Categories for the new tenant
        const { seedTenantMasterData } = require('../utils/tenantSeeder');
        await seedTenantMasterData(newTenant._id);

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

/**
 * @desc    Get active tenant's profile & GST settings
 * @route   GET /api/tenants/profile
 * @access  Private
 */
const getTenantProfile = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant profile not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: tenant
        });
    } catch (error) {
        console.error('Error in getTenantProfile:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch company profile.'
        });
    }
};

/**
 * @desc    Update active tenant's profile & GST settings
 * @route   PUT /api/tenants/profile
 * @access  Private
 */
const updateTenantProfile = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant profile not found.'
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

        // Saving triggers pre('save') hook in tenant.model.js to validate GSTIN/PAN and derive stateCode
        await tenant.save();

        return res.status(200).json({
            success: true,
            message: 'Company GST Profile & Settings updated successfully.',
            data: tenant
        });
    } catch (error) {
        console.error('Error in updateTenantProfile:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update company profile.'
        });
    }
};

/**
 * @desc    Get list of all tenants in the system for Super Admin overview
 * @route   GET /api/tenants
 * @access  Private (Super Admin / USERS:READ)
 */
const getTenantsList = async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: tenants
        });
    } catch (error) {
        console.error('Error in getTenantsList:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tenants list.',
            error: error.message
        });
    }
};

module.exports = {
    createTenant,
    getTenantProfile,
    updateTenantProfile,
    getTenantsList
};
