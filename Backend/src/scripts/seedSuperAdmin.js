const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Permission = require('../models/permission.model');
const Role = require('../models/role.model');
const User = require('../models/user.model');

const seedSuperAdmin = async () => {
    try {
        // 1. Connect to MongoDB
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // 2. Check if any users already exist in DB
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('DB already seeded.');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('No users found. Seeding Super Admin...');

        // 3. Create or find Permission for module: 'USERS', action: 'CREATE'
        let userCreatePermission = await Permission.findOne({ module: 'USERS', action: 'CREATE' });
        if (!userCreatePermission) {
            userCreatePermission = await Permission.create({
                module: 'USERS',
                action: 'CREATE',
                description: 'Permission to create user accounts'
            });
            console.log('Permission created: USERS:CREATE');
        }

        // 4. Create or find Role named "Super Admin" with tenant: null (System Level Role)
        let superAdminRole = await Role.findOne({ name: 'Super Admin', tenant: null });
        if (!superAdminRole) {
            superAdminRole = await Role.create({
                name: 'Super Admin',
                tenant: null,
                permissions: [userCreatePermission._id],
                isActive: true
            });
            console.log('Role created: Super Admin (System Level)');
        }

        // 5. Hash password for Super Admin
        const rawPassword = 'Password@123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        // 6. Create Super Admin User with tenant: null (System Level User)
        const superAdminUser = await User.create({
            name: 'Super Admin',
            email: 'superadmin@polysack.com',
            password: hashedPassword,
            role: superAdminRole._id,
            tenant: null, // System-level user owning system
            facility_id: 'MAIN_UNIT',
            isActive: true
        });

        console.log('==============================================');
        console.log('Super Admin seeded successfully!');
        console.log(`Name:        ${superAdminUser.name}`);
        console.log(`Email:       ${superAdminUser.email}`);
        console.log(`Password:    ${rawPassword}`);
        console.log(`Role:        Super Admin (${superAdminRole._id})`);
        console.log(`Tenant:      null (System Level)`);
        console.log('==============================================');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error during Super Admin seeding:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

seedSuperAdmin();
