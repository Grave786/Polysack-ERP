const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

// Modules reserved for platform-level / Super Admin use only
const RESTRICTED_TENANT_MODULES = [];

const fixDanglingRolePermissions = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for fixing dangling role permissions...\n');

        // 1. Fetch all currently valid permissions
        const validPermissionDocs = await Permission.find({
            module: { $nin: RESTRICTED_TENANT_MODULES }
        });

        const totalExpectedPermissions = validPermissionDocs.length;
        const freshPermissionIds = validPermissionDocs.map(p => p._id);

        console.log(`Currently valid permissions count in DB: ${totalExpectedPermissions}`);
        if (totalExpectedPermissions === 0) {
            console.error('❌ No permissions found in DB! Run: node src/scripts/permission.seed.js first.');
            await mongoose.connection.close();
            process.exit(1);
        }

        // 2. Fetch all roles
        const roles = await Role.find({});
        console.log(`Found ${roles.length} total roles in DB. Inspecting permissions...\n`);

        let fixedCount = 0;

        for (const role of roles) {
            const rawCount = role.permissions ? role.permissions.length : 0;

            // Populate permissions to detect dangling nulls
            await role.populate('permissions');

            const validPopulated = (role.permissions || []).filter(p => p !== null && p !== undefined);
            const validCount = validPopulated.length;
            const danglingCount = rawCount - validCount;

            console.log(`Role: "${role.name}" (ID: ${role._id})`);
            console.log(`  - Raw Stored IDs: ${rawCount}`);
            console.log(`  - Valid Populated: ${validCount}`);
            console.log(`  - Dangling Nulls:  ${danglingCount}`);

            // If role has dangling references or doesn't have full expected permissions, update it
            if (danglingCount > 0 || validCount < totalExpectedPermissions) {
                console.log(`  -> ⚠️ Permission mismatch detected. Replacing with ${totalExpectedPermissions} fresh permission ObjectIds...`);
                
                role.permissions = freshPermissionIds;
                await role.save();

                console.log(`  -> ✅ Fixed! Permissions updated: Before = ${validCount} valid (${rawCount} raw), After = ${freshPermissionIds.length} valid.\n`);
                fixedCount++;
            } else {
                console.log(`  -> ✅ OK! Role already has ${validCount}/${totalExpectedPermissions} valid permissions.\n`);
            }
        }

        console.log('=================================================');
        console.log(`Repair completed successfully. Total roles updated: ${fixedCount}/${roles.length}`);
        console.log('=================================================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during role permissions fix:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

fixDanglingRolePermissions();
