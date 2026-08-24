const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

// Modules reserved for platform-level / Super Admin use only
const RESTRICTED_TENANT_MODULES = [];

const fixEmptyRolePermissions = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for role permissions backfill...');

        // 1. Fetch all non-restricted permissions
        const validPermissions = await Permission.find({
            module: { $nin: RESTRICTED_TENANT_MODULES }
        });

        if (validPermissions.length === 0) {
            console.error('❌ No permissions found in DB. Please run: node src/scripts/permission.seed.js first!');
            await mongoose.connection.close();
            process.exit(1);
        }

        const validPermissionIds = validPermissions.map(p => p._id);
        console.log(`Found ${validPermissionIds.length} valid permissions to assign.`);

        // 2. Find roles with empty permissions array or missing permissions
        const emptyRoles = await Role.find({
            $or: [
                { permissions: { $exists: false } },
                { permissions: { $size: 0 } }
            ]
        });

        if (emptyRoles.length === 0) {
            console.log('✅ No roles with empty permissions found. All roles are properly configured.');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log(`Found ${emptyRoles.length} role(s) with empty permissions. Repairing...`);

        // 3. Backfill valid permissions onto empty roles
        let updatedCount = 0;
        for (const role of emptyRoles) {
            role.permissions = validPermissionIds;
            await role.save();
            console.log(`  Updated Role: "${role.name}" (ID: ${role._id}, Tenant: ${role.tenant || 'System'})`);
            updatedCount++;
        }

        console.log(`==============================================`);
        console.log(`✅ Successfully backfilled permissions for ${updatedCount} role(s).`);
        console.log(`==============================================`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during role permissions repair:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

fixEmptyRolePermissions();
