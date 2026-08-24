const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const User = require('../models/user.model');
const Location = require('../models/location.model');

/**
 * Migration Script: Migrate legacy facility_id string to Location ObjectId reference
 * Safe to re-run (Idempotent)
 */
const migrateFacilityIdToLocation = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for facility_id to Location ObjectId migration...\n');

        // 1. Find users who have a facility_id string or need facility migration
        const usersToMigrate = await User.find({
            $or: [
                { facility_id: { $exists: true, $ne: null, $ne: '' } },
                { facility: null }
            ]
        });

        console.log(`Found ${usersToMigrate.length} user(s) to inspect for facility migration.\n`);

        let migratedCount = 0;
        let skippedAlreadyMigratedCount = 0;
        let skippedNoTenantCount = 0;
        let failedCount = 0;

        for (const user of usersToMigrate) {
            try {
                // 1. Skip system-level users without a tenant (e.g. Super Admin)
                if (!user.tenant) {
                    console.log(`Skipping user "${user.name}" (${user.email}): no tenant assigned (likely a system-level Super Admin), facility migration not applicable.`);
                    skippedNoTenantCount++;
                    continue;
                }

                // 2. Skip users already migrated
                if (user.facility) {
                    console.log(`Skipping user "${user.name}" (${user.email}): already has facility ObjectId (${user.facility}).`);
                    skippedAlreadyMigratedCount++;
                    continue;
                }

                const rawFacilityString = user.facility_id || 'MAIN_UNIT';
                const formattedCode = String(rawFacilityString).trim().toUpperCase();

                // 3. Find or create Location document for this tenant
                let location = await Location.findOne({
                    code: formattedCode,
                    tenant: user.tenant
                });

                if (!location) {
                    location = await Location.create({
                        name: rawFacilityString.trim() || 'Main Unit',
                        code: formattedCode,
                        type: 'FACTORY',
                        tenant: user.tenant,
                        isActive: true
                    });
                    console.log(`  ➕ Created new Location document: "${location.name}" (Code: ${location.code}, ID: ${location._id}) for Tenant: ${user.tenant}`);
                }

                const beforeFacility = user.facility || 'null';
                user.facility = location._id;
                await user.save();

                console.log(`  ✅ User "${user.name}" (${user.email}): facility updated from [${beforeFacility}] -> [${location._id}] (Code: ${location.code})`);
                migratedCount++;
            } catch (userError) {
                console.error(`  ❌ Error processing user "${user.name}" (${user.email}):`, userError.message);
                failedCount++;
            }
        }

        console.log('\n==============================================');
        console.log(`Migration Summary:`);
        console.log(`  Users Migrated:                  ${migratedCount}`);
        console.log(`  Skipped (Already Migrated):      ${skippedAlreadyMigratedCount}`);
        console.log(`  Skipped (No Tenant / SuperAdmin): ${skippedNoTenantCount}`);
        console.log(`  Failed / Errors:                 ${failedCount}`);
        console.log('==============================================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error during facility migration:', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

migrateFacilityIdToLocation();
