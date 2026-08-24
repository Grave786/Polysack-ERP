const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Role = require('../models/role.model');
const Permission = require('../models/permission.model');

const diagnoseRole = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for Role Diagnosis...\n');

        const roleId = '6a8c1f1e41f876a2e8a8907f';
        let role = null;

        if (mongoose.Types.ObjectId.isValid(roleId)) {
            role = await Role.findById(roleId);
        }

        if (!role) {
            console.log(`Role with exact _id '${roleId}' not found. Fetching all roles...`);
            const allRoles = await Role.find({});
            console.log(`Found ${allRoles.length} total roles in DB:`);
            allRoles.forEach(r => console.log(` - ID: ${r._id}, Name: "${r.name}", Tenant: ${r.tenant || 'null'}`));

            // Pick the first Tenant Admin or first role found for diagnosis
            role = allRoles.find(r => r.name === 'Tenant Admin') || allRoles[0];
        }

        if (!role) {
            console.error('No roles found in database!');
            await mongoose.connection.close();
            process.exit(1);
        }

        console.log('================ ROLE DIAGNOSTIC ================');
        console.log(`Role ID:                ${role._id}`);
        console.log(`Role Name:              ${role.name}`);
        console.log(`Is Active:              ${role.isActive}`);
        console.log(`Tenant ID:              ${role.tenant || 'null (System Level)'}`);
        console.log(`Raw Permissions Length: ${role.permissions.length}`);
        console.log(`Raw Stored Permission ObjectIds:`);
        console.log(role.permissions.map(id => id.toString()));

        // Populate permissions
        await role.populate('permissions');

        const populatedPermissions = role.permissions;
        const validPermissions = populatedPermissions.filter(p => p !== null && p !== undefined);
        const danglingCount = populatedPermissions.length - validPermissions.length;

        console.log(`\nPopulated Permissions Array Length: ${populatedPermissions.length}`);
        console.log(`Valid Populated Permissions Count:  ${validPermissions.length}`);
        console.log(`Dangling/Null Entries Count:        ${danglingCount}`);

        console.log(`\nSample Valid Permissions (first 10):`);
        validPermissions.slice(0, 10).forEach(p => {
            console.log(`  - [${p._id}] Module: ${p.module}, Action: ${p.action}`);
        });

        // Query Permission collection directly for ROLES:CREATE
        console.log('\n---------------- PERMISSION QUERY ----------------');
        const rolesCreatePerm = await Permission.findOne({ module: 'ROLES', action: 'CREATE' });
        if (rolesCreatePerm) {
            console.log(`Target Permission (ROLES:CREATE) ID in DB: ${rolesCreatePerm._id}`);
            const isIncludedInRole = role.permissions.some(p => p && p._id.toString() === rolesCreatePerm._id.toString());
            console.log(`Is (ROLES:CREATE) present in this role's populated permissions? ${isIncludedInRole}`);
        } else {
            console.log(`Target Permission (ROLES:CREATE) NOT FOUND in Permission collection!`);
        }
        console.log('=================================================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic error:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

diagnoseRole();
