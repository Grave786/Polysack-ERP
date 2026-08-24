const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Permission = require('../models/permission.model');

const MODULES = ['INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA', 'USERS', 'ROLES'];
const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'];

/**
 * Seeds or updates all permissions (7 modules x 5 actions = 35 permissions).
 * Idempotent: uses findOneAndUpdate with upsert.
 */
const seedPermissions = async () => {
    let connectionOpenedHere = false;
    try {
        if (mongoose.connection.readyState === 0) {
            if (!process.env.MONGO_URI) {
                throw new Error('MONGO_URI is not defined in environment variables.');
            }
            await mongoose.connect(process.env.MONGO_URI);
            connectionOpenedHere = true;
            console.log('Connected to MongoDB for permission seeding...');
        }

        let totalSeeded = 0;

        for (const moduleName of MODULES) {
            for (const actionName of ACTIONS) {
                await Permission.findOneAndUpdate(
                    { module: moduleName, action: actionName },
                    {
                        module: moduleName,
                        action: actionName,
                        description: `Allows ${actionName} operations on ${moduleName} module`
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                totalSeeded++;
            }
        }

        console.log(`✅ Permissions seeding complete. Upserted ${totalSeeded} permission documents.`);

        if (connectionOpenedHere) {
            await mongoose.connection.close();
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error during permissions seeding:', error);
        if (connectionOpenedHere && mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        if (require.main === module) {
            process.exit(1);
        }
        throw error;
    }
};

if (require.main === module) {
    seedPermissions();
}

module.exports = seedPermissions;
